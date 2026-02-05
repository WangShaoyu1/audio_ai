from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.instruction import Instruction
import uuid

class InstructionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all_instructions(self, user_id: uuid.UUID, repository_id: Optional[uuid.UUID] = None) -> List[Instruction]:
        stmt = select(Instruction).where(
            Instruction.user_id == user_id,
            Instruction.is_active == True
        )
        if repository_id:
            stmt = stmt.where(Instruction.repository_id == repository_id)
            
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_instructions_paginated(self, user_id: uuid.UUID, page: int, page_size: int, repository_id: Optional[uuid.UUID] = None) -> Dict[str, Any]:
        from sqlalchemy import func
        
        # Base query conditions
        conditions = [
            Instruction.user_id == user_id,
            Instruction.is_active == True
        ]
        if repository_id:
            conditions.append(Instruction.repository_id == repository_id)
        
        # Count total
        count_stmt = select(func.count()).select_from(Instruction).where(*conditions)
        total_result = await self.db.execute(count_stmt)
        total = total_result.scalar_one()

        # Get page items
        stmt = (
            select(Instruction)
            .where(*conditions)
            .offset((page - 1) * page_size)
            .limit(page_size)
            .order_by(Instruction.name.asc())
        )
        result = await self.db.execute(stmt)
        items = result.scalars().all()

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size
        }

    async def validate_mutex(self, actions: List[Dict[str, Any]], user_id: uuid.UUID) -> List[Dict[str, Any]]:
        """
        检查指令互斥逻辑
        """
        if not actions:
            return []
            
        # 获取所有涉及指令的互斥配置 (Scoped to user)
        action_names = [a['name'] for a in actions]
        stmt = select(Instruction).where(
            Instruction.name.in_(action_names),
            Instruction.user_id == user_id
        )
        result = await self.db.execute(stmt)
        instructions = {i.name: i for i in result.scalars().all()}
        
        valid_actions = []
        seen_actions = set()
        
        for action in actions:
            name = action['name']
            if name not in instructions:
                continue # Skip unknown instructions
                
            config = instructions[name].mutex_config
            incompatible_list = config.get('incompatible', [])
            
            # Check conflict
            conflict = False
            for seen in seen_actions:
                if seen in incompatible_list:
                    conflict = True
                    break
            
            if not conflict:
                valid_actions.append(action)
                seen_actions.add(name)
                
        return valid_actions

    async def create_instruction(self, data: Dict[str, Any], user_id: uuid.UUID) -> Instruction:
        # Ensure repository_id is provided or handle it
        # For now, data should contain repository_id
        instruction = Instruction(**data, user_id=user_id)
        self.db.add(instruction)
        await self.db.commit()
        await self.db.refresh(instruction)
        return instruction
