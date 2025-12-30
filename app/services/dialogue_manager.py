from typing import Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.memory_manager import MemoryManager
from app.services.rag_engine import RAGEngine
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
from app.core.config import settings
import json

class DialogueManager:
    def __init__(self):
        self.llm = ChatOpenAI(
            api_key=settings.OPENAI_API_KEY,
            base_url=settings.OPENAI_API_BASE,
            model=settings.LLM_MODEL_INSTRUCTION,
            temperature=0.1
        )
        
    async def process_request(self, session_id: str, query: str, user_id: str, db: AsyncSession) -> Dict[str, Any]:
        # Initialize services with DB session
        memory = MemoryManager(db)
        rag = RAGEngine(db)
        
        # 1. Get Context
        history = await memory.get_short_term_memory(session_id)
        
        # 2. Intent Routing (Simplified for MVP)
        # In production, use a dedicated RouterChain here
        
        # 3. Try RAG if needed (Fallback Logic)
        rag_context = await rag.search(query)
        
        # 4. Generate Response
        messages = [
            SystemMessage(content="You are a helpful AI assistant for a smart microwave."),
        ]
        
        # Add history
        for msg in history:
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            else:
                messages.append(SystemMessage(content=msg["content"]))
                
        # Add current query with RAG context
        if rag_context:
            context_str = "\n".join(rag_context)
            messages.append(SystemMessage(content=f"Reference Context:\n{context_str}"))
            
        messages.append(HumanMessage(content=query))
        
        # Call LLM
        response = await self.llm.ainvoke(messages)
        
        # 5. Save Memory
        await memory.save_message(session_id, "user", query, user_id)
        await memory.save_message(session_id, "assistant", response.content, user_id)
        
        return {
            "intent": "chat", # Placeholder
            "reply": response.content,
            "actions": []
        }
