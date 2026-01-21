import json
import datetime
from typing import List, Dict, Optional, Any
import redis.asyncio as redis
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, desc, and_
from app.models.base import User, Session, Message
from app.core.config import settings
import logging
import random
from app.services.vector_service import vector_service

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

    async def get_relevant_mid_term_memory(self, session_id: str, query: str, limit: int = 5) -> List[Dict]:
        """
        获取相关的中期记忆 (Vector Search from DB)
        排除掉已经在短期记忆中的最近消息
        """
        if not settings.MEMORY_ENABLE or not settings.MID_TERM_MEMORY_ENABLE_EMBEDDING:
            return []
            
        try:
            # 1. Generate Query Embedding
            query_embedding = await vector_service.embed_query(query)
            
            # 2. Vector Search using Common Service
            messages = await vector_service.search(
                db=self.db,
                model_class=Message,
                query_vector=query_embedding,
                filters=[Message.session_id == session_id],
                limit=limit
            )
            
            # Convert to dict
            return [
                {
                    "role": msg.role, 
                    "content": msg.content, 
                    "created_at": msg.created_at.isoformat() if msg.created_at else ""
                } 
                for msg in messages
            ]
            
        except Exception as e:
            logger.error(f"Mid-term Memory Retrieval Error: {e}")
            return []

    async def get_user_profile(self, user_id: str) -> Dict[str, Any]:
        """获取长期记忆 (User Profile)"""
        try:
            stmt = select(User).where(User.id == user_id)
            result = await self.db.execute(stmt)
            user = result.scalar_one_or_none()
            return user.profile if user and hasattr(user, 'profile') else {}
        except Exception as e:
            logger.error(f"Long-term Memory Error: {e}")
            return {}

    async def save_message(self, session_id: str, role: str, content: str, user_id: str, metadata: Optional[Dict] = None) -> str:
        """保存消息到 Redis (短期) 和 DB (中期)"""
        if not settings.MEMORY_ENABLE:
            return ""

        try:
            # 1. Save to Redis (Short-term)
            key = f"session:{session_id}:history"
            message_data = {"role": role, "content": content, "metadata": metadata}
            async with self.redis.pipeline() as pipe:
                await pipe.lpush(key, json.dumps(message_data))
                await pipe.ltrim(key, 0, settings.SHORT_TERM_MEMORY_MAX_SIZE - 1)
                await pipe.expire(key, settings.SHORT_TERM_MEMORY_TTL_SECONDS)
                await pipe.execute()

            # 2. Save to DB (Mid-term)
            # Calculate embedding if enabled
            embedding = None
            if settings.MID_TERM_MEMORY_ENABLE_EMBEDDING and content.strip():
                try:
                    embedding = await vector_service.embed_query(content)
                except Exception as e:
                    logger.error(f"Failed to generate embedding for message: {e}")

            db_msg = Message(
                session_id=session_id,
                role=role,
                content=content,
                metadata_=metadata or {},
                embedding=embedding
            )
            self.db.add(db_msg)
            await self.db.commit()
            
            return str(db_msg.id)
            
        except Exception as e:
            logger.error(f"Save Memory Error: {e}")
            await self.db.rollback()
            return ""

    async def cleanup_old_messages(self, retention_days: int = None):
        """
        清理过期的中期记忆
        :param retention_days: 保留天数，默认使用配置值
        """
        days = retention_days or settings.MID_TERM_MEMORY_AUTO_CLEANUP_DAYS
        if days <= 0:
            return

        try:
            cutoff_date = datetime.datetime.utcnow() - datetime.timedelta(days=days)
            
            # SQLAlchemy Delete
            # Note: We should be careful with cascading deletes if any.
            # Assuming Message table is standalone-ish or cascades are set.
            from sqlalchemy import delete
            stmt = delete(Message).where(Message.created_at < cutoff_date)
            
            result = await self.db.execute(stmt)
            await self.db.commit()
            
            logger.info(f"Cleaned up {result.rowcount} old messages (older than {days} days)")
            
        except Exception as e:
            logger.error(f"Memory Cleanup Error: {e}")
            await self.db.rollback()
