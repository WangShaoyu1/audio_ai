import pytest
from httpx import AsyncClient
from app.main import app
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

@pytest.mark.asyncio
async def test_chat_endpoint():
    # Mock DB session
    with patch("app.api.endpoints.get_db") as mock_get_db:
        mock_db = AsyncMock()
        mock_get_db.return_value = mock_db
        
        # Mock DialogueManager.process_request
        with patch("app.api.endpoints.dm.process_request", new_callable=AsyncMock) as mock_process:
            mock_process.return_value = {
                "intent": "chat",
                "reply": "Hello!",
                "actions": []
            }
            
            payload = {
                "session_id": "test-session",
                "query": "Hello",
                "user_id": "test-user"
            }
            
            async with AsyncClient(app=app, base_url="http://test") as ac:
                response = await ac.post("/api/v1/chat/completions", json=payload)
                
            assert response.status_code == 200
            assert response.json()["code"] == 0
            assert response.json()["data"]["reply"] == "Hello!"
