
import sys
import os

# Add project root to path
sys.path.append(os.getcwd())

try:
    print("Attempting to import app.main...")
    from app.main import app
    print("Import successful!")
    
    print("Attempting to create LLM...")
    from app.core.llm_factory import LLMFactory
    from app.core.config import settings
    
    provider = settings.DEFAULT_LLM_PROVIDER
    model = settings.DEFAULT_LLM_MODEL
    print(f"Default provider: {provider}, model: {model}")
    
    llm = LLMFactory.create_llm(provider, model)
    print("LLM creation successful!")
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
