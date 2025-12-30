from typing import Optional
from langchain_openai import ChatOpenAI, AzureChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_community.chat_models import ChatTongyi, ChatMinimax, ChatZhipuAI, ChatSparkLLM, ChatBaiduQianfan
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class LLMFactory:
    @staticmethod
    def create_llm(provider: str, model_name: str, temperature: float = 0.1, streaming: bool = False):
        provider = provider.lower()
        
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
                return ChatTongyi(
                    api_key=settings.QWEN_API_KEY,
                    model=model_name,
                    temperature=temperature,
                    streaming=streaming
                )
            elif provider == "minimax":
                return ChatMinimax(
                    minimax_api_key=settings.MINIMAX_API_KEY,
                    minimax_group_id=settings.MINIMAX_GROUP_ID,
                    model=model_name,
                    temperature=temperature,
                    streaming=streaming
                )
            elif provider == "deepseek":
                # Deepseek is OpenAI compatible
                return ChatOpenAI(
                    api_key=settings.DEEPSEEK_API_KEY,
                    base_url="https://api.deepseek.com/v1",
                    model=model_name,
                    temperature=temperature,
                    streaming=streaming
                )
            elif provider == "zhipu":
                return ChatZhipuAI(
                    api_key=settings.ZHIPUAI_API_KEY,
                    model=model_name,
                    temperature=temperature,
                    streaming=streaming
                )
            elif provider == "qianfan":
                return ChatBaiduQianfan(
                    qianfan_ak=settings.QIANFAN_AK,
                    qianfan_sk=settings.QIANFAN_SK,
                    model=model_name,
                    temperature=temperature,
                    streaming=streaming
                )
            elif provider == "google":
                return ChatGoogleGenerativeAI(
                    google_api_key=settings.GOOGLE_API_KEY,
                    model=model_name,
                    temperature=temperature,
                    convert_system_message_to_human=True
                )
            elif provider == "spark":
                return ChatSparkLLM(
                    app_id=settings.SPARK_APP_ID,
                    api_key=settings.SPARK_API_KEY,
                    api_secret=settings.SPARK_API_SECRET,
                    model=model_name,
                    temperature=temperature,
                    streaming=streaming
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
