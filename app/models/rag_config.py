from sqlalchemy import Column, String, Boolean, Float, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base
import uuid

class RAGConfig(Base):
    __tablename__ = "rag_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    
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
