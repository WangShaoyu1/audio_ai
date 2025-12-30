from typing import Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.memory_manager import MemoryManager
from app.services.rag_engine import RAGEngine
from app.core.llm_factory import LLMFactory
from langchain.schema import HumanMessage, SystemMessage
from app.core.config import settings
import json
import logging

logger = logging.getLogger(__name__)

class DialogueManager:
    def __init__(self):
        pass
        
    async def process_request(self, session_id: str, query: str, user_id: str, db: AsyncSession) -> Dict[str, Any]:
        memory = MemoryManager(db)
        rag = RAGEngine(db)
        
        # 1. Get Context
        history = await memory.get_short_term_memory(session_id)
        
        # 2. Intent Routing (LLM-based)
        # Use a lightweight model or specific prompt for routing
        router_llm = LLMFactory.get_llm_for_scenario("instruction") 
        intent = await self._route_intent(router_llm, query, history)
        
        logger.info(f"Session {session_id} routed to intent: {intent}")
        
        response_content = ""
        actions = []
        
        # 3. Dispatch based on Intent
        if intent == "instruction":
            # Use Instruction LLM (Low temp, high precision)
            llm = LLMFactory.get_llm_for_scenario("instruction")
            # TODO: Add function calling logic here
            response_content = "Executing instruction..." 
            
        elif intent == "rag":
            # Use RAG LLM (Balanced)
            llm = LLMFactory.get_llm_for_scenario("rag")
            rag_context = await rag.search(query)
            
            if not rag_context:
                # Fallback to Chat if no context found
                logger.info("RAG search returned empty, falling back to general chat")
                intent = "chat"
                llm = LLMFactory.get_llm_for_scenario("chat")
            else:
                response_content = await self._generate_rag_response(llm, query, rag_context, history)
                
        if intent == "chat":
            # Use Chat LLM (High temp, creative)
            llm = LLMFactory.get_llm_for_scenario("chat")
            response_content = await self._generate_chat_response(llm, query, history)
            
        # 4. Save Memory
        await memory.save_message(session_id, "user", query, user_id)
        await memory.save_message(session_id, "assistant", response_content, user_id)
        
        return {
            "intent": intent,
            "reply": response_content,
            "actions": actions
        }

    async def _route_intent(self, llm, query: str, history: list) -> str:
        """
        Simple router using LLM. In prod, use LangChain RouterChain.
        """
        prompt = f"""
        Classify the user's intent into one of: ['instruction', 'rag', 'chat'].
        
        Definitions:
        - instruction: Control device (microwave), set time/mode, stop/start.
        - rag: Ask about recipes, user manual, or specific knowledge in documents.
        - chat: General conversation, greetings, or questions about world knowledge (weather, news).
        
        User Query: {query}
        
        Intent:
        """
        try:
            resp = await llm.ainvoke([HumanMessage(content=prompt)])
            intent = resp.content.strip().lower()
            if intent not in ['instruction', 'rag', 'chat']:
                return 'chat'
            return intent
        except Exception as e:
            logger.error(f"Routing failed: {e}")
            return 'chat'

    async def _generate_rag_response(self, llm, query, context, history):
        messages = [
            SystemMessage(content="You are a helpful assistant. Answer based on the provided context."),
            SystemMessage(content=f"Context:\n{json.dumps(context)}")
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
                msgs.append(SystemMessage(content=h['content']))
        return msgs
