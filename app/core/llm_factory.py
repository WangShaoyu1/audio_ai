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
    # Correct class name is MiniMaxChat, but keeping fallback just in case
    from langchain_community.chat_models.minimax import MiniMaxChat
except ImportError:
    try:
        from langchain_community.chat_models.minimax import ChatMinimax as MiniMaxChat
    except ImportError:
        MiniMaxChat = None

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
    def _get_base_url(provider_prefix: str) -> Optional[str]:
        """
        Helper to get the correct Base URL based on USE_GLOBAL_ENDPOINTS setting.
        Example: provider_prefix="QWEN" -> checks QWEN_API_BASE_GLOBAL or QWEN_API_BASE
        """
        prefix = provider_prefix.upper()
        if settings.USE_GLOBAL_ENDPOINTS:
            # Try to get GLOBAL url first
            global_url = getattr(settings, f"{prefix}_API_BASE_GLOBAL", None)
            if global_url:
                return global_url
            
            # Fallback to standard URL if global is not set but switch is on
            # (This handles cases where user enabled switch but didn't config global url)
            logger.warning(f"USE_GLOBAL_ENDPOINTS is True but {prefix}_API_BASE_GLOBAL is not set. Falling back to {prefix}_API_BASE.")
            
        return getattr(settings, f"{prefix}_API_BASE", None)

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
            if not settings.AZURE_DEPLOYMENT_NAME:
                missing_keys.append("AZURE_DEPLOYMENT_NAME")
            # Check for base url using the helper to account for global switch
            if not LLMFactory._get_base_url("AZURE_OPENAI"):
                 missing_keys.append("AZURE_OPENAI_API_BASE (or _GLOBAL)")
                
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
                base_url = LLMFactory._get_base_url("OPENAI")
                return ChatOpenAI(
                    api_key=settings.OPENAI_API_KEY,
                    base_url=base_url,
                    model=model_name,
                    temperature=temperature,
                    streaming=streaming
                )
            elif provider == "azure":
                LLMFactory._check_dependency(AzureChatOpenAI, "azure", "langchain-openai")
                base_url = LLMFactory._get_base_url("AZURE_OPENAI")
                return AzureChatOpenAI(
                    api_key=settings.AZURE_OPENAI_API_KEY,
                    azure_endpoint=base_url,
                    api_version=settings.AZURE_OPENAI_API_VERSION,
                    deployment_name=settings.AZURE_DEPLOYMENT_NAME,
                    temperature=temperature,
                    streaming=streaming
                )
            elif provider == "qwen":
                LLMFactory._check_dependency(ChatTongyi, "qwen")
                kwargs = {}
                # Qwen uses 'dashscope_api_base' or similar depending on version, 
                # but LangChain usually respects OPENAI_API_BASE env var if using OpenAI compatible class.
                # For ChatTongyi native class, it might not expose base_url easily in all versions.
                # However, recent versions support 'base_url' or 'dashscope_base_url'.
                # Let's try passing it via kwargs if it's set.
                base_url = LLMFactory._get_base_url("QWEN")
                if base_url:
                    # Note: ChatTongyi implementation details vary. 
                    # If using OpenAI compatible endpoint, one should use ChatOpenAI with Qwen's base URL.
                    # But here we are using ChatTongyi. Let's check if it accepts base_url.
                    # If not, we might need to set DASHSCOPE_API_BASE env var.
                    # For safety, we'll try to pass it.
                    kwargs["base_url"] = base_url
                    
                return ChatTongyi(
                    api_key=settings.QWEN_API_KEY,
                    model=model_name,
                    temperature=temperature,
                    streaming=streaming,
                    **kwargs
                )
            elif provider == "minimax":
                LLMFactory._check_dependency(MiniMaxChat, "minimax")
                kwargs = {}
                base_url = LLMFactory._get_base_url("MINIMAX")
                if base_url:
                    kwargs["minimax_api_base"] = base_url
                    
                return MiniMaxChat(
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
                base_url = LLMFactory._get_base_url("DEEPSEEK")
                return ChatOpenAI(
                    api_key=settings.DEEPSEEK_API_KEY,
                    base_url=base_url,
                    model=model_name,
                    temperature=temperature,
                    streaming=streaming
                )
            elif provider == "zhipu":
                LLMFactory._check_dependency(ChatZhipuAI, "zhipu")
                # ChatZhipuAI might not directly support base_url override in constructor in all versions
                # but usually respects ZHIPUAI_API_BASE env var.
                # We'll try passing it if supported.
                kwargs = {}
                base_url = LLMFactory._get_base_url("ZHIPUAI")
                if base_url:
                    kwargs["base_url"] = base_url

                return ChatZhipuAI(
                    api_key=settings.ZHIPUAI_API_KEY,
                    model=model_name,
                    temperature=temperature,
                    streaming=streaming,
                    **kwargs
                )
            elif provider == "qianfan":
                LLMFactory._check_dependency(QianfanChatEndpoint, "qianfan")
                kwargs = {}
                base_url = LLMFactory._get_base_url("QIANFAN")
                if base_url:
                    kwargs["endpoint"] = base_url
                    
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
                # Google usually doesn't need base_url unless using vertex or proxy
                return ChatGoogleGenerativeAI(
                    google_api_key=settings.GOOGLE_API_KEY,
                    model=model_name,
                    temperature=temperature,
                    convert_system_message_to_human=True
                )
            elif provider == "spark":
                LLMFactory._check_dependency(ChatSparkLLM, "spark")
                kwargs = {}
                base_url = LLMFactory._get_base_url("SPARK")
                if base_url:
                    kwargs["spark_api_url"] = base_url
                    
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
