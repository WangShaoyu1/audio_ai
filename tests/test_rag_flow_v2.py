import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.models.base import User, Document, RAGTestRecord
from app.db.session import AsyncSessionLocal
from sqlalchemy import select, delete
import uuid
from app.core.security import create_access_token

# Mock user
TEST_USER_ID = uuid.uuid4()
TEST_PHONE = "13800138000"

@pytest.mark.asyncio
async def test_rag_flow_v2():
    async with AsyncSessionLocal() as db_session:
        # Create or get test user
        stmt = select(User).filter(User.phone == TEST_PHONE)
        result = await db_session.execute(stmt)
        user = result.scalars().first()
        if not user:
            user = User(id=TEST_USER_ID, phone=TEST_PHONE)
            db_session.add(user)
            await db_session.commit()
        
        token = create_access_token(subject=str(user.id))
        headers = {"Authorization": f"Bearer {token}"}
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as async_client:
            # 1. Upload Document
            files = {"file": ("test_rag_v2.txt", "This is a test document for RAG flow version 2.", "text/plain")}
            response = await async_client.post("/api/v1/admin/documents/upload", files=files, headers=headers)
            assert response.status_code == 200
            doc_id = response.json()["id"]
            print(f"Uploaded doc: {doc_id}")
            
            # 2. Index Document (Mocking index process)
            stmt = select(Document).filter(Document.id == doc_id)
            result = await db_session.execute(stmt)
            doc = result.scalar_one()
            doc.status = 'indexed'
            await db_session.commit()
            
            # 3. Update Config Status
            response = await async_client.put(
                f"/api/v1/admin/documents/{doc_id}/config_status?is_configured=true",
                headers=headers
            )
            assert response.status_code == 200
            assert response.json()["is_configured"] == True
            
            # Verify in DB
            await db_session.refresh(doc)
            assert doc.is_configured == True
            
            # 4. Run Recall Test (Retrieve)
            retrieve_payload = {
                "query": "test query",
                "doc_id": doc_id,
                "top_k": 3
            }
            
            response = await async_client.post("/api/v1/admin/rag/retrieve", json=retrieve_payload, headers=headers)
            assert response.status_code == 200
            
            # 5. List Recall Tests
            response = await async_client.get(f"/api/v1/admin/rag/tests?doc_id={doc_id}", headers=headers)
            assert response.status_code == 200
            tests = response.json()
            assert len(tests) >= 1
            assert tests[0]["query"] == "test query"
            assert tests[0]["doc_id"] == doc_id
            
            # Clean up
            await async_client.delete(f"/api/v1/admin/documents/{doc_id}", headers=headers)
