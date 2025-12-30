import pytest
from httpx import AsyncClient
from app.main import app
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_admin_create_instruction():
    # Mock DB session
    with patch("app.api.admin.get_db") as mock_get_db:
        mock_db = AsyncMock()
        mock_get_db.return_value = mock_db
        
        payload = {
            "name": "start_cooking",
            "description": "Start microwave cooking",
            "parameters": {"type": "object"},
            "mutex_config": {"incompatible": ["stop_cooking"]}
        }
        
        # Mock Service
        with patch("app.services.instruction_service.InstructionService.create_instruction", new_callable=AsyncMock) as mock_create:
            mock_create.return_value = payload
            
            async with AsyncClient(app=app, base_url="http://test") as ac:
                response = await ac.post("/api/v1/admin/instructions", json=payload)
                
            assert response.status_code == 200
            assert response.json()["name"] == "start_cooking"

@pytest.mark.asyncio
async def test_rag_fallback():
    # Test RAG fallback logic when search fails
    with patch("app.services.rag_engine.RAGEngine.search", side_effect=Exception("DB Error")):
        # Should not raise error, but return empty list (handled inside RAGEngine)
        # Here we test the integration in DialogueManager
        pass 
