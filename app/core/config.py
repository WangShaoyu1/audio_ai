from pydantic_settings import BaseSettings
from typing import Optional, Dict, Any
from pydantic import field_validator

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Voice Solution"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = "your-secret-key-should-be-changed-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Region & Endpoint Configuration
    USE_GLOBAL_ENDPOINTS: bool = False

    # Database
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: Optional[str] = None
    POSTGRES_DB: str = "audio_ai"
    POSTGRES_PORT: int = 5432
    
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        if self.POSTGRES_PASSWORD:
            return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        return f"postgresql+asyncpg://{self.POSTGRES_USER}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
    
    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    
    # Web Search Configuration
    SEARCH_PROVIDER: str = "duckduckgo"
    TAVILY_API_KEY: Optional[str] = None
    SERPER_API_KEY: Optional[str] = None
    
    # LLM Provider Configs
    AZURE_OPENAI_API_KEY: Optional[str] = None
    AZURE_OPENAI_API_BASE: Optional[str] = None
    AZURE_OPENAI_API_BASE_GLOBAL: Optional[str] = None
    AZURE_OPENAI_API_VERSION: str = "2023-05-15"
    AZURE_DEPLOYMENT_NAME: Optional[str] = None
    
    QWEN_API_KEY: Optional[str] = None
    QWEN_API_BASE: Optional[str] = None 
    QWEN_API_BASE_GLOBAL: Optional[str] = None
    
    MINIMAX_API_KEY: Optional[str] = None
    MINIMAX_GROUP_ID: Optional[str] = None
    MINIMAX_API_BASE: Optional[str] = None 
    MINIMAX_API_BASE_GLOBAL: Optional[str] = None
    
    DEEPSEEK_API_KEY: Optional[str] = None
    DEEPSEEK_API_BASE: str = "https://api.deepseek.com/v1"
    DEEPSEEK_API_BASE_GLOBAL: str = "https://api.deepseek.com/v1"
    
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_API_BASE: Optional[str] = None
    OPENAI_API_BASE_GLOBAL: Optional[str] = None
    
    ZHIPUAI_API_KEY: Optional[str] = None
    ZHIPUAI_API_BASE: Optional[str] = None 
    ZHIPUAI_API_BASE_GLOBAL: Optional[str] = None
    
    QIANFAN_AK: Optional[str] = None
    QIANFAN_SK: Optional[str] = None
    QIANFAN_API_BASE: Optional[str] = None 
    QIANFAN_API_BASE_GLOBAL: Optional[str] = None
    
    GOOGLE_API_KEY: Optional[str] = None
    GOOGLE_API_BASE: Optional[str] = None 
    GOOGLE_API_BASE_GLOBAL: Optional[str] = None
    
    SPARK_APP_ID: Optional[str] = None
    SPARK_API_KEY: Optional[str] = None
    SPARK_API_SECRET: Optional[str] = None
    SPARK_API_BASE: Optional[str] = None 
    SPARK_API_BASE_GLOBAL: Optional[str] = None

    # Model Selection Strategy
    DEFAULT_LLM_PROVIDER: str = "openai"
    DEFAULT_LLM_MODEL: str = "gpt-3.5-turbo"
    
    INSTRUCTION_LLM_PROVIDER: Optional[str] = None
    INSTRUCTION_LLM_MODEL: Optional[str] = None
    
    RAG_LLM_PROVIDER: Optional[str] = None
    RAG_LLM_MODEL: Optional[str] = None
    
    CHAT_LLM_PROVIDER: Optional[str] = None
    CHAT_LLM_MODEL: Optional[str] = None

    # Feature Flags
    RAG_ENABLE: bool = True
    MEMORY_ENABLE: bool = True

    @field_validator("*", mode="before")
    def empty_str_to_none(cls, v: Any) -> Any:
        if isinstance(v, str) and v.strip() == "":
            return None
        return v

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
