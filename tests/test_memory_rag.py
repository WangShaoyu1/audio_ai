import pytest
import uuid
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.memory_manager import MemoryManager
from app.services.dialogue_manager import DialogueManager
from app.core.config import settings

@pytest.mark.asyncio
async def test_memory_rag_integration():
    # Setup Mocks
    mock_db = AsyncMock()
    
    # Mock MemoryManager settings and external dependencies
    with patch("app.services.memory_manager.settings") as mock_settings, \
         patch("app.services.memory_manager.redis.from_url") as mock_redis, \
         patch("app.services.memory_manager.vector_service") as mock_vector_service:
        
        mock_settings.MEMORY_ENABLE = True
        mock_settings.MID_TERM_MEMORY_ENABLE_EMBEDDING = True
        mock_settings.REDIS_URL = "redis://localhost"
        
        # Mock vector service response
        # Since vector_service methods are async, we need to mock them as async
        mock_vector_service.embed_query = AsyncMock(return_value=[0.1] * 1536)
        
        # Mock DB Result from search
        mock_msg = MagicMock()
        mock_msg.role = "user"
        mock_msg.content = "old message"
        mock_msg.created_at.isoformat.return_value = "2023-01-01T00:00:00"
        
        # Mock search return value
        mock_vector_service.search = AsyncMock(return_value=[mock_msg])
        
        # Initialize MemoryManager
        memory_manager = MemoryManager(mock_db)
        
        # Test get_relevant_mid_term_memory
        relevant_memory = await memory_manager.get_relevant_mid_term_memory("session_1", "query")
        
        assert len(relevant_memory) == 1
        assert relevant_memory[0]["content"] == "old message"
        
        # Verify vector_service calls
        mock_vector_service.embed_query.assert_called_with("query")
        mock_vector_service.search.assert_called_once()

@pytest.mark.asyncio
async def test_dialogue_manager_injection():
    # Setup DialogueManager
    dm = DialogueManager()
    
    valid_uuid = str(uuid.uuid4())
    
    # Mock MemoryManager inside DialogueManager
    with patch("app.services.dialogue_manager.MemoryManager") as MockMemoryManager:
        mock_memory = AsyncMock()
        MockMemoryManager.return_value = mock_memory
        
        # Mock short-term memory
        mock_memory.get_short_term_memory.return_value = [{"role": "user", "content": "recent message"}]
        
        # Mock mid-term memory (Memory RAG)
        mock_memory.get_relevant_mid_term_memory.return_value = [
            {"role": "user", "content": "old relevant message", "created_at": "..."}
        ]
        
        # Mock other services
        with patch("app.services.dialogue_manager.RAGEngine"), \
             patch("app.services.dialogue_manager.LLMFactory") as MockLLMFactory, \
             patch("app.services.dialogue_manager.search_service"):
             
            mock_llm = MagicMock() 
            MockLLMFactory.get_llm_for_scenario.return_value = mock_llm
            
            # Mock LLM response for router
            mock_llm.ainvoke = AsyncMock(return_value=MagicMock(content="chat"))
            
            # Mock LLM stream response for chat
            async def async_gen(msgs):
                yield MagicMock(content="response")
            
            mock_llm.astream.side_effect = async_gen

            # Run stream_process_request
            # Must provide a db session mock, even if not used due to mocks
            mock_db_session = AsyncMock()
            
            # Use valid UUID so DialogueManager doesn't generate a new one
            generator = dm.stream_process_request(valid_uuid, "query", "user_1", mock_db_session)
            
            async for _ in generator:
                pass
            
            # Verify get_relevant_mid_term_memory was called with the SAME UUID
            mock_memory.get_relevant_mid_term_memory.assert_called_with(valid_uuid, "query")
            
            # Verify prompt injection
            call_args = mock_llm.astream.call_args
            assert call_args is not None
            messages = call_args[0][0]
            system_msg = messages[0].content
            
            # Check if "Relevant Past Conversation" is in system prompt
            assert "Relevant Past Conversation" in system_msg
            assert "old relevant message" in system_msg
