from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.instruction import Instruction
import json

class InstructionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all_instructions(self) -> List[Instruction]:
        result = await self.db.execute(select(Instruction).where(Instruction.is_active == True))
        return result.scalars().all()

    async def validate_mutex(self, actions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        检查指令互斥逻辑
        如果发现互斥，保留优先级高的或第一个指令，并标记冲突
        """
        if not actions:
            return []
            
        # 获取所有涉及指令的互斥配置
        action_names = [a['name'] for a in actions]
        stmt = select(Instruction).where(Instruction.name.in_(action_names))
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
                    # TODO: Log conflict warning
                    break
            
            if not conflict:
                valid_actions.append(action)
                seen_actions.add(name)
                
        return valid_actions

    async def create_instruction(self, data: Dict[str, Any]) -> Instruction:
        instruction = Instruction(**data)
        self.db.add(instruction)
        await self.db.commit()
        await self.db.refresh(instruction)
        return instruction
