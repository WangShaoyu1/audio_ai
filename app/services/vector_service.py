import logging
import random
from typing import List, Optional, Type, Any, Union

from langchain_openai import OpenAIEmbeddings
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select

from app.core.config import settings

logger = logging.getLogger(__name__)

class VectorService:
    """
    Public Service for Vector Operations.
    Handles:
    1. Embedding Generation (Vectorization)
    2. Vector Search / Retrieval
    """
    def __init__(self):
        # Initialize default embeddings
        self.default_embeddings = self._get_embeddings_instance()

    def _get_embeddings_instance(self, provider: str = None, model: str = None):
        """Get an embedding instance for specific provider/model or default."""
        provider = (provider or settings.EMBEDDING_PROVIDER).lower()
        model = model or settings.EMBEDDING_MODEL
        
        # Determine API Key and Base
        api_key = settings.EMBEDDING_API_KEY or settings.OPENAI_API_KEY
        api_base = settings.EMBEDDING_API_BASE or settings.OPENAI_API_BASE

        # logger.info(f"Getting Embeddings Instance: {provider}, Model: {model}")

        if provider == "openai":
            if not api_key:
                raise ValueError("OpenAI API Key not found for embeddings.")
            
            return OpenAIEmbeddings(
                openai_api_key=api_key,
                openai_api_base=api_base,
                model=model
            )
        elif provider == "ollama":
            try:
                from langchain_ollama import OllamaEmbeddings
            except ImportError:
                try:
                    from langchain_community.embeddings import OllamaEmbeddings
                except ImportError:
                    raise ImportError("langchain-ollama or langchain-community is required for Ollama embeddings. Please install it.")
                
            return OllamaEmbeddings(
                base_url=settings.OLLAMA_API_BASE,
                model=model
            )
        else:
            raise ValueError(f"Unsupported embedding provider '{provider}'")

    async def embed_query(self, text: str, provider: str = None, model: str = None) -> List[float]:
        """Vectorize a single query string."""
        if not text:
            return []
        try:
            instance = self._get_embeddings_instance(provider, model)
            return await instance.aembed_query(text)
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            raise e

    async def embed_documents(self, texts: List[str], provider: str = None, model: str = None) -> List[List[float]]:
        """Vectorize a list of documents."""
        if not texts:
            return []
        try:
            instance = self._get_embeddings_instance(provider, model)
            return await instance.aembed_documents(texts)
        except Exception as e:
            logger.error(f"Document embedding generation failed: {e}")
            raise e

    async def search(
        self, 
        db: AsyncSession, 
        model_class: Type[Any], 
        query_vector: List[float], 
        filters: Optional[List[Any]] = None, 
        limit: int = 5,
        vector_col_name: str = "embedding"
    ) -> List[Any]:
        """
        Generic Vector Search.
        
        :param db: Database Session
        :param model_class: SQLAlchemy Model class (e.g., Message, DocumentChunk)
        :param query_vector: The query embedding vector
        :param filters: List of SQLAlchemy filter expressions (e.g., [Message.session_id == '...'])
        :param limit: Number of results to return
        :param vector_col_name: Name of the vector column in the model (default: "embedding")
        :return: List of model instances
        """
        try:
            vector_col = getattr(model_class, vector_col_name)
            
            # Base Statement
            stmt = select(model_class)
            
            # Apply Filters
            if filters:
                for condition in filters:
                    stmt = stmt.filter(condition)
            
            # Apply Vector Similarity Sort (Cosine Distance)
            # Note: pgvector uses <=> for cosine distance (lower is better)
            stmt = stmt.order_by(vector_col.cosine_distance(query_vector)).limit(limit)
            
            result = await db.execute(stmt)
            return result.scalars().all()
            
        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            return []

# Singleton Instance
vector_service = VectorService()
