import json
from typing import List, Dict, Optional, Any
import redis.asyncio as redis
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.models.base import User, Session, Message
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class MemoryManager:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.redis = redis.from_url(f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}")
        
    async def get_short_term_memory(self, session_id: str) -> List[Dict]:
        """获取短期记忆 (Redis)"""
        if not settings.MEMORY_ENABLE:
            return []
        
        try:
            key = f"session:{session_id}:history"
            raw_data = await self.redis.lrange(key, 0, -1)
            return [json.loads(item) for item in raw_data][::-1]
        except Exception as e:
            logger.error(f"Short-term Memory Error: {e}")
            return []

    async def get_user_profile(self, user_id: str) -> Dict[str, Any]:
        """获取长期记忆 (User Profile)"""
        try:
            stmt = select(User).where(User.id == user_id)
            result = await self.db.execute(stmt)
            user = result.scalar_one_or_none()
            # Assuming user model has a 'profile' JSONB column (need to add migration)
            return user.profile if user and hasattr(user, 'profile') else {}
        except Exception as e:
            logger.error(f"Long-term Memory Error: {e}")
            return {}

    async def save_message(self, session_id: str, role: str, content: str, user_id: str):
        """保存消息到 Redis (短期) 和 DB (中期)"""
        if not settings.MEMORY_ENABLE:
            return

        try:
            # 1. Save to Redis (Short-term)
            key = f"session:{session_id}:history"
            message_data = {"role": role, "content": content}
            async with self.redis.pipeline() as pipe:
                await pipe.lpush(key, json.dumps(message_data))
                await pipe.ltrim(key, 0, 9) # Keep last 10 messages
                await pipe.expire(key, 1800) # 30 min TTL
                await pipe.execute()

            # 2. Save to DB (Mid-term)
            # Check if session exists, create if not
            # (Simplified logic, in prod should be handled by SessionService)
            db_msg = Message(
                session_id=session_id,
                role=role,
                content=content
            )
            self.db.add(db_msg)
            await self.db.commit()
            
        except Exception as e:
            logger.error(f"Save Memory Error: {e}")
            await self.db.rollback()
