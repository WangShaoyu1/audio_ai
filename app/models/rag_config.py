from sqlalchemy import Column, String, Boolean, Float, Integer, ForeignKey
from app.models.base import Base, UUID_TYPE
import uuid
from pydantic import BaseModel
from typing import Optional

class RAGConfig(Base):
    __tablename__ = "rag_configs"

    id = Column(UUID_TYPE, primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID_TYPE, ForeignKey("users.id"), unique=True, nullable=False)
    
    # Indexing Mode: 'high_quality', 'economy'
    index_mode = Column(String, default="high_quality")
    
    # Retrieval Settings: 'vector', 'full_text', 'hybrid'
    retrieval_mode = Column(String, default="hybrid")
    
    # Rerank Settings
    rerank_enabled = Column(Boolean, default=True)
    rerank_model = Column(String, default="bce-reranker-base_v1")
    top_k = Column(Integer, default=5)
    score_threshold = Column(Float, default=0.35)
    
    # Embedding Model (Optional, for future extension)
    embedding_model = Column(String, default="text-embedding-3-large")

class RAGConfigBase(BaseModel):
    index_mode: Optional[str] = "high_quality"
    retrieval_mode: Optional[str] = "hybrid"
    rerank_enabled: Optional[bool] = True
    rerank_model: Optional[str] = "bce-reranker-base_v1"
    top_k: Optional[int] = 5
    score_threshold: Optional[float] = 0.35
    embedding_model: Optional[str] = "text-embedding-3-large"

class RAGConfigUpdate(RAGConfigBase):
    pass

class RAGConfigResponse(RAGConfigBase):
    id: uuid.UUID
    user_id: uuid.UUID

    class Config:
        from_attributes = True
