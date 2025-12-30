from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Voice Assistant"
    API_V1_STR: str = "/api/v1"
    
    # Database
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "password"
    POSTGRES_DB: str = "ai_voice_db"
    POSTGRES_PORT: int = 5432
    
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
    
    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    
    # LLM
    OPENAI_API_KEY: str
    OPENAI_API_BASE: str = "https://api.openai.com/v1"
    LLM_MODEL_INSTRUCTION: str = "gpt-3.5-turbo"
    LLM_MODEL_RAG: str = "gpt-4-turbo"
    LLM_MODEL_CHAT: str = "gpt-3.5-turbo"
    
    # Feature Flags
    RAG_ENABLE: bool = True
    MEMORY_ENABLE: bool = True
    
    class Config:
        env_file = ".env"

settings = Settings()
