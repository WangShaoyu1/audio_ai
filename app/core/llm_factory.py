from typing import Optional, Any
import logging

# Standard LangChain imports (Core packages usually present)
try:
    from langchain_openai import ChatOpenAI, AzureChatOpenAI
except ImportError:
    ChatOpenAI = None
    AzureChatOpenAI = None

try:
    from langchain_google_genai import ChatGoogleGenerativeAI
except ImportError:
    ChatGoogleGenerativeAI = None

# Community imports - using safe imports to avoid IDE errors and runtime crashes
# if specific provider packages are missing
try:
    from langchain_community.chat_models.tongyi import ChatTongyi
except ImportError:
    ChatTongyi = None

try:
    from langchain_community.chat_models.minimax import ChatMinimax
except ImportError:
    ChatMinimax = None

try:
    from langchain_community.chat_models.zhipuai import ChatZhipuAI
except ImportError:
    ChatZhipuAI = None

try:
    # Try importing SparkLLM from various possible locations or ignore if missing
    from langchain_community.chat_models.sparkllm import ChatSparkLLM
except ImportError:
    try:
        # Fallback for older versions
        from langchain_community.chat_models import ChatSparkLLM
    except ImportError:
        ChatSparkLLM = None

try:
    from langchain_community.chat_models.baidu_qianfan_endpoint import QianfanChatEndpoint
except ImportError:
    QianfanChatEndpoint = None

from app.core.config import settings

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
    def _check_dependency(cls_obj: Any, provider_name: str, package_hint: str = "langchain-community"):
        """
        Check if the model class was successfully imported.
        """
        if cls_obj is None:
            raise ImportError(
                f"Could not import the class for provider '{provider_name}'. "
                f"Please ensure '{package_hint}' is installed and up to date."
            )

    @staticmethod
    def create_llm(provider: str, model_name: str, temperature: float = 0.1, streaming: bool = False):
        provider = provider.lower()
        
        # Validate config before attempting to create LLM
        LLMFactory._validate_config(provider)
        
        try:
            if provider == "openai":
                LLMFactory._check_dependency(ChatOpenAI, "openai", "langchain-openai")
                return ChatOpenAI(
                    api_key=settings.OPENAI_API_KEY,
                    base_url=settings.OPENAI_API_BASE,
                    model=model_name,
                    temperature=temperature,
                    streaming=streaming
                )
            elif provider == "azure":
                LLMFactory._check_dependency(AzureChatOpenAI, "azure", "langchain-openai")
                return AzureChatOpenAI(
                    api_key=settings.AZURE_OPENAI_API_KEY,
                    azure_endpoint=settings.AZURE_OPENAI_API_BASE,
                    api_version=settings.AZURE_OPENAI_API_VERSION,
                    deployment_name=settings.AZURE_DEPLOYMENT_NAME,
                    temperature=temperature,
                    streaming=streaming
                )
            elif provider == "qwen":
                LLMFactory._check_dependency(ChatTongyi, "qwen")
                kwargs = {}
                return ChatTongyi(
                    api_key=settings.QWEN_API_KEY,
                    model=model_name,
                    temperature=temperature,
                    streaming=streaming,
                    **kwargs
                )
            elif provider == "minimax":
                LLMFactory._check_dependency(ChatMinimax, "minimax")
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
                LLMFactory._check_dependency(ChatOpenAI, "deepseek", "langchain-openai")
                return ChatOpenAI(
                    api_key=settings.DEEPSEEK_API_KEY,
                    base_url=settings.DEEPSEEK_API_BASE,
                    model=model_name,
                    temperature=temperature,
                    streaming=streaming
                )
            elif provider == "zhipu":
                LLMFactory._check_dependency(ChatZhipuAI, "zhipu")
                return ChatZhipuAI(
                    api_key=settings.ZHIPUAI_API_KEY,
                    model=model_name,
                    temperature=temperature,
                    streaming=streaming
                )
            elif provider == "qianfan":
                LLMFactory._check_dependency(QianfanChatEndpoint, "qianfan")
                kwargs = {}
                if settings.QIANFAN_API_BASE:
                    kwargs["endpoint"] = settings.QIANFAN_API_BASE
                    
                return QianfanChatEndpoint(
                    qianfan_ak=settings.QIANFAN_AK,
                    qianfan_sk=settings.QIANFAN_SK,
                    model=model_name,
                    temperature=temperature,
                    streaming=streaming,
                    **kwargs
                )
            elif provider == "google":
                LLMFactory._check_dependency(ChatGoogleGenerativeAI, "google", "langchain-google-genai")
                return ChatGoogleGenerativeAI(
                    google_api_key=settings.GOOGLE_API_KEY,
                    model=model_name,
                    temperature=temperature,
                    convert_system_message_to_human=True
                )
            elif provider == "spark":
                LLMFactory._check_dependency(ChatSparkLLM, "spark")
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
