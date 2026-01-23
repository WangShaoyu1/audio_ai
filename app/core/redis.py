import redis.asyncio as redis
from app.core.config import settings
from typing import Optional
import logging

logger = logging.getLogger(__name__)

class RedisClient:
    _instance: Optional[redis.Redis] = None

    @classmethod
    def get_instance(cls) -> redis.Redis:
        if cls._instance is None:
            logger.info(f"Connecting to Redis at {settings.REDIS_HOST}:{settings.REDIS_PORT}")
            cls._instance = redis.from_url(
                f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}",
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=5.0,  # Increased timeout
                # socket_keepalive=True 
            )
        return cls._instance

    @classmethod
    async def close(cls):
        if cls._instance:
            logger.info("Closing Redis connection...")
            await cls._instance.aclose()
            cls._instance = None
