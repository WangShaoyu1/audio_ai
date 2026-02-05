from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update
from app.models.instruction import InstructionRepository, Instruction
import uuid
from datetime import datetime

class InstructionRepositoryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_repositories(self, user_id: uuid.UUID) -> List[InstructionRepository]:
        stmt = select(InstructionRepository).where(InstructionRepository.user_id == user_id).order_by(InstructionRepository.created_at.desc())
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def create_repository(self, data: Dict[str, Any], user_id: uuid.UUID) -> InstructionRepository:
        repo = InstructionRepository(
            user_id=user_id,
            name=data['name'],
            device_type=data['device_type'],
            language=data.get('language', 'zh'),
            description=data.get('description')
        )
        self.db.add(repo)
        await self.db.commit()
        await self.db.refresh(repo)
        return repo

    async def update_repository(self, repo_id: uuid.UUID, data: Dict[str, Any], user_id: uuid.UUID) -> Optional[InstructionRepository]:
        stmt = select(InstructionRepository).where(InstructionRepository.id == repo_id, InstructionRepository.user_id == user_id)
        result = await self.db.execute(stmt)
        repo = result.scalar_one_or_none()
        
        if not repo:
            return None
            
        if 'name' in data:
            repo.name = data['name']
        if 'device_type' in data:
            repo.device_type = data['device_type']
        if 'language' in data:
            repo.language = data['language']
        if 'description' in data:
            repo.description = data['description']
            
        repo.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(repo)
        return repo

    async def delete_repository(self, repo_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        stmt = select(InstructionRepository).where(InstructionRepository.id == repo_id, InstructionRepository.user_id == user_id)
        result = await self.db.execute(stmt)
        repo = result.scalar_one_or_none()
        
        if not repo:
            return False
            
        # Optional: Check if instructions exist? Or cascade delete? 
        # For now, let's assume we want to cascade delete instructions logic manually or rely on DB FK.
        # But DB FK didn't specify CASCADE. So we should delete instructions first.
        
        await self.db.execute(delete(Instruction).where(Instruction.repository_id == repo_id))
        await self.db.delete(repo)
        await self.db.commit()
        return True
