from typing import List
from langchain_openai import OpenAIEmbeddings
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.base import DocumentChunk
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class RAGEngine:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.embeddings = OpenAIEmbeddings(
            api_key=settings.OPENAI_API_KEY,
            base_url=settings.OPENAI_API_BASE
        )
    
    async def search(self, query: str, top_k: int = 3) -> List[str]:
        if not settings.RAG_ENABLE:
            return []
            
        try:
            # 1. Generate Embedding
            query_embedding = await self.embeddings.aembed_query(query)
            
            # 2. Vector Search using pgvector
            # Note: This requires pgvector extension installed in DB
            stmt = select(DocumentChunk).order_by(
                DocumentChunk.embedding.cosine_distance(query_embedding)
            ).limit(top_k)
            
            result = await self.db.execute(stmt)
            chunks = result.scalars().all()
            
            return [chunk.content for chunk in chunks]
            
        except Exception as e:
            logger.error(f"RAG Search Error: {e}")
            # Fallback: return empty list to trigger dynamic downgrade
            return []

    async def index_document(self, doc_id: str, content: str):
        """
        Simple indexing logic: split by newline and save
        In production, use LangChain TextSplitters
        """
        try:
            chunks = content.split('\n\n')
            for idx, text in enumerate(chunks):
                if not text.strip():
                    continue
                    
                embedding = await self.embeddings.aembed_query(text)
                chunk = DocumentChunk(
                    doc_id=doc_id,
                    content=text,
                    chunk_index=idx,
                    embedding=embedding
                )
                self.db.add(chunk)
            
            await self.db.commit()
        except Exception as e:
            logger.error(f"Indexing Error: {e}")
            await self.db.rollback()
