import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock, MagicMock
from app.main import app
from app.core.config import settings

client = TestClient(app)

class MockAsyncClient:
    def __init__(self, *args, **kwargs):
        pass
        
    async def __aenter__(self):
        return self
        
    async def __aexit__(self, exc_type, exc, tb):
        pass
        
    async def get(self, url):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "models": [
                {
                    "name": "bge-large:latest",
                    "model": "bge-large:latest",
                    "modified_at": "2026-01-20T19:43:44+08:00",
                    "size": 670532029,
                    "digest": "b3d71c92805938e2c9d78"
                }
            ]
        }
        mock_resp.raise_for_status = MagicMock()
        return mock_resp

@pytest.mark.asyncio
async def test_list_ollama_models():
    # Patch httpx.AsyncClient to return our MockAsyncClient
    with patch("httpx.AsyncClient", side_effect=MockAsyncClient):
        
        from app.api.deps import get_current_user
        from app.models.base import User
        
        async def mock_get_current_user():
            return User(id=1, phone="1234567890")
            
        app.dependency_overrides[get_current_user] = mock_get_current_user
        
        # Make the request
        response = client.get("/api/v1/admin/ollama/models")
        
        assert response.status_code == 200
        data = response.json()
        assert "models" in data
        assert "bge-large:latest" in data["models"]
        
        print("\nSuccess! Models fetched:", data["models"])
