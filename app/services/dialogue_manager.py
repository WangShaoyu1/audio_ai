from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.memory_manager import MemoryManager
from app.services.rag_engine import RAGEngine
from app.services.search_service import search_service
from app.core.llm_factory import LLMFactory
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from app.core.config import settings
import json
import logging
import uuid
import time
import asyncio

logger = logging.getLogger(__name__)

class DialogueManager:
    def __init__(self):
        pass
        
    async def process_request(self, session_id: str, query: str, user_id: str, db: AsyncSession, stream: bool = False) -> Dict[str, Any]:
        start_time = time.time()
        trace_id = str(uuid.uuid4())
        
        # Ensure session_id is valid UUID or create new
        try:
            uuid.UUID(session_id)
        except ValueError:
            session_id = str(uuid.uuid4())

        memory = MemoryManager(db)
        rag = RAGEngine(db)
        
        # Metadata container
        metadata = {
            "trace_id": trace_id,
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
        
        # 2. Intent Routing
        router_llm = LLMFactory.get_llm_for_scenario("instruction") 
        metadata["models_used"]["router"] = settings.INSTRUCTION_LLM_MODEL or settings.DEFAULT_LLM_MODEL
        
        intent = await self._route_intent(router_llm, query, history)
        metadata["route"] = intent
        
        logger.info(f"Session {session_id} [Trace: {trace_id}] routed to intent: {intent}")
        
        response_content = ""
        actions = []
        
        # 3. Dispatch based on Intent
        if intent == "instruction":
            llm = LLMFactory.get_llm_for_scenario("instruction")
            metadata["models_used"]["executor"] = settings.INSTRUCTION_LLM_MODEL or settings.DEFAULT_LLM_MODEL
            
            # TODO: Integrate real function calling here
            response_content = f"指令已接收: {query} (模拟执行)"
            actions = [{"type": "mock_instruction", "payload": query}]
            
        elif intent == "rag":
            llm = LLMFactory.get_llm_for_scenario("rag")
            metadata["models_used"]["executor"] = settings.RAG_LLM_MODEL or settings.DEFAULT_LLM_MODEL
            
            # Pass user_id to RAG engine for isolated retrieval
            rag_context = await rag.search(query, user_id=uuid.UUID(user_id))
            metadata["rag_references"] = rag_context
            
            if not rag_context:
                logger.info("RAG search returned empty, falling back to chat")
                intent = "chat" # Fallback logic
                metadata["route"] = "rag_fallback_chat"
            else:
                response_content = await self._generate_rag_response(llm, query, rag_context, history)
                
        # Handle Chat (including fallback from RAG)
        if "chat" in intent:
            llm = LLMFactory.get_llm_for_scenario("chat")
            metadata["models_used"]["executor"] = settings.CHAT_LLM_MODEL or settings.DEFAULT_LLM_MODEL
            
            # Check if search is needed (Sub-intent within chat)
            if await self._needs_search(llm, query):
                metadata["route"] = "chat_search"
                logger.info("Search intent detected")
                search_results = await search_service.search(query)
                metadata["search_results"] = search_results
                response_content = await self._generate_search_response(llm, query, search_results, history)
            else:
                response_content = await self._generate_chat_response(llm, query, history)
            
        # 4. Save Memory (Scoped to user)
        await memory.save_message(session_id, "user", query, user_id)
        await memory.save_message(session_id, "assistant", response_content, user_id)
        
        # Finalize Metadata
        end_time = time.time()
        metadata["latency"]["total_ms"] = int((end_time - start_time) * 1000)
        
        return {
            "content": response_content,
            "metadata": metadata,
            "actions": actions
        }

    async def _route_intent(self, llm, query: str, history: list) -> str:
        prompt = f"""
        Classify the user's intent into one of: ['instruction', 'rag', 'chat'].
        
        Definitions:
        - instruction: Control device (microwave), set time/mode, stop/start.
        - rag: Ask about recipes, user manual, or specific knowledge in documents.
        - chat: General conversation, greetings, or questions about world knowledge (weather, news).
        
        User Query: {query}
        
        Return ONLY the intent label.
        """
        try:
            resp = await llm.ainvoke([HumanMessage(content=prompt)])
            intent = resp.content.strip().lower()
            # Basic cleaning
            if "instruction" in intent: return "instruction"
            if "rag" in intent: return "rag"
            return "chat"
        except Exception as e:
            logger.error(f"Routing failed: {e}")
            return 'chat'

    async def _needs_search(self, llm, query: str) -> bool:
        """
        Determine if the query requires real-time information.
        """
        prompt = f"""
        Does the following user query require real-time information from the internet (e.g. weather, news, stock prices, current events)?
        Query: {query}
        Return 'YES' or 'NO'.
        """
        try:
            resp = await llm.ainvoke([HumanMessage(content=prompt)])
            return "YES" in resp.content.strip().upper()
        except:
            return False

    async def _generate_rag_response(self, llm, query, context, history):
        messages = [
            SystemMessage(content="You are a helpful assistant. Answer based on the provided context."),
            SystemMessage(content=f"Context:\n{json.dumps(context, ensure_ascii=False)}")
        ]
        messages.extend(self._format_history(history))
        messages.append(HumanMessage(content=query))
        resp = await llm.ainvoke(messages)
        return resp.content

    async def _generate_search_response(self, llm, query, search_results, history):
        context_str = "\n".join([f"- [{r['title']}]({r['href']}): {r['body']}" for r in search_results])
        messages = [
            SystemMessage(content="You are a helpful assistant. Answer the user's question based on the following search results. Always cite your sources."),
            SystemMessage(content=f"Search Results:\n{context_str}")
        ]
        messages.extend(self._format_history(history))
        messages.append(HumanMessage(content=query))
        resp = await llm.ainvoke(messages)
        return resp.content

    async def _generate_chat_response(self, llm, query, history):
        messages = [SystemMessage(content="You are a helpful AI assistant.")]
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
