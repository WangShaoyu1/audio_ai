from typing import List, Dict, Any
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from app.models.base import DocumentChunk, Document
from app.models.rag_config import RAGConfig
from app.core.config import settings
from app.services.vector_service import vector_service
import logging
import uuid

logger = logging.getLogger(__name__)

class RAGEngine:
    def __init__(self, db: AsyncSession):
        self.db = db
        
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.RAG_CHUNK_SIZE,
            chunk_overlap=settings.RAG_CHUNK_OVERLAP,
            length_function=len,
        )
    
    async def get_config(self, user_id: uuid.UUID) -> RAGConfig:
        result = await self.db.execute(select(RAGConfig).filter(RAGConfig.user_id == user_id))
        config = result.scalars().first()
        if not config:
            # Create default config using settings
            config = RAGConfig(
                user_id=user_id,
                top_k=settings.RAG_TOP_K,
                retrieval_mode=settings.RAG_RETRIEVAL_MODE,
                rerank_enabled=settings.RAG_RERANK_ENABLED,
                rerank_model=settings.RAG_RERANK_MODEL
            )
            self.db.add(config)
            await self.db.commit()
            await self.db.refresh(config)
        return config

    def detect_language(self, text: str) -> str:
        """
        Simple heuristic language detection.
        Returns 'zh' if > 5% characters are Chinese, else 'en'.
        """
        if not text:
            return 'en'
        chinese_count = len([c for c in text if '\u4e00' <= c <= '\u9fff'])
        return 'zh' if (chinese_count / len(text)) > 0.05 else 'en'

    async def search(self, query: str, user_id: uuid.UUID, top_k: int = 3, doc_ids: List[uuid.UUID] = None) -> List[Any]:
        if not settings.RAG_ENABLE:
            return []
            
        try:
            # 1. Get User Config
            config = await self.get_config(user_id)
            effective_top_k = config.top_k or top_k
            
            # Results containers
            vector_results = []
            keyword_results = []
            
            # 2. Vector Search
            if config.retrieval_mode in ["vector", "hybrid"]:
                # Use global default for query embedding (or should we use config?)
                # Assuming query uses global config for now unless we store per-user embedding config
                query_embedding = await vector_service.embed_query(query)
                stmt = select(DocumentChunk).join(Document).filter(
                    Document.user_id == user_id
                )
                
                if doc_ids:
                    stmt = stmt.filter(Document.id.in_(doc_ids))
                
                stmt = stmt.order_by(
                    DocumentChunk.embedding.cosine_distance(query_embedding)
                ).limit(effective_top_k * 2) 
                
                vec_result = await self.db.execute(stmt)
                vector_results = vec_result.scalars().all()

            # 3. Keyword Search (Full Text)
            if config.retrieval_mode in ["keyword", "hybrid", "full_text"]:
                 lang = self.detect_language(query)
                 
                 stmt = select(DocumentChunk).join(Document).filter(Document.user_id == user_id)
                 if doc_ids:
                     stmt = stmt.filter(Document.id.in_(doc_ids))

                 if lang == 'zh':
                     # Use ILIKE for Chinese (Simple fallback as PG default parser is not good for Chinese)
                     stmt = stmt.filter(
                        DocumentChunk.content.ilike(f"%{query}%")
                     ).limit(effective_top_k * 2)
                 else:
                     # Using PostgreSQL to_tsvector @@ plainto_tsquery for English
                     search_query = func.plainto_tsquery('english', query)
                     search_vector = func.to_tsvector('english', DocumentChunk.content)
                     
                     stmt = stmt.filter(
                        search_vector.op('@@')(search_query)
                    ).order_by(
                        func.ts_rank(search_vector, search_query).desc()
                    ).limit(effective_top_k * 2)
                
                 kw_result = await self.db.execute(stmt)
                 keyword_results = kw_result.scalars().all()
            
            # 4. Rerank (Reciprocal Rank Fusion)
            final_chunks = self._rerank(vector_results, keyword_results, effective_top_k, config.rerank_enabled)
            
            # Return full chunk objects or structured data? 
            # Original returned List[str], but UI needs metadata.
            # Let's return List[Dict] with content and metadata
            return [
                {
                    "content": chunk.content,
                    "score": getattr(chunk, "score", None), # Score might be attached by reranker logic if modified, but RRF is abstract
                    "metadata": {
                        "chunk_id": str(chunk.id),
                        "doc_id": str(chunk.doc_id),
                        # Need to fetch filename? N+1 issue if not joined.
                        # For now, let's keep it simple.
                    }
                } 
                for chunk in final_chunks
            ]
            
        except Exception as e:
            logger.error(f"RAG Search Error: {e}")
            return []

    def _rerank(self, vector_results: List[DocumentChunk], keyword_results: List[DocumentChunk], k: int, enabled: bool) -> List[DocumentChunk]:
        """
        Simple RRF (Reciprocal Rank Fusion) Implementation
        score = 1 / (rank + 60)
        """
        # ... (rest is same, but let's attach score to object if possible)
        # Actually, SQLA models are instances. We can monkey patch or wrap.
        
        # Helper to attach score
        def attach_score(item, score):
            item.score = score
            return item

        if not enabled:
            # Fallback: Just return vector results + keyword results (deduplicated)
            seen = set()
            combined = []
            # Prioritize vector results if no rerank? Or mix?
            # Simple merge:
            for item in vector_results:
                if item.id not in seen:
                    attach_score(item, 1.0) # Dummy score
                    combined.append(item)
                    seen.add(item.id)
            for item in keyword_results:
                if item.id not in seen:
                    attach_score(item, 1.0)
                    combined.append(item)
                    seen.add(item.id)
            return combined[:k]

        # RRF Logic
        scores = {}
        
        # Process Vector Results
        for rank, item in enumerate(vector_results):
            if item.id not in scores:
                scores[item.id] = {"item": item, "score": 0}
            scores[item.id]["score"] += 1 / (rank + 60)
            
        # Process Keyword Results
        for rank, item in enumerate(keyword_results):
            if item.id not in scores:
                scores[item.id] = {"item": item, "score": 0}
            scores[item.id]["score"] += 1 / (rank + 60)
            
        # Sort by combined score
        sorted_items = sorted(scores.values(), key=lambda x: x["score"], reverse=True)
        
        return [attach_score(x["item"], x["score"]) for x in sorted_items][:k]

    async def index_document(self, doc_id: str, content: str, provider: str = None, model: str = None):
        """
        Index document content using RecursiveCharacterTextSplitter
        """
        logger.info(f"Starting indexing for doc_id: {doc_id} with {provider}/{model}")
        try:
            chunks = self.text_splitter.split_text(content)
            logger.info(f"Split content into {len(chunks)} chunks")
            
            # Batch embedding could be better here, but let's loop for now or use embed_documents
            if chunks:
                embeddings = await vector_service.embed_documents(chunks, provider=provider, model=model)
                
                for idx, (text, embedding) in enumerate(zip(chunks, embeddings)):
                    if not text.strip():
                        continue
                    
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
