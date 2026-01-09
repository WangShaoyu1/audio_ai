from typing import List, Dict, Any
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.base import DocumentChunk, Document
from app.models.rag_config import RAGConfig
from app.core.config import settings
import logging
import uuid
import random

logger = logging.getLogger(__name__)

class MockEmbeddings:
    async def aembed_query(self, text: str) -> List[float]:
        # Return a random vector of size 1536
        return [random.random() for _ in range(1536)]

    async def aembed_documents(self, texts: List[str]) -> List[List[float]]:
        return [await self.aembed_query(text) for text in texts]

class RAGEngine:
    def __init__(self, db: AsyncSession):
        self.db = db
        logger.info(f"OPENAI_API_KEY present: {bool(settings.OPENAI_API_KEY)}")
        # Force MockEmbeddings for debugging
        logger.warning("Forcing MockEmbeddings for debugging.")
        self.embeddings = MockEmbeddings()
        
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
        )
    
    async def get_config(self, user_id: uuid.UUID) -> RAGConfig:
        result = await self.db.execute(select(RAGConfig).filter(RAGConfig.user_id == user_id))
        config = result.scalars().first()
        if not config:
            # Create default config
            config = RAGConfig(user_id=user_id)
            self.db.add(config)
            await self.db.commit()
            await self.db.refresh(config)
        return config

    async def search(self, query: str, user_id: uuid.UUID, top_k: int = 3) -> List[str]:
        if not settings.RAG_ENABLE:
            return []
            
        try:
            # 1. Get User Config
            config = await self.get_config(user_id)
            
            # 2. Generate Embedding
            query_embedding = await self.embeddings.aembed_query(query)
            
            # 3. Vector Search (Scoped to User)
            # Join DocumentChunk -> Document to filter by user_id
            stmt = select(DocumentChunk).join(Document).filter(
                Document.user_id == user_id
            ).order_by(
                DocumentChunk.embedding.cosine_distance(query_embedding)
            ).limit(config.top_k or top_k)
            
            result = await self.db.execute(stmt)
            chunks = result.scalars().all()
            
            # TODO: Implement Hybrid Search & Rerank based on config.retrieval_mode
            
            return [chunk.content for chunk in chunks]
            
        except Exception as e:
            logger.error(f"RAG Search Error: {e}")
            return []

    async def index_document(self, doc_id: str, content: str):
        """
        Index document content using RecursiveCharacterTextSplitter
        """
        logger.info(f"Starting indexing for doc_id: {doc_id}")
        try:
            chunks = self.text_splitter.split_text(content)
            logger.info(f"Split content into {len(chunks)} chunks")
            
            for idx, text in enumerate(chunks):
                if not text.strip():
                    continue
                
                logger.info(f"Embedding chunk {idx}")
                embedding = await self.embeddings.aembed_query(text)
                chunk = DocumentChunk(
                    doc_id=doc_id,
                    content=text,
                    chunk_index=idx,
                    embedding=embedding
                )
                self.db.add(chunk)
            
            logger.info("Committing chunks to database")
            await self.db.commit()
            logger.info("Indexing completed successfully")
        except Exception as e:
            logger.error(f"Indexing Error: {e}")
            await self.db.rollback()
            raise e
