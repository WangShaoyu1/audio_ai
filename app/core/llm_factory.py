from typing import Optional
from langchain_openai import ChatOpenAI, AzureChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_community.chat_models import ChatTongyi, ChatMinimax, ChatZhipuAI, ChatSparkLLM, ChatBaiduQianfan
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class LLMFactory:
    @staticmethod
    def _validate_config(provider: str):
        """
        Validate if the required configuration for the provider is present.
        Raises ValueError with a clear message if config is missing.
        """
        missing_keys = []
        
        if provider == "openai":
            if not settings.OPENAI_API_KEY:
                missing_keys.append("OPENAI_API_KEY")
        
        elif provider == "azure":
            if not settings.AZURE_OPENAI_API_KEY:
                missing_keys.append("AZURE_OPENAI_API_KEY")
            if not settings.AZURE_OPENAI_API_BASE:
                missing_keys.append("AZURE_OPENAI_API_BASE")
            if not settings.AZURE_DEPLOYMENT_NAME:
                missing_keys.append("AZURE_DEPLOYMENT_NAME")
                
        elif provider == "qwen":
            if not settings.QWEN_API_KEY:
                missing_keys.append("QWEN_API_KEY")
                
        elif provider == "minimax":
            if not settings.MINIMAX_API_KEY:
                missing_keys.append("MINIMAX_API_KEY")
            if not settings.MINIMAX_GROUP_ID:
                missing_keys.append("MINIMAX_GROUP_ID")
                
        elif provider == "deepseek":
            if not settings.DEEPSEEK_API_KEY:
                missing_keys.append("DEEPSEEK_API_KEY")
                
        elif provider == "zhipu":
            if not settings.ZHIPUAI_API_KEY:
                missing_keys.append("ZHIPUAI_API_KEY")
                
        elif provider == "qianfan":
            if not settings.QIANFAN_AK:
                missing_keys.append("QIANFAN_AK")
            if not settings.QIANFAN_SK:
                missing_keys.append("QIANFAN_SK")
                
        elif provider == "google":
            if not settings.GOOGLE_API_KEY:
                missing_keys.append("GOOGLE_API_KEY")
                
        elif provider == "spark":
            if not settings.SPARK_APP_ID:
                missing_keys.append("SPARK_APP_ID")
            if not settings.SPARK_API_KEY:
                missing_keys.append("SPARK_API_KEY")
            if not settings.SPARK_API_SECRET:
                missing_keys.append("SPARK_API_SECRET")

        if missing_keys:
            raise ValueError(
                f"Missing configuration for provider '{provider}': {', '.join(missing_keys)}. "
                f"Please check your .env file."
            )

    @staticmethod
    def create_llm(provider: str, model_name: str, temperature: float = 0.1, streaming: bool = False):
        provider = provider.lower()
        
        # Validate config before attempting to create LLM
        LLMFactory._validate_config(provider)
        
        try:
            if provider == "openai":
                return ChatOpenAI(
                    api_key=settings.OPENAI_API_KEY,
                    base_url=settings.OPENAI_API_BASE,
                    model=model_name,
                    temperature=temperature,
                    streaming=streaming
                )
            elif provider == "azure":
                return AzureChatOpenAI(
                    api_key=settings.AZURE_OPENAI_API_KEY,
                    azure_endpoint=settings.AZURE_OPENAI_API_BASE,
                    api_version=settings.AZURE_OPENAI_API_VERSION,
                    deployment_name=settings.AZURE_DEPLOYMENT_NAME,
                    temperature=temperature,
                    streaming=streaming
                )
            elif provider == "qwen":
                # LangChain's ChatTongyi supports 'base_url' if needed, 
                # but usually it's handled by DASHSCOPE_HTTP_BASE_URL env var if using dashscope SDK directly.
                # However, we can pass extra kwargs if the wrapper supports it.
                # Checking source, ChatTongyi doesn't expose base_url directly in init, 
                # but we can try passing it if the underlying SDK supports it via environment variable injection
                # or if we are using an OpenAI-compatible endpoint for Qwen.
                # For standard Dashscope usage, base_url is rarely changed unless using private deployment.
                kwargs = {}
                if settings.QWEN_API_BASE:
                    # Some versions of ChatTongyi might support this, or we might need to set env var
                    # For safety, we'll set it as an attribute if the class allows, or use OpenAI adapter if Qwen provides one.
                    # Assuming standard usage for now, but if user provides base_url, we try to respect it.
                    pass 
                
                return ChatTongyi(
                    api_key=settings.QWEN_API_KEY,
                    model=model_name,
                    temperature=temperature,
                    streaming=streaming,
                    **kwargs
                )
            elif provider == "minimax":
                kwargs = {}
                if settings.MINIMAX_API_BASE:
                    kwargs["minimax_api_base"] = settings.MINIMAX_API_BASE
                    
                return ChatMinimax(
                    minimax_api_key=settings.MINIMAX_API_KEY,
                    minimax_group_id=settings.MINIMAX_GROUP_ID,
                    model=model_name,
                    temperature=temperature,
                    streaming=streaming,
                    **kwargs
                )
            elif provider == "deepseek":
                # Deepseek is OpenAI compatible
                return ChatOpenAI(
                    api_key=settings.DEEPSEEK_API_KEY,
                    base_url=settings.DEEPSEEK_API_BASE,
                    model=model_name,
                    temperature=temperature,
                    streaming=streaming
                )
            elif provider == "zhipu":
                # ChatZhipuAI might not expose base_url directly in all versions
                return ChatZhipuAI(
                    api_key=settings.ZHIPUAI_API_KEY,
                    model=model_name,
                    temperature=temperature,
                    streaming=streaming
                )
            elif provider == "qianfan":
                kwargs = {}
                if settings.QIANFAN_API_BASE:
                    # Qianfan SDK usually handles this via config, but we can try passing endpoint
                    pass
                    
                return ChatBaiduQianfan(
                    qianfan_ak=settings.QIANFAN_AK,
                    qianfan_sk=settings.QIANFAN_SK,
                    model=model_name,
                    temperature=temperature,
                    streaming=streaming,
                    **kwargs
                )
            elif provider == "google":
                return ChatGoogleGenerativeAI(
                    google_api_key=settings.GOOGLE_API_KEY,
                    model=model_name,
                    temperature=temperature,
                    convert_system_message_to_human=True
                )
            elif provider == "spark":
                kwargs = {}
                if settings.SPARK_API_BASE:
                    kwargs["spark_api_url"] = settings.SPARK_API_BASE
                    
                return ChatSparkLLM(
                    app_id=settings.SPARK_APP_ID,
                    api_key=settings.SPARK_API_KEY,
                    api_secret=settings.SPARK_API_SECRET,
                    model=model_name,
                    temperature=temperature,
                    streaming=streaming,
                    **kwargs
                )
            else:
                raise ValueError(f"Unsupported LLM provider: {provider}")
                
        except Exception as e:
            logger.error(f"Failed to create LLM for provider {provider}: {e}")
            raise

    @staticmethod
    def get_llm_for_scenario(scenario: str):
        """
        Get LLM instance based on scenario configuration
        scenarios: 'instruction', 'rag', 'chat'
        """
        provider = getattr(settings, f"{scenario.upper()}_LLM_PROVIDER") or settings.DEFAULT_LLM_PROVIDER
        model = getattr(settings, f"{scenario.upper()}_LLM_MODEL") or settings.DEFAULT_LLM_MODEL
        
        # Adjust temperature based on scenario
        temp = 0.1 if scenario == "instruction" else 0.7
        
        return LLMFactory.create_llm(provider, model, temperature=temp)
