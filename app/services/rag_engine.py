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

    async def _get_active_models(self, user_id: uuid.UUID, doc_ids: List[uuid.UUID] = None) -> List[Dict[str, str]]:
        """
        Identify distinct (provider, model) pairs used in the user's documents.
        """
        stmt = select(Document.provider, Document.model).filter(Document.user_id == user_id)
        
        if doc_ids:
            stmt = stmt.filter(Document.id.in_(doc_ids))
            
        stmt = stmt.group_by(Document.provider, Document.model)
        result = await self.db.execute(stmt)
        rows = result.all()
        
        models = []
        for r in rows:
            provider = r[0]
            model = r[1]
            # Handle legacy data or missing config -> use defaults
            if not provider:
                provider = settings.EMBEDDING_PROVIDER
            if not model:
                model = settings.EMBEDDING_MODEL
            
            models.append({"provider": provider, "model": model})
            
        # Deduplicate
        unique_models = []
        seen = set()
        for m in models:
            key = (m["provider"], m["model"])
            if key not in seen:
                seen.add(key)
                unique_models.append(m)
                
        return unique_models

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
            
            # 2. Vector Search (Multi-Path)
            if config.retrieval_mode in ["vector", "hybrid"]:
                # Identify which embedding models are needed
                active_models = await self._get_active_models(user_id, doc_ids)
                
                if not active_models:
                    # No documents or no models found?
                    # Fallback to default just in case
                    active_models = [{"provider": settings.EMBEDDING_PROVIDER, "model": settings.EMBEDDING_MODEL}]

                import asyncio
                
                # Helper for parallel execution
                async def fetch_results_for_model(model_config):
                    provider = model_config["provider"]
                    model = model_config["model"]
                    
                    try:
                        # a. Generate Query Embedding for this specific model
                        query_embedding = await vector_service.embed_query(query, provider=provider, model=model)
                        
                        # b. Search only documents that match this provider/model
                        stmt = select(DocumentChunk).join(Document).filter(
                            Document.user_id == user_id
                        )
                        
                        # Handle Null/Default matching logic if needed, 
                        # but for now assuming data is clean or we rely on exact match.
                        # For legacy data where provider is NULL, we might miss it if we strictly filter.
                        # Let's assume _get_active_models handled the defaults logic for identification,
                        # but for querying we need to match what's in DB.
                        # If DB has NULL, we should query where provider IS NULL.
                        # But vector_service.embed_query needs explicit provider.
                        # Complex: If DB has NULL, we assume it used Default settings. 
                        # So if model_config == Default, we search (provider==Default OR provider IS NULL).
                        
                        # Simplified Logic:
                        # We search based on what we found in DB.
                        # If we found (None, None) in DB, we use Default for embedding, 
                        # and search for (provider IS NULL OR provider='')
                        
                        filters = []
                        if doc_ids:
                            filters.append(Document.id.in_(doc_ids))
                            
                        # Provider Filter
                        if provider == settings.EMBEDDING_PROVIDER:
                            # Match explicit OR null/empty (legacy compatibility)
                            filters.append((Document.provider == provider) | (Document.provider == None) | (Document.provider == ''))
                        else:
                            filters.append(Document.provider == provider)
                            
                        # Model Filter
                        if model == settings.EMBEDDING_MODEL:
                             filters.append((Document.model == model) | (Document.model == None) | (Document.model == ''))
                        else:
                            filters.append(Document.model == model)
                            
                        stmt = stmt.filter(*filters)
                        
                        stmt = stmt.order_by(
                            DocumentChunk.embedding.cosine_distance(query_embedding)
                        ).limit(effective_top_k * 2) 
                        
                        res = await self.db.execute(stmt)
                        return res.scalars().all()
                        
                    except Exception as ex:
                        logger.error(f"Search failed for model {provider}/{model}: {ex}")
                        # Re-raise to let the caller know search failed due to error, not just empty
                        raise ex

                # Execute all model searches in parallel
                tasks = [fetch_results_for_model(m) for m in active_models]
                # return_exceptions=True so we can check if any failed
                results_list_or_errors = await asyncio.gather(*tasks, return_exceptions=True)
                
                # Check for errors
                results_list = []
                for res in results_list_or_errors:
                    if isinstance(res, Exception):
                        logger.error(f"One of the search tasks failed: {res}")
                        # If all fail, we might want to raise. If partial fail, maybe continue?
                        # For now, if any fails, it might indicate service issue. 
                        # But let's be robust: continue with successes.
                        continue
                    results_list.append(res)
                
                if not results_list and results_list_or_errors:
                     # All failed
                     if all(isinstance(x, Exception) for x in results_list_or_errors):
                         raise Exception(f"All embedding models failed. Last error: {results_list_or_errors[0]}")

                # Merge Multi-Model Results using RRF (Reciprocal Rank Fusion)
                # This ensures top results from different models are treated equally
                temp_scores = {}
                for model_results in results_list:
                    for rank, item in enumerate(model_results):
                        if item.id not in temp_scores:
                            temp_scores[item.id] = {"item": item, "score": 0}
                        # Standard RRF constant k=60
                        temp_scores[item.id]["score"] += 1 / (rank + 60)
                
                # Sort by score to get the final ranked vector results
                sorted_vector_results = sorted(temp_scores.values(), key=lambda x: x["score"], reverse=True)
                vector_results = [x["item"] for x in sorted_vector_results]

            # 3. Keyword Search (Full Text)


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
            
            # Return structured data
            formatted_results = []
            for chunk in final_chunks:
                # Ensure score is float
                score = getattr(chunk, "score", 0.0)
                formatted_results.append({
                    "id": str(chunk.id),
                    "doc_id": str(chunk.doc_id),
                    "content": chunk.content,
                    "score": float(score),
                    "metadata": {
                        "chunk_index": chunk.chunk_index
                    }
                })
            
            return formatted_results
            
        except Exception as e:
            logger.error(f"RAG Search Error: {e}")
            # Re-raise to let the API handle it
            raise e

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
            # Determine chunk size based on model
            # Some models like bge-large have smaller context windows (e.g. 512 tokens)
            # 1000 chars might exceed 512 tokens for Chinese
            chunk_size = settings.RAG_CHUNK_SIZE
            if model and ("bge" in model.lower() or "bert" in model.lower()):
                 chunk_size = 500
                 logger.info(f"Adjusting chunk_size to {chunk_size} for model {model}")

            splitter = RecursiveCharacterTextSplitter(
                chunk_size=chunk_size,
                chunk_overlap=settings.RAG_CHUNK_OVERLAP,
                length_function=len,
            )
            
            chunks = splitter.split_text(content)
            logger.info(f"Split content into {len(chunks)} chunks")
            
                # Batch embedding: Split chunks into smaller batches to avoid overloading Ollama or hitting timeouts
            if chunks:
                # Use a safe batch size
                batch_size = 10
                total_chunks = len(chunks)
                
                for i in range(0, total_chunks, batch_size):
                    batch_chunks = chunks[i:i + batch_size]
                    logger.info(f"Processing batch {i//batch_size + 1}/{(total_chunks-1)//batch_size + 1} with {len(batch_chunks)} chunks")
                    
                    try:
                        batch_embeddings = await vector_service.embed_documents(batch_chunks, provider=provider, model=model)
                        
                        # Create and add chunks for this batch
                        for j, (text, embedding) in enumerate(zip(batch_chunks, batch_embeddings)):
                            if not text.strip():
                                continue
                            
                            # Ensure embedding is a list of floats
                            if hasattr(embedding, 'tolist'):
                                embedding = embedding.tolist()
                            
                            chunk = DocumentChunk(
                                doc_id=doc_id,
                                content=text,
                                chunk_index=i + j, # Global index
                                embedding=embedding
                            )
                            self.db.add(chunk)
                        
                        # Commit after each batch
                        await self.db.commit()
                        
                    except Exception as e:
                        logger.error(f"Batch embedding/saving failed for batch starting at index {i}: {e}")
                        await self.db.rollback()
                        raise e
            
            logger.info("Indexing completed successfully")
        except Exception as e:
            logger.error(f"Indexing Error: {e}")
            await self.db.rollback()
            raise e
