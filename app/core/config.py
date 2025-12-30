from pydantic_settings import BaseSettings
from typing import Optional, Dict, Any

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Voice Solution"
    API_V1_STR: str = "/api/v1"
    
    # Database
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "password"
    POSTGRES_DB: str = "audio_ai"
    POSTGRES_PORT: int = 5432
    
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
    
    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    
    # LLM Provider Configs
    # Azure OpenAI
    AZURE_OPENAI_API_KEY: Optional[str] = None
    AZURE_OPENAI_API_BASE: Optional[str] = None
    AZURE_OPENAI_API_VERSION: str = "2023-05-15"
    AZURE_DEPLOYMENT_NAME: Optional[str] = None
    
    # Qwen (Aliyun)
    QWEN_API_KEY: Optional[str] = None
    
    # Minimax
    MINIMAX_API_KEY: Optional[str] = None
    MINIMAX_GROUP_ID: Optional[str] = None
    
    # Deepseek
    DEEPSEEK_API_KEY: Optional[str] = None
    
    # OpenAI
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_API_BASE: Optional[str] = None
    
    # Zhipu AI (GLM)
    ZHIPUAI_API_KEY: Optional[str] = None
    
    # Baidu Wenxin
    QIANFAN_AK: Optional[str] = None
    QIANFAN_SK: Optional[str] = None
    
    # Google Gemini
    GOOGLE_API_KEY: Optional[str] = None
    
    # Xunfei Spark
    SPARK_APP_ID: Optional[str] = None
    SPARK_API_KEY: Optional[str] = None
    SPARK_API_SECRET: Optional[str] = None

    # Model Selection Strategy
    # Default model provider and name
    DEFAULT_LLM_PROVIDER: str = "openai" # azure, qwen, minimax, deepseek, openai, zhipu, qianfan, google, spark
    DEFAULT_LLM_MODEL: str = "gpt-3.5-turbo"
    
    # Scenario-specific overrides (Optional)
    INSTRUCTION_LLM_PROVIDER: Optional[str] = None
    INSTRUCTION_LLM_MODEL: Optional[str] = None
    
    RAG_LLM_PROVIDER: Optional[str] = None
    RAG_LLM_MODEL: Optional[str] = None
    
    CHAT_LLM_PROVIDER: Optional[str] = None
    CHAT_LLM_MODEL: Optional[str] = None

    # Feature Flags
    RAG_ENABLE: bool = True
    MEMORY_ENABLE: bool = True

    class Config:
        env_file = ".env"

settings = Settings()
