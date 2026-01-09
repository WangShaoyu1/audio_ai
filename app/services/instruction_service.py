from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.instruction import Instruction
import uuid

class InstructionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all_instructions(self, user_id: uuid.UUID) -> List[Instruction]:
        result = await self.db.execute(
            select(Instruction)
            .where(Instruction.user_id == user_id)
            .where(Instruction.is_active == True)
        )
        return result.scalars().all()

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
        instruction = Instruction(**data, user_id=user_id)
        self.db.add(instruction)
        await self.db.commit()
        await self.db.refresh(instruction)
        return instruction
