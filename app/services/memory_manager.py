import json
from typing import List, Dict
import redis.asyncio as redis
from app.core.config import settings

class MemoryManager:
    def __init__(self):
        self.redis = redis.from_url(f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}")
        
    async def get_short_term_memory(self, session_id: str) -> List[Dict]:
        if not settings.MEMORY_ENABLE:
            return []
        
        try:
            key = f"session:{session_id}:history"
            raw_data = await self.redis.lrange(key, 0, -1)
            return [json.loads(item) for item in raw_data][::-1] # Reverse to chronological order
        except Exception as e:
            print(f"Memory Error: {e}")
            return []

    async def save_message(self, session_id: str, role: str, content: str):
        if not settings.MEMORY_ENABLE:
            return

        try:
            key = f"session:{session_id}:history"
            message = json.dumps({"role": role, "content": content})
            async with self.redis.pipeline() as pipe:
                await pipe.lpush(key, message)
                await pipe.ltrim(key, 0, 9) # Keep last 10 messages
                await pipe.expire(key, 1800) # 30 min TTL
                await pipe.execute()
        except Exception as e:
            print(f"Save Memory Error: {e}")
