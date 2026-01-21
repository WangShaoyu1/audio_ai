
import asyncio
import os
import sys

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.vector_service import VectorService
from app.core.config import settings

async def test_ollama_embedding():
    print(f"Testing Ollama Embedding...")
    print(f"OLLAMA_API_BASE: {settings.OLLAMA_API_BASE}")
    
    service = VectorService()
    
    try:
        # Try to get instance
        # Note: You need to have 'nomic-embed-text' or similar model pulled in Ollama
        # Default might be 'llama2' which is not good for embedding, usually use 'nomic-embed-text'
        # Let's try with the model passed in arguments or default
        model = "nomic-embed-text" 
        print(f"Using model: {model}")
        
        texts = ["Hello world", "This is a test"]
        embeddings = await service.embed_documents(texts, provider="ollama", model=model)
        
        print(f"Success! Got {len(embeddings)} embeddings.")
        print(f"Embedding dimension: {len(embeddings[0])}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_ollama_embedding())
