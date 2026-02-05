from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.services.instruction_service import InstructionService
from app.services.memory_manager import MemoryManager
from app.services.rag_engine import RAGEngine
from app.services.search_service import search_service
from app.services.feedback_service import FeedbackService
from app.services.instruction_matcher import matcher_service
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

    def _get_system_prompt(self, provider: str, model: str, intent: str, language: str = None, **kwargs) -> str:
        """
        Get the appropriate system prompt based on provider, model, and intent.
        
        Resolution order:
        1. Check overrides for specific provider+model+intent
        2. Use explicit language argument if provided
        3. Determine language (default to 'en' if not specified for provider)
        4. Get template from 'templates' section
        5. Format with kwargs
        """
        # Default config if file load failed
        if not self.prompts_config:
            # Fallback to simple English defaults if config is completely missing
            return self._get_fallback_prompt(intent, **kwargs)

        provider = provider.lower() if provider else "openai"
        model = model.lower() if model else "default"
        
        # Determine language: explicit argument > provider default > 'en'
        lang = language
        if not lang:
            lang = self.prompts_config.get("settings", {}).get("provider_language_defaults", {}).get(provider, "en")

        # 1. Check overrides
        overrides = self.prompts_config.get("overrides", [])
        for override in overrides:
            if (override.get("provider") == provider and
                    override.get("model") == model and
                    override.get("intent") == intent):

                # Found override
                template = override.get("templates", {}).get(lang)
                if template:
                    return template.format(**kwargs)

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
            return template  # Return unformatted if keys missing, better than crash

    def _get_fallback_prompt(self, intent: str, **kwargs) -> str:
        """Hardcoded fallbacks in case config is missing"""
        if intent == "chat":
            return "You are a helpful AI assistant."
        elif intent == "search":
            return f"You are a helpful AI assistant. Answer based on search results:\n{kwargs.get('context_str', '')}"
        elif intent == "rag":
            return f"You are a helpful assistant. Answer based on context:\n{kwargs.get('context_str', '')}"
        elif intent == "instruction":
            intent_list = kwargs.get('intent_list', "['instruction', 'rag', 'search', 'chat']")
            return f"Classify intent: {intent_list}. Return only the label. Query: {kwargs.get('query', '')}"
        return "You are a helpful assistant."

    async def process_request(self, session_id: str, query: str, user_id: str, db: AsyncSession, stream: bool = False,
                              trace_id: Optional[str] = None) -> Dict[str, Any]:
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
                now = time.time()
                metadata["latency"]["ttft_ms"] = int((now - start_time) * 1000)
                first_token = False
            yield chunk

        # Final metadata update
        metadata["latency"]["total_ms"] = int((time.time() - start_time) * 1000)

    async def stream_process_request(self, session_id: str, query: str, user_id: str, db: AsyncSession,
                                     trace_id: Optional[str] = None):
        # Force reload prompts to ensure latest configuration is used
        self._load_prompts()

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

        # Load Session Config & Auto-rename if needed
        session_config = {}
        session_language = "zh" # Default to Chinese
        try:
            from app.models.base import Session
            result = await db.execute(select(Session).filter(Session.id == session_id))
            session_obj = result.scalar_one_or_none()
            
            if session_obj:
                # Load language
                if session_obj.language:
                    session_language = session_obj.language
                    
                # Auto-rename if name is default "New Chat"
                if session_obj.name == "New Chat":
                     session_name = query[:20] + "..." if len(query) > 20 else query
                     session_obj.name = session_name
                     db.add(session_obj)
                     await db.commit()
                     logger.info(f"[{trace_id}] Auto-renamed session {session_id} to '{session_name}'")

                if session_obj.context:
                    session_config = session_obj.context.get("llm_config", {})
                    if session_config:
                        logger.info(f"[{trace_id}] Loaded session config: {session_config}")
        except Exception as e:
            logger.error(f"[{trace_id}] Failed to load session config or rename: {e}")

        memory = MemoryManager(db)
        rag = RAGEngine(db)

        # Save User Message FIRST to get its ID
        user_msg_id = await memory.save_message(session_id, "user", query, user_id)

        # Metadata container
        metadata = {
            "trace_id": trace_id,
            "reply_to": user_msg_id,  # Link to user message
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

        # 1.1 Get Relevant Mid-term Memory
        mid_term_memory = []
        if settings.MEMORY_ENABLE and settings.MID_TERM_MEMORY_ENABLE_EMBEDDING:
            try:
                # Exclude messages that are likely in short-term history by checking content equality
                # This is a basic deduplication strategy
                raw_mid_term = await memory.get_relevant_mid_term_memory(session_id, query)
                
                # Deduplication: Filter out messages present in short-term history
                history_contents = {h['content'] for h in history}
                mid_term_memory = [
                    m for m in raw_mid_term 
                    if m['content'] not in history_contents
                ]
                
                logger.info(f"[{trace_id}] Loaded {len(mid_term_memory)} relevant mid-term messages")
            except Exception as e:
                logger.error(f"[{trace_id}] Failed to load mid-term memory: {e}")

        # Format memory context string
        memory_context_str = ""
        if mid_term_memory:
            memory_context_str = "Relevant Past Conversation:\n"
            for msg in mid_term_memory:
                # Format: [Role] Content
                memory_context_str += f"[{msg['role'].capitalize()}]: {msg['content']}\n"
            memory_context_str += "\nEnd of Relevant Past Conversation.\n\n"
            
            metadata["mid_term_memory_used"] = len(mid_term_memory)

        # 2. Intent Routing
        # Use a dummy LLM here because _route_intent will instantiate its own based on config
        # But we still pass something to satisfy the signature if needed, though we just updated _route_intent to ignore it
        # However, for metadata logging we want to know what was used.
        
        intent_provider = session_config.get("INTENT_LLM_PROVIDER") or settings.INTENT_LLM_PROVIDER or \
                          session_config.get("INSTRUCTION_LLM_PROVIDER") or settings.INSTRUCTION_LLM_PROVIDER or \
                          settings.DEFAULT_LLM_PROVIDER
        intent_model = session_config.get("INTENT_LLM_MODEL") or settings.INTENT_LLM_MODEL or \
                       session_config.get("INSTRUCTION_LLM_MODEL") or settings.INSTRUCTION_LLM_MODEL or \
                       settings.DEFAULT_LLM_MODEL
        
        metadata["models_used"]["router"] = intent_model

        logger.info(f"[{trace_id}] Starting Intent Routing for query: {query}")
        intent, intent_latency = await self._route_intent(None, query, history, trace_id=trace_id, session_config=session_config, language=session_language)
        metadata["route"] = intent
        metadata["latency"]["intent_ms"] = intent_latency

        logger.info(f"[{trace_id}] Session {session_id} routed to intent: {intent} in {intent_latency}ms")

        # Override intent if RAG is disabled in session config
        if intent == "rag":
             rag_enabled = session_config.get("RAG_ENABLE")
             
             # Strict check: RAG must be explicitly enabled
             is_rag_enabled = False
             if rag_enabled is True:
                 is_rag_enabled = True
             elif isinstance(rag_enabled, str) and rag_enabled.lower() == "true":
                 is_rag_enabled = True
             elif isinstance(rag_enabled, int) and rag_enabled == 1:
                 is_rag_enabled = True
                 
             if not is_rag_enabled:
                  logger.info(f"[{trace_id}] RAG is not explicitly enabled (RAG_ENABLE={rag_enabled}). Switching to CHAT.")
                  intent = "chat"
                  metadata["route"] = "rag_disabled_chat"

        response_content = ""
        actions = []

        # 3. Dispatch based on Intent
        while True:
            if intent == "instruction":
                logger.info(f"[{trace_id}] Processing INSTRUCTION intent")

                # Check for mandatory Instruction Repository configuration
                repo_id_str = session_config.get("INSTRUCTION_REPO_ID")
                repo_id = None
                if repo_id_str:
                    try:
                        repo_id = uuid.UUID(repo_id_str)
                    except ValueError:
                        logger.warning(f"[{trace_id}] Invalid INSTRUCTION_REPO_ID: {repo_id_str}")

                if not repo_id:
                    logger.warning(f"[{trace_id}] Missing or invalid INSTRUCTION_REPO_ID in session config")
                    msg = "当前会话未配置指令库，无法执行指令。请在会话设置中选择一个指令库。"
                    response_content += msg
                    yield msg
                    break

                # 1. Check Instruction Matcher (Generalization & Exact Match)
                # Pass repo_id to ensure we only match templates for this repository (or globals)
                matched_instruction = matcher_service.match(query, repository_id=repo_id)
                if matched_instruction:
                    logger.info(f"[{trace_id}] Matched instruction template: {matched_instruction['template_pattern']}")
                    
                    metadata["hit_source"] = "memory"

                    # Increment hit count for the original query (System Pair)
                    try:
                        feedback_service = FeedbackService(db)
                        original_query = matched_instruction.get("original_query")
                        if original_query:
                            await feedback_service.increment_hit_count(original_query)
                    except Exception as e:
                        logger.error(f"[{trace_id}] Failed to increment hit count for matcher: {e}")

                    result_json = matched_instruction['result']
                    chunk = json.dumps(result_json, ensure_ascii=False)
                    response_content += chunk
                    yield chunk
                    
                    actions = [{"type": "execute_instruction", "payload": result_json}]
                    metadata["models_used"]["executor"] = "instruction_matcher"
                    break

                # 2. Check Redis Cache (Legacy / Exact caching)
                # Pass repo_id to ensure we only check cache for this repository
                feedback_service = FeedbackService(db)
                cached_response = await feedback_service.get_cached_instruction_response(query, repository_id=repo_id)
                if cached_response:
                    logger.info(f"[{trace_id}] Using cached instruction response")
                    
                    metadata["hit_source"] = "redis"

                    # Increment hit count for the exact query (User History / Cached)
                    try:
                        await feedback_service.increment_hit_count(query)
                    except Exception as e:
                        logger.error(f"[{trace_id}] Failed to increment hit count for cache: {e}")

                    response_content = cached_response
                    yield response_content
                    
                    try:
                        cmd_data = json.loads(cached_response)
                        actions = [{"type": "execute_instruction", "payload": cmd_data}]
                    except json.JSONDecodeError:
                        pass
                        
                    metadata["models_used"]["executor"] = "redis_cache"
                    break

                llm = LLMFactory.get_llm_for_scenario("instruction", config=session_config)
                metadata["models_used"]["executor"] = session_config.get("INSTRUCTION_LLM_MODEL") or settings.INSTRUCTION_LLM_MODEL or settings.DEFAULT_LLM_MODEL
                metadata["hit_source"] = "llm"

                # Use InstructionService to get available instructions
                instruction_service = InstructionService(db)
                try:
                    # Assuming user_id is a valid UUID string, but handle potential errors if it's not
                    try:
                        user_uuid = uuid.UUID(user_id)
                    except ValueError:
                        # Fallback for system user or invalid ID, though authentication should prevent this
                        logger.warning(f"[{trace_id}] Invalid user_id {user_id}, using empty instruction list")
                        user_uuid = None

                    instructions = []
                    if user_uuid and repo_id:
                        instructions = await instruction_service.get_all_instructions(user_uuid, repository_id=repo_id)

                    # Format instructions for the prompt
                    instructions_list = [
                        {
                            "name": inst.name,
                            "description": inst.description,
                            "parameters": inst.parameters
                        } for inst in instructions
                    ]
                    instructions_str = json.dumps(instructions_list, ensure_ascii=False, indent=2)

                    # Get system prompt for executor
                    system_prompt = self._get_system_prompt(
                        provider=session_config.get("INSTRUCTION_LLM_PROVIDER") or settings.INSTRUCTION_LLM_PROVIDER or settings.DEFAULT_LLM_PROVIDER,
                        model=session_config.get("INSTRUCTION_LLM_MODEL") or settings.INSTRUCTION_LLM_MODEL or settings.DEFAULT_LLM_MODEL,
                        intent="instruction_executor",
                        language=session_language,
                        instructions_list=instructions_str,
                        query=query
                    )

                    # Inject Mid-term Memory Context
                    if memory_context_str:
                        system_prompt = memory_context_str + system_prompt

                    logger.info(f"[{trace_id}] Instruction Executor Prompt Length: {len(system_prompt)}")

                    messages = [
                        SystemMessage(content=system_prompt)
                    ]
                    # Add history for context-aware instruction execution
                    messages.extend(self._format_history(history))
                    # Add query again as HumanMessage to reinforce the request
                    messages.append(HumanMessage(content=query))

                    # Execute LLM to get JSON response
                    # We use ainvoke because we expect a JSON structure
                    response = await llm.ainvoke(messages)
                    content = response.content
                    logger.info(f"[{trace_id}] Instruction Executor Raw Response: {content}")

                    # Parse JSON
                    # Clean content if it has markdown code blocks
                    if "```json" in content:
                        content = content.split("```json")[1].split("```")[0].strip()
                    elif "```" in content:
                        content = content.split("```")[1].strip()

                    try:
                        cmd_data = json.loads(content)
                        cmd_name = cmd_data.get("name")

                        if cmd_name:
                            # Success: Return the command name and params as requested by user
                            # Format: {"name": "...", "parameters": {...}} JSON string

                            chunk = json.dumps(cmd_data, ensure_ascii=False)
                            response_content += chunk
                            yield chunk

                            actions = [{"type": "execute_instruction", "payload": cmd_data}]
                        else:
                            # No match found
                            chunk = f"未找到匹配的指令: {query}"
                            response_content += chunk
                            yield chunk

                    except json.JSONDecodeError:
                        logger.error(f"[{trace_id}] Failed to parse instruction response: {content}")
                        chunk = f"指令解析失败: {content}"
                        response_content += chunk
                        yield chunk

                except Exception as e:
                    logger.error(f"[{trace_id}] Error executing instruction: {e}", exc_info=True)
                    chunk = f"执行指令时出错: {str(e)}"
                    response_content += chunk
                    yield chunk
                
                break

            if intent == "rag":
                try:
                    logger.info(f"[{trace_id}] Processing RAG intent")
                    llm = LLMFactory.get_llm_for_scenario("rag", config=session_config)
                    metadata["models_used"]["executor"] = session_config.get("RAG_LLM_MODEL") or settings.RAG_LLM_MODEL or settings.DEFAULT_LLM_MODEL

                    # Pass user_id to RAG engine for isolated retrieval
                    rag_context = await rag.search(query, user_id=uuid.UUID(user_id))
                    metadata["rag_references"] = rag_context
                    logger.info(f"[{trace_id}] RAG Search found {len(rag_context)} documents")

                    if not rag_context:
                        logger.info(f"[{trace_id}] RAG search returned empty, falling back to SEARCH")
                        intent = "search"  # Fallback logic
                        metadata["route"] = "rag_fallback_search"
                        continue # Fallthrough to SEARCH block
                    else:
                        # Streaming RAG Response
                        context_str = json.dumps(rag_context, ensure_ascii=False)
                        system_prompt = self._get_system_prompt(
                            provider=session_config.get("RAG_LLM_PROVIDER") or settings.RAG_LLM_PROVIDER or settings.DEFAULT_LLM_PROVIDER,
                            model=session_config.get("RAG_LLM_MODEL") or settings.RAG_LLM_MODEL or settings.DEFAULT_LLM_MODEL,
                            intent="rag",
                            language=session_language,
                            context_str=context_str
                        )

                        # Inject Mid-term Memory Context
                        if memory_context_str:
                            system_prompt = memory_context_str + system_prompt

                        logger.info(f"[{trace_id}] RAG System Prompt: {system_prompt[:3000]}...")

                        messages = [
                            SystemMessage(content=system_prompt)
                        ]
                        messages.extend(self._format_history(history))
                        messages.append(HumanMessage(content=query))

                        self._log_llm_messages(trace_id, "RAG LLM Input Messages:", messages)
                        logger.info(f"[{trace_id}] Sending {len(messages)} messages to LLM")

                        async for content_chunk in self._stream_with_ttft(self._stream_llm_response(llm, messages), metadata,
                                                                        start_time):
                            response_content += content_chunk
                            yield content_chunk
                        
                        break
                except BaseException as e:
                    logger.error(f"[{trace_id}] RAG Error: {e}, falling back to SEARCH", exc_info=True)
                    intent = "search"
                    metadata["route"] = "rag_error_fallback_search"
                    continue

            if intent == "search":
                try:
                    logger.info(f"[{trace_id}] Processing SEARCH intent")
                    llm = LLMFactory.get_llm_for_scenario("search", config=session_config)
                    metadata["models_used"]["executor"] = session_config.get("SEARCH_LLM_MODEL") or settings.SEARCH_LLM_MODEL or settings.DEFAULT_LLM_MODEL

                    logger.info(f"[{trace_id}] Executing search for: {query}")
                    search_results = await search_service.search(query)
                    metadata["search_results"] = search_results
                    logger.info(f"[{trace_id}] Search returned {len(search_results)} results")
                    
                    # Format search results
                    context_str = ""
                    for i, res in enumerate(search_results):
                        context_str += f"{i+1}. {res['title']}: {res.get('body', '')}\n"
                    
                    system_prompt = self._get_system_prompt(
                        provider=session_config.get("SEARCH_LLM_PROVIDER") or settings.SEARCH_LLM_PROVIDER or settings.DEFAULT_LLM_PROVIDER,
                        model=session_config.get("SEARCH_LLM_MODEL") or settings.SEARCH_LLM_MODEL or settings.DEFAULT_LLM_MODEL,
                        intent="search",
                        language=session_language,
                        context_str=context_str
                    )
                    
                    # Inject Mid-term Memory Context
                    if memory_context_str:
                        system_prompt = memory_context_str + system_prompt

                    messages = [
                        SystemMessage(content=system_prompt)
                    ]
                    messages.extend(self._format_history(history))
                    messages.append(HumanMessage(content=query))
                    
                    async for content_chunk in self._stream_with_ttft(self._stream_llm_response(llm, messages), metadata,
                                                                    start_time):
                        response_content += content_chunk
                        yield content_chunk
                    
                    break
                except BaseException as e:
                    logger.error(f"[{trace_id}] Search Error: {e}, falling back to CHAT", exc_info=True)
                    intent = "chat"
                    metadata["route"] = "search_error_fallback_chat"
                    continue

            # Default to CHAT if intent is 'chat' or unknown or fallthrough
            logger.info(f"[{trace_id}] Processing CHAT intent (or fallback)")
            llm = LLMFactory.get_llm_for_scenario("chat", config=session_config)
            metadata["models_used"]["executor"] = session_config.get("CHAT_LLM_MODEL") or settings.CHAT_LLM_MODEL or settings.DEFAULT_LLM_MODEL

            system_prompt = self._get_system_prompt(
                provider=session_config.get("CHAT_LLM_PROVIDER") or settings.CHAT_LLM_PROVIDER or settings.DEFAULT_LLM_PROVIDER,
                model=session_config.get("CHAT_LLM_MODEL") or settings.CHAT_LLM_MODEL or settings.DEFAULT_LLM_MODEL,
                intent="chat",
                language=session_language
            )
            
            # Inject Mid-term Memory Context
            if memory_context_str:
                system_prompt = memory_context_str + system_prompt

            messages = [
                SystemMessage(content=system_prompt)
            ]
            messages.extend(self._format_history(history))
            messages.append(HumanMessage(content=query))

            async for content_chunk in self._stream_with_ttft(self._stream_llm_response(llm, messages), metadata,
                                                              start_time):
                response_content += content_chunk
                yield content_chunk
            
            break

        # Finalize Metadata
        logger.info(f"[{trace_id}] Response generation complete. Length: {len(response_content)}")
        logger.debug(f"[{trace_id}] Full Response:\n {response_content}")

        # Finalize Metadata
        end_time = time.time()
        metadata["latency"]["total_ms"] = int((end_time - start_time) * 1000)
        metadata["session_id"] = session_id

        # 4. Save Memory (Scoped to user)
        # User message was already saved at the start of the function
        msg_id = await memory.save_message(session_id, "assistant", response_content, user_id, metadata=metadata)
        metadata["message_id"] = msg_id

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
            log_content.append(f"Message {i + 1} ({role}): {content}")

        logger.info("\n".join(log_content))

    async def _route_intent(self, llm, query: str, history: list, trace_id: str = "N/A", session_config: dict = None, language: str = None) -> tuple[str, int]:
        start_time = time.time()
        session_config = session_config or {}
        # Prioritize INTENT_LLM, fallback to INSTRUCTION_LLM (legacy), then DEFAULT
        provider = session_config.get("INTENT_LLM_PROVIDER") or settings.INTENT_LLM_PROVIDER or \
                   session_config.get("INSTRUCTION_LLM_PROVIDER") or settings.INSTRUCTION_LLM_PROVIDER or \
                   settings.DEFAULT_LLM_PROVIDER
        
        model = session_config.get("INTENT_LLM_MODEL") or settings.INTENT_LLM_MODEL or \
                session_config.get("INSTRUCTION_LLM_MODEL") or settings.INSTRUCTION_LLM_MODEL or \
                settings.DEFAULT_LLM_MODEL

        # Create a dedicated LLM instance for routing if provider/model differs from the passed 'llm'
        # The 'llm' passed in might be the one for 'instruction' scenario which might be different now.
        # Ideally we should get the correct LLM here.
        
        # Re-instantiate LLM for routing to ensure we use the correct config
        router_llm = LLMFactory.create_llm(provider, model, temperature=0.1)

        # Check RAG configuration
        rag_enabled = session_config.get("RAG_ENABLE")
        # Strict check: RAG must be explicitly enabled (True, "true", 1)
        is_rag_enabled = False
        if rag_enabled is True:
            is_rag_enabled = True
        elif isinstance(rag_enabled, str) and rag_enabled.lower() == "true":
            is_rag_enabled = True
        elif isinstance(rag_enabled, int) and rag_enabled == 1:
            is_rag_enabled = True

        # Build intent list
        intent_list = "['instruction', 'search', 'chat']"
        if is_rag_enabled:
            intent_list = "['instruction', 'rag', 'search', 'chat']"

        prompt = self._get_system_prompt(
            provider=provider,
            model=model,
            intent="instruction", # Still use instruction template for routing
            language=language,
            query=query,
            intent_list=intent_list
        )

        messages = [HumanMessage(content=prompt)]
        self._log_llm_messages(trace_id, "Router LLM Input Messages:", messages)

        try:
            resp = await router_llm.ainvoke(messages)
            intent = resp.content.strip().lower()
            
            # Simple validation
            valid_intents = ["instruction", "chat", "search", "rag"]
            # If not in valid list, check if it contains any of them
            found = False
            for v in valid_intents:
                if v in intent:
                    intent = v
                    found = True
                    break
            
            if not found:
                logger.warning(f"[{trace_id}] Router returned unknown intent: {intent}, defaulting to 'chat'")
                intent = "chat"

        except Exception as e:
            logger.error(f"[{trace_id}] Router LLM failed: {e}")
            intent = "chat"
            
        latency_ms = int((time.time() - start_time) * 1000)
        return intent, latency_ms

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
        context_str = "\n\n".join([f"Source {i + 1}: [{r['title']}]({r['href']})\nContent: {r['body']}" for i, r in
                                   enumerate(search_results)])
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
