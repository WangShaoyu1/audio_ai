
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, asc, delete, func, distinct
from app.models.base import BenchmarkCase
from app.models.instruction import InstructionRepository, Instruction
from app.core.llm_factory import LLMFactory
from app.core.config import settings
from langchain_core.messages import HumanMessage, SystemMessage
from typing import List, Optional
import pandas as pd
import io
import uuid
import json
import re
from datetime import datetime

class BenchmarkService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_cases(
        self, 
        skip: int = 0, 
        limit: int = 100, 
        query: Optional[str] = None,
        repository_id: Optional[uuid.UUID] = None,
        version: Optional[int] = None
    ) -> List[BenchmarkCase]:
        stmt = select(BenchmarkCase)
        if repository_id:
            stmt = stmt.where(BenchmarkCase.repository_id == repository_id)
            
        if version is not None:
            # Show specific system version OR manual cases
            stmt = stmt.where(
                (BenchmarkCase.version == version) | (BenchmarkCase.source == 'manual')
            )

        if query:
            stmt = stmt.where(
                (BenchmarkCase.question.ilike(f"%{query}%")) | 
                (BenchmarkCase.answer.ilike(f"%{query}%"))
            )
        stmt = stmt.order_by(desc(BenchmarkCase.created_at)).offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_total_count(self, query: Optional[str] = None, repository_id: Optional[uuid.UUID] = None, version: Optional[int] = None) -> int:
        stmt = select(func.count(BenchmarkCase.id))
        if repository_id:
            stmt = stmt.where(BenchmarkCase.repository_id == repository_id)
        
        if version is not None:
            stmt = stmt.where(
                (BenchmarkCase.version == version) | (BenchmarkCase.source == 'manual')
            )

        if query:
            stmt = stmt.where(
                (BenchmarkCase.question.ilike(f"%{query}%")) | 
                (BenchmarkCase.answer.ilike(f"%{query}%"))
            )
        result = await self.db.execute(stmt)
        return result.scalar()

    async def get_versions(self, repository_id: uuid.UUID) -> List[int]:
        """Get list of available system versions for a repository"""
        stmt = select(distinct(BenchmarkCase.version)).where(
            BenchmarkCase.repository_id == repository_id,
            BenchmarkCase.source == 'system'
        ).order_by(desc(BenchmarkCase.version))
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def create_case(self, question: str, answer: str, intent: str = "instruction", repository_id: Optional[uuid.UUID] = None) -> BenchmarkCase:
        # Manual creation -> source='manual', version=0 (or 1, doesn't matter much as we filter by source='manual')
        # Let's keep version=1 default from model
        case = BenchmarkCase(
            question=question, 
            answer=answer, 
            intent=intent, 
            repository_id=repository_id,
            source='manual'
        )
        self.db.add(case)
        await self.db.commit()
        await self.db.refresh(case)
        
        # Trigger matcher reload
        try:
            from app.services.instruction_matcher import matcher_service
            await matcher_service.reload(self.db)
        except Exception as e:
            # Log error but don't fail the request
            print(f"Failed to reload matcher after create_case: {e}")

        return case

    async def update_case(self, id: uuid.UUID, question: Optional[str] = None, answer: Optional[str] = None, intent: Optional[str] = None) -> Optional[BenchmarkCase]:
        stmt = select(BenchmarkCase).where(BenchmarkCase.id == id)
        result = await self.db.execute(stmt)
        case = result.scalar_one_or_none()
        if not case:
            return None
        
        if question is not None:
            case.question = question
        if answer is not None:
            case.answer = answer
        if intent is not None:
            case.intent = intent
            
        await self.db.commit()
        await self.db.refresh(case)

        # Trigger matcher reload
        try:
            from app.services.instruction_matcher import matcher_service
            await matcher_service.reload(self.db)
        except Exception as e:
            print(f"Failed to reload matcher after update_case: {e}")

        return case

    async def delete_case(self, id: uuid.UUID) -> bool:
        stmt = select(BenchmarkCase).where(BenchmarkCase.id == id)
        result = await self.db.execute(stmt)
        case = result.scalar_one_or_none()
        if not case:
            return False
        await self.db.delete(case)
        await self.db.commit()

        # Trigger matcher reload
        try:
            from app.services.instruction_matcher import matcher_service
            await matcher_service.reload(self.db)
        except Exception as e:
            print(f"Failed to reload matcher after delete_case: {e}")

        return True

    async def delete_version(self, repository_id: uuid.UUID, version: int) -> int:
        """
        Delete all system benchmark cases for a specific version.
        If the deleted version was the active one, fallback to the latest available version.
        """
        # 1. Delete cases
        stmt = delete(BenchmarkCase).where(
            BenchmarkCase.repository_id == repository_id,
            BenchmarkCase.version == version,
            BenchmarkCase.source == 'system'
        )
        result = await self.db.execute(stmt)
        deleted_count = result.rowcount
        await self.db.commit()

        # 2. Check if active version was deleted and handle fallback
        repo_stmt = select(InstructionRepository).where(InstructionRepository.id == repository_id)
        repo_res = await self.db.execute(repo_stmt)
        repo = repo_res.scalar_one_or_none()
        
        if repo and repo.active_system_version == version:
            # Find max version remaining
            ver_stmt = select(func.max(BenchmarkCase.version)).where(
                BenchmarkCase.repository_id == repository_id,
                BenchmarkCase.source == 'system'
            )
            ver_res = await self.db.execute(ver_stmt)
            max_ver = ver_res.scalar()
            
            # If no versions left, 0; otherwise max_ver
            repo.active_system_version = max_ver if max_ver is not None else 0
            await self.db.commit()
            await self.db.refresh(repo)

        # 3. Trigger matcher reload
        try:
            from app.services.instruction_matcher import matcher_service
            await matcher_service.reload(self.db)
        except Exception as e:
            print(f"Failed to reload matcher after delete_version: {e}")

        return deleted_count

    async def import_excel(self, file_content: bytes, repository_id: Optional[uuid.UUID] = None) -> dict:
        try:
            df = pd.read_excel(io.BytesIO(file_content))
        except Exception as e:
            raise ValueError(f"Invalid Excel file: {str(e)}")

        required_cols = ['question', 'answer']
        if not all(col in df.columns for col in required_cols):
            raise ValueError(f"Missing required columns: {required_cols}")

        count = 0
        for _, row in df.iterrows():
            question = str(row['question']).strip()
            answer = str(row['answer']).strip()
            intent = str(row.get('intent', 'instruction')).strip()
            
            if question and answer:
                case = BenchmarkCase(
                    question=question, 
                    answer=answer, 
                    intent=intent,
                    repository_id=repository_id,
                    source='manual'
                )
                self.db.add(case)
                count += 1
        
        await self.db.commit()
        return {"count": count}

    async def export_excel(self, repository_id: Optional[uuid.UUID] = None) -> bytes:
        stmt = select(BenchmarkCase)
        if repository_id:
            stmt = stmt.where(BenchmarkCase.repository_id == repository_id)
        stmt = stmt.order_by(desc(BenchmarkCase.created_at))
        
        result = await self.db.execute(stmt)
        cases = result.scalars().all()
        
        data = []
        for c in cases:
            data.append({
                "question": c.question,
                "answer": c.answer,
                "intent": c.intent,
                "source": c.source,
                "version": c.version,
                "created_at": c.created_at.strftime("%Y-%m-%d %H:%M:%S")
            })
        
        df = pd.DataFrame(data)
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
        return output.getvalue()

    def get_template(self) -> bytes:
        data = [{
            "question": "Example Question",
            "answer": "Example Answer",
            "intent": "instruction"
        }]
        df = pd.DataFrame(data)
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
        return output.getvalue()

    async def get_active_version(self, repository_id: uuid.UUID) -> Optional[int]:
        stmt = select(InstructionRepository.active_system_version).where(InstructionRepository.id == repository_id)
        result = await self.db.execute(stmt)
        return result.scalar()

    async def set_active_version(self, repository_id: uuid.UUID, version: int):
        # Verify version exists for this repo
        stmt = select(BenchmarkCase).where(
            BenchmarkCase.repository_id == repository_id, 
            BenchmarkCase.version == version,
            BenchmarkCase.source == 'system'
        ).limit(1)
        result = await self.db.execute(stmt)
        if not result.scalar():
            raise ValueError("Version not found")

        stmt_update = select(InstructionRepository).where(InstructionRepository.id == repository_id)
        res = await self.db.execute(stmt_update)
        repo = res.scalar_one_or_none()
        if repo:
            repo.active_system_version = version
            await self.db.commit()
            await self.db.refresh(repo)

    async def generate_system_pairs(
        self, 
        repo_id: uuid.UUID, 
        provider: Optional[str] = None, 
        model_name: Optional[str] = None, 
        count_per_instr: int = 3
    ) -> int:
        # 1. Fetch Repository Info
        repo_stmt = select(InstructionRepository).where(InstructionRepository.id == repo_id)
        repo_res = await self.db.execute(repo_stmt)
        repo = repo_res.scalar_one_or_none()
        if not repo:
            raise ValueError("Instruction Repository not found")

        # Determine language and LLM config
        language = repo.language or 'zh'
        
        if not provider:
            if language == 'en':
                provider = settings.DEFAULT_LLM_PROVIDER_en or settings.DEFAULT_LLM_PROVIDER
            else:
                provider = settings.DEFAULT_LLM_PROVIDER
        
        if not model_name:
            if language == 'en':
                model_name = settings.DEFAULT_LLM_MODEL_en or settings.DEFAULT_LLM_MODEL
            else:
                model_name = settings.DEFAULT_LLM_MODEL

        # 2. Fetch Instructions
        instr_stmt = select(Instruction).where(
            Instruction.repository_id == repo_id,
            Instruction.is_active == True
        )
        instr_res = await self.db.execute(instr_stmt)
        instructions = instr_res.scalars().all()
        
        if not instructions:
            return 0

        # 3. Determine New Version
        # Get max version for this repo
        ver_stmt = select(func.max(BenchmarkCase.version)).where(
            BenchmarkCase.repository_id == repo_id,
            BenchmarkCase.source == 'system'
        )
        ver_res = await self.db.execute(ver_stmt)
        max_ver = ver_res.scalar() or 0
        new_version = max_ver + 1

        # 4. Initialize LLM
        try:
            llm = LLMFactory.create_llm(provider, model_name, temperature=0.8) # High temp for diversity
        except Exception as e:
            raise ValueError(f"Failed to create LLM: {str(e)}")

        total_generated = 0
        
        # 5. Loop through instructions
        for instr in instructions:
            # Construct Prompt for SINGLE instruction
            instr_detail = f"Name: {instr.name}\nDescription: {instr.description}\nParameters: {json.dumps(instr.parameters, ensure_ascii=False)}"
            
            # Read prompt template from file
            prompt_path = f"app/config/prompts/generalized_instruction_prompt_{language}.txt"
            try:
                with open(prompt_path, "r", encoding="utf-8") as f:
                    prompt_template = f.read()
            except Exception as e:
                print(f"Failed to read prompt file from {prompt_path}: {e}")
                # Fallback to default English prompt if specific language file fails
                fallback_path = "app/config/prompts/generalized_instruction_prompt_en.txt"
                try:
                    with open(fallback_path, "r", encoding="utf-8") as f:
                         prompt_template = f.read()
                except:
                     # Final hardcoded fallback
                    prompt_template = """
You are an expert in generating training data.
Device: {device_context}
Repo: {repo_name}
Instruction: {instr_detail}
Generate {count_per_instr} queries.
Output JSON list: [ {{"question": "...", "answer": {{"name": "{instr_name}", "parameters": {{}}}}}} ]
"""
            
            try:
                prompt = prompt_template.format(
                    device_context=repo.device_type,
                    repo_name=repo.name,
                    count_per_instr=count_per_instr,
                    instr_detail=instr_detail,
                    instr_name=instr.name
                )
            except KeyError as e:
                print(f"Prompt formatting error: Missing key {e}")
                continue

            messages = [
                SystemMessage(content="You are a helpful AI assistant that generates JSON dataset."),
                HumanMessage(content=prompt)
            ]

            try:
                response = await llm.ainvoke(messages)
                content = response.content
                
                # Robust JSON extraction
                content = content.strip()
                match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
                if match:
                    content = match.group(1)
                else:
                    match = re.search(r'```\s*(.*?)\s*```', content, re.DOTALL)
                    if match:
                         content = match.group(1)
                
                start = content.find('[')
                end = content.rfind(']')
                if start != -1 and end != -1:
                    content = content[start:end+1]
                
                try:
                    data = json.loads(content)
                except json.JSONDecodeError:
                    try:
                        data, _ = json.JSONDecoder().raw_decode(content)
                    except Exception:
                        print(f"Warning: Failed to parse JSON for instruction {instr.name}")
                        continue

                if isinstance(data, list):
                    for item in data:
                        q = item.get("question")
                        a = item.get("answer")
                        if q and a:
                            a_str = json.dumps(a, ensure_ascii=False)
                            case = BenchmarkCase(
                                question=q,
                                answer=a_str,
                                intent="instruction",
                                repository_id=repo_id,
                                source='system',
                                version=new_version
                            )
                            self.db.add(case)
                            total_generated += 1
            except Exception as e:
                print(f"Error generating for instruction {instr.name}: {e}")
                continue

        # 6. Commit new data
        if total_generated > 0:
            repo.active_system_version = new_version
            await self.db.commit()
            
            # 7. Cleanup old versions (Keep top 5)
            # Find versions to delete
            all_versions_stmt = select(distinct(BenchmarkCase.version)).where(
                BenchmarkCase.repository_id == repo_id,
                BenchmarkCase.source == 'system'
            ).order_by(desc(BenchmarkCase.version))
            
            all_versions_res = await self.db.execute(all_versions_stmt)
            all_versions = all_versions_res.scalars().all()
            
            if len(all_versions) > 5:
                versions_to_delete = all_versions[5:]
                delete_stmt = delete(BenchmarkCase).where(
                    BenchmarkCase.repository_id == repo_id,
                    BenchmarkCase.source == 'system',
                    BenchmarkCase.version.in_(versions_to_delete)
                )
                await self.db.execute(delete_stmt)
                await self.db.commit()

        return total_generated

    async def delete_version(self, repository_id: uuid.UUID, version: int) -> int:
        # Delete cases
        stmt = delete(BenchmarkCase).where(
            BenchmarkCase.repository_id == repository_id,
            BenchmarkCase.version == version,
            BenchmarkCase.source == 'system'
        )
        result = await self.db.execute(stmt)
        deleted_count = result.rowcount
        await self.db.commit()

        # Check if active version was deleted
        repo_stmt = select(InstructionRepository).where(InstructionRepository.id == repository_id)
        repo_res = await self.db.execute(repo_stmt)
        repo = repo_res.scalar_one_or_none()
        
        if repo and repo.active_system_version == version:
            # Fallback to max version remaining
            ver_stmt = select(func.max(BenchmarkCase.version)).where(
                BenchmarkCase.repository_id == repository_id,
                BenchmarkCase.source == 'system'
            )
            ver_res = await self.db.execute(ver_stmt)
            max_ver = ver_res.scalar()
            
            repo.active_system_version = max_ver if max_ver is not None else 0
            await self.db.commit()
            await self.db.refresh(repo)

        # Trigger matcher reload
        try:
            from app.services.instruction_matcher import matcher_service
            await matcher_service.reload(self.db)
        except Exception as e:
            print(f"Failed to reload matcher after delete_version: {e}")

        return deleted_count
