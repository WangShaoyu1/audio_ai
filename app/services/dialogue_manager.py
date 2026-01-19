from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.services.memory_manager import MemoryManager
from app.services.rag_engine import RAGEngine
from app.services.search_service import search_service
from app.core.llm_factory import LLMFactory
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from app.core.config import settings
import json
from app.core.logger import logger
import uuid
import time
import asyncio
import os
from pathlib import Path

# logger = logging.getLogger(__name__) # Removed in favor of app.core.logger

class DialogueManager:
    def __init__(self):
        self._load_prompts()

    def _load_prompts(self):
        """Load prompts from app/config/prompts.json"""
        try:
            config_path = Path("app/config/prompts.json")
            if not config_path.exists():
                logger.warning(f"Prompts config not found at {config_path}, using hardcoded defaults.")
                self.prompts_config = {}
                return

            with open(config_path, "r", encoding="utf-8") as f:
                self.prompts_config = json.load(f)
            logger.info("Prompts configuration loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load prompts config: {e}")
            self.prompts_config = {}

    def _get_system_prompt(self, provider: str, model: str, intent: str, **kwargs) -> str:
        """
        Get the appropriate system prompt based on provider, model, and intent.
        
        Resolution order:
        1. Check overrides for specific provider+model+intent
        2. Determine language (default to 'en' if not specified for provider)
        3. Get template from 'templates' section
        4. Format with kwargs
        """
        # Default config if file load failed
        if not self.prompts_config:
            # Fallback to simple English defaults if config is completely missing
            return self._get_fallback_prompt(intent, **kwargs)

        provider = provider.lower() if provider else "openai"
        model = model.lower() if model else "default"
        
        # 1. Check overrides
        overrides = self.prompts_config.get("overrides", [])
        for override in overrides:
            if (override.get("provider") == provider and 
                override.get("model") == model and 
                override.get("intent") == intent):
                
                # Found override, now pick language
                # For overrides, we might want to check if there is a specific lang key
                # But typically overrides are specific. Let's assume the override 'templates' 
                # follows the same structure as global templates.
                
                # Determine language preference
                lang = self.prompts_config.get("settings", {}).get("provider_language_defaults", {}).get(provider, "en")
                template = override.get("templates", {}).get(lang)
                if template:
                    return template.format(**kwargs)

        # 2. Determine language
        lang = self.prompts_config.get("settings", {}).get("provider_language_defaults", {}).get(provider, "en")
        
        # 3. Get template
        templates = self.prompts_config.get("templates", {}).get(intent, {})
        template = templates.get(lang)
        
        if not template:
            # Fallback to English if specific lang not found
            template = templates.get("en")
            
        if not template:
             return self._get_fallback_prompt(intent, **kwargs)

        # 4. Format
        try:
            return template.format(**kwargs)
        except KeyError as e:
            logger.error(f"Missing key for prompt formatting: {e}")
            return template # Return unformatted if keys missing, better than crash

    def _get_fallback_prompt(self, intent: str, **kwargs) -> str:
        """Hardcoded fallbacks in case config is missing"""
        if intent == "chat":
            return "You are a helpful AI assistant."
        elif intent == "search":
            return f"You are a helpful AI assistant. Answer based on search results:\n{kwargs.get('context_str', '')}"
        elif intent == "rag":
            return f"You are a helpful assistant. Answer based on context:\n{kwargs.get('context_str', '')}"
        elif intent == "instruction":
            return f"Classify intent: instruction, rag, search, chat. Return only the label. Query: {kwargs.get('query', '')}"
        return "You are a helpful assistant."

    async def process_request(self, session_id: str, query: str, user_id: str, db: AsyncSession, stream: bool = False, trace_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Legacy wrapper for non-streaming requests.
        """
        if stream:
            raise ValueError("Use stream_process_request for streaming")
            
        generator = self.stream_process_request(session_id, query, user_id, db, trace_id=trace_id)
        
        # Collect all chunks
        content = ""
        metadata = {}
        actions = []
        
        async for chunk in generator:
            if isinstance(chunk, dict):
                # This is the final metadata chunk
                metadata = chunk.get("metadata", {})
                actions = chunk.get("actions", [])
            else:
                # This is a content chunk
                content += chunk

        # User and Assistant messages are saved inside stream_process_request
        # So we don't need to save them here again
                
        return {
            "content": content,
            "metadata": metadata,
            "actions": actions
        }

    async def _stream_llm_response(self, llm, messages):
        """Helper to stream response with error handling"""
        try:
            async for chunk in llm.astream(messages):
                yield chunk.content
        except Exception as e:
            logger.error(f"LLM streaming error: {e}")
            yield f"\n\n[System Error: Failed to generate response. {str(e)}]"

    async def _stream_with_ttft(self, generator, metadata, start_time):
        first_token = True
        async for chunk in generator:
            if first_token:
                metadata["latency"]["ttft_ms"] = int((time.time() - start_time) * 1000)
                first_token = False
            yield chunk

    async def stream_process_request(self, session_id: str, query: str, user_id: str, db: AsyncSession, trace_id: Optional[str] = None):
        start_time = time.time()
        if not trace_id:
            trace_id = str(uuid.uuid4())
            
        logger.info(f"[{trace_id}] Starting stream_process_request for session {session_id}")
        
        # Ensure session_id is valid UUID or create new
        is_new_session = False
        if not session_id:
            session_id = str(uuid.uuid4())
            is_new_session = True
        else:
            try:
                uuid.UUID(session_id)
                # Check if session exists in DB
                from app.models.base import Session
                result = await db.execute(select(Session).filter(Session.id == session_id))
                if not result.scalar_one_or_none():
                    is_new_session = True
            except (ValueError, TypeError):
                session_id = str(uuid.uuid4())
                is_new_session = True

        # Create session if new
        if is_new_session:
            from app.models.base import Session
            # Auto-name from first 20 chars of query
            session_name = query[:20] + "..." if len(query) > 20 else query
            new_session = Session(id=session_id, user_id=user_id, name=session_name)
            db.add(new_session)
            await db.commit()

        memory = MemoryManager(db)
        rag = RAGEngine(db)
        
        # Save User Message FIRST to get its ID
        user_msg_id = await memory.save_message(session_id, "user", query, user_id)

        # Metadata container
        metadata = {
            "trace_id": trace_id,
            "reply_to": user_msg_id, # Link to user message
            "route": "unknown",
            "models_used": {},
            "latency": {
                "start_time": start_time
            },
            "search_results": [],
            "rag_references": []
        }
        
        # 1. Get Context (Scoped to user via session ownership check in MemoryManager)
        history = await memory.get_short_term_memory(session_id)
        logger.info(f"[{trace_id}] Loaded {len(history)} history messages for session {session_id}")
        
        # 2. Intent Routing
        router_llm = LLMFactory.get_llm_for_scenario("instruction") 
        metadata["models_used"]["router"] = settings.INSTRUCTION_LLM_MODEL or settings.DEFAULT_LLM_MODEL
        
        logger.info(f"[{trace_id}] Starting Intent Routing for query: {query}")
        intent = await self._route_intent(router_llm, query, history, trace_id=trace_id)
        metadata["route"] = intent
        
        logger.info(f"[{trace_id}] Session {session_id} routed to intent: {intent}")
        
        response_content = ""
        actions = []
        
        # 3. Dispatch based on Intent
        if intent == "instruction":
            logger.info(f"[{trace_id}] Processing INSTRUCTION intent")
            llm = LLMFactory.get_llm_for_scenario("instruction")
            metadata["models_used"]["executor"] = settings.INSTRUCTION_LLM_MODEL or settings.DEFAULT_LLM_MODEL
            
            # TODO: Integrate real function calling here
            chunk = f"指令已接收: {query} (模拟执行)"
            response_content += chunk
            yield chunk
            actions = [{"type": "mock_instruction", "payload": query}]
            
        elif intent == "rag":
            logger.info(f"[{trace_id}] Processing RAG intent")
            llm = LLMFactory.get_llm_for_scenario("rag")
            metadata["models_used"]["executor"] = settings.RAG_LLM_MODEL or settings.DEFAULT_LLM_MODEL
            
            # Pass user_id to RAG engine for isolated retrieval
            rag_context = await rag.search(query, user_id=uuid.UUID(user_id))
            metadata["rag_references"] = rag_context
            logger.info(f"[{trace_id}] RAG Search found {len(rag_context)} documents")
            
            if not rag_context:
                logger.info(f"[{trace_id}] RAG search returned empty, falling back to chat")
                intent = "chat" # Fallback logic
                metadata["route"] = "rag_fallback_chat"
            else:
                # Streaming RAG Response
                context_str = json.dumps(rag_context, ensure_ascii=False)
                system_prompt = self._get_system_prompt(
                    provider=settings.RAG_LLM_PROVIDER or settings.DEFAULT_LLM_PROVIDER,
                    model=settings.RAG_LLM_MODEL or settings.DEFAULT_LLM_MODEL,
                    intent="rag",
                    context_str=context_str
                )
                
                logger.info(f"[{trace_id}] RAG System Prompt: {system_prompt[:3000]}...")
                
                messages = [
                    SystemMessage(content=system_prompt)
                ]
                messages.extend(self._format_history(history))
                messages.append(HumanMessage(content=query))
                
                self._log_llm_messages(trace_id, "RAG LLM Input Messages:", messages)
                logger.info(f"[{trace_id}] Sending {len(messages)} messages to LLM")
                
                async for content_chunk in self._stream_with_ttft(self._stream_llm_response(llm, messages), metadata, start_time):
                    response_content += content_chunk
                    yield content_chunk
                
        # Handle Search Intent (Directly routed)
        if intent == "search":
            logger.info(f"[{trace_id}] Processing SEARCH intent")
            llm = LLMFactory.get_llm_for_scenario("chat")
            metadata["models_used"]["executor"] = settings.CHAT_LLM_MODEL or settings.DEFAULT_LLM_MODEL
            
            logger.info(f"[{trace_id}] Executing search for: {query}")
            search_results = await search_service.search(query)
            metadata["search_results"] = search_results
            logger.info(f"[{trace_id}] Search returned {len(search_results)} results")
            
            context_str = "\n\n".join([f"Source {i+1}: [{r['title']}]({r['href']})\nContent: {r['body']}" for i, r in enumerate(search_results)])
            
            system_prompt = self._get_system_prompt(
                provider=settings.CHAT_LLM_PROVIDER or settings.DEFAULT_LLM_PROVIDER,
                model=settings.CHAT_LLM_MODEL or settings.DEFAULT_LLM_MODEL,
                intent="search",
                context_str=context_str
            )
            
            logger.info(f"[{trace_id}] Search System Prompt: {system_prompt[:3000]}...")
            
            messages = [
                SystemMessage(content=system_prompt)
            ]
            messages.extend(self._format_history(history))
            messages.append(HumanMessage(content=query))
            
            self._log_llm_messages(trace_id, "Search LLM Input Messages:", messages)
            logger.info(f"[{trace_id}] Sending {len(messages)} messages to LLM")
            
            async for content_chunk in self._stream_with_ttft(self._stream_llm_response(llm, messages), metadata, start_time):
                response_content += content_chunk
                yield content_chunk

        # Handle Chat (including fallback from RAG)
        elif "chat" in intent:
            logger.info(f"[{trace_id}] Processing CHAT intent")
            llm = LLMFactory.get_llm_for_scenario("chat")
            metadata["models_used"]["executor"] = settings.CHAT_LLM_MODEL or settings.DEFAULT_LLM_MODEL
            
            # No secondary search check here to save time
            system_prompt = self._get_system_prompt(
                provider=settings.CHAT_LLM_PROVIDER or settings.DEFAULT_LLM_PROVIDER,
                model=settings.CHAT_LLM_MODEL or settings.DEFAULT_LLM_MODEL,
                intent="chat"
            )
            
            logger.info(f"[{trace_id}] Chat System Prompt: {system_prompt[:3000]}...")
            
            messages = [SystemMessage(content=system_prompt)]
            messages.extend(self._format_history(history))
            messages.append(HumanMessage(content=query))
            
            self._log_llm_messages(trace_id, "Chat LLM Input Messages:", messages)
            logger.info(f"[{trace_id}] Sending {len(messages)} messages to LLM")
            
            async for content_chunk in self._stream_with_ttft(self._stream_llm_response(llm, messages), metadata, start_time):
                response_content += content_chunk
                yield content_chunk
            
        # Finalize Metadata
        logger.info(f"[{trace_id}] Response generation complete. Length: {len(response_content)}")
        logger.debug(f"[{trace_id}] Full Response:\n {response_content}")
            
        # Finalize Metadata
        end_time = time.time()
        metadata["latency"]["total_ms"] = int((end_time - start_time) * 1000)
        metadata["session_id"] = session_id

        # 4. Save Memory (Scoped to user)
        # User message was already saved at the start of the function
        await memory.save_message(session_id, "assistant", response_content, user_id, metadata=metadata)
        
        # Yield final metadata chunk
        yield {
            "metadata": metadata,
            "actions": actions
        }

    def _log_llm_messages(self, trace_id: str, context_msg: str, messages: List[Any]):
        """Helper to log full LLM messages"""
        log_content = [f"[{trace_id}] {context_msg}"]
        for i, msg in enumerate(messages):
            role = getattr(msg, "type", "unknown")
            content = getattr(msg, "content", "")
            # Truncate very long content for sanity, but keep it substantial as requested
            if len(content) > 5000:
                content = content[:5000] + "...(truncated)"
            log_content.append(f"Message {i+1} ({role}): {content}")
        
        logger.info("\n".join(log_content))

    async def _route_intent(self, llm, query: str, history: list, trace_id: str = "N/A") -> str:
        prompt = self._get_system_prompt(
            provider=settings.INSTRUCTION_LLM_PROVIDER or settings.DEFAULT_LLM_PROVIDER,
            model=settings.INSTRUCTION_LLM_MODEL or settings.DEFAULT_LLM_MODEL,
            intent="instruction",
            query=query
        )
        
        messages = [HumanMessage(content=prompt)]
        self._log_llm_messages(trace_id, "Router LLM Input Messages:", messages)
        
        try:
            resp = await llm.ainvoke(messages)
            intent = resp.content.strip().lower()
            # Basic cleaning
            if "instruction" in intent: return "instruction"
            if "rag" in intent: return "rag"
            if "search" in intent: return "search"
            return "chat"
        except Exception as e:
            logger.error(f"[{trace_id}] Routing failed: {e}")
            return 'chat'

    async def _generate_rag_response(self, llm, query, context, history):
        system_prompt = self._get_system_prompt(
            provider=settings.RAG_LLM_PROVIDER or settings.DEFAULT_LLM_PROVIDER,
            model=settings.RAG_LLM_MODEL or settings.DEFAULT_LLM_MODEL,
            intent="rag",
            context_str=json.dumps(context, ensure_ascii=False)
        )
        messages = [
            SystemMessage(content=system_prompt)
        ]
        messages.extend(self._format_history(history))
        messages.append(HumanMessage(content=query))
        resp = await llm.ainvoke(messages)
        return resp.content

    async def _generate_search_response(self, llm, query, search_results, history):
        context_str = "\n\n".join([f"Source {i+1}: [{r['title']}]({r['href']})\nContent: {r['body']}" for i, r in enumerate(search_results)])
        system_prompt = self._get_system_prompt(
                provider=settings.CHAT_LLM_PROVIDER or settings.DEFAULT_LLM_PROVIDER,
                model=settings.CHAT_LLM_MODEL or settings.DEFAULT_LLM_MODEL,
                intent="search",
                context_str=context_str
            )
            
        messages = [
                SystemMessage(content=system_prompt)
            ]
        messages.extend(self._format_history(history))
        messages.append(HumanMessage(content=query))
        
        resp = await llm.ainvoke(messages)
        return resp.content

    async def _generate_chat_response(self, llm, query, history):
        system_prompt = self._get_system_prompt(
            provider=settings.CHAT_LLM_PROVIDER or settings.DEFAULT_LLM_PROVIDER,
            model=settings.CHAT_LLM_MODEL or settings.DEFAULT_LLM_MODEL,
            intent="chat"
        )
        messages = [SystemMessage(content=system_prompt)]
        messages.extend(self._format_history(history))
        messages.append(HumanMessage(content=query))
        resp = await llm.ainvoke(messages)
        return resp.content

    def _format_history(self, history):
        msgs = []
        for h in history:
            if h['role'] == 'user':
                msgs.append(HumanMessage(content=h['content']))
            else:
                msgs.append(AIMessage(content=h['content']))
        return msgs
