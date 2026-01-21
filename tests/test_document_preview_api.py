import pytest
import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.api.deps import get_current_user, get_db
from app.models.base import User, Document
from sqlalchemy.ext.asyncio import AsyncSession

# Mock User
mock_user = User(
    id=uuid.uuid4(),
    phone="1234567890",
)

async def mock_get_current_user():
    return mock_user

@pytest.mark.asyncio
async def test_list_documents_optimization():
    # Override dependencies
    app.dependency_overrides[get_current_user] = mock_get_current_user
    
    mock_db = AsyncMock(spec=AsyncSession)
    
    # Create mock documents
    doc1 = Document(
        id=uuid.uuid4(),
        user_id=mock_user.id,
        filename="test1.pdf",
        status="indexed",
        created_at=datetime.now(),
        is_configured=True,
        content="Hidden content 1"
    )
    doc2 = Document(
        id=uuid.uuid4(),
        user_id=mock_user.id,
        filename="test2.docx",
        status="uploaded",
        created_at=datetime.now(),
        is_configured=False,
        content="Hidden content 2"
    )
    
    # Mock execute result
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [doc1, doc2]
    mock_db.execute.return_value = mock_result
    
    # Mock total count result
    mock_count_result = MagicMock()
    mock_count_result.scalar.return_value = 2
    
    # We need to handle multiple execute calls (count and list)
    # The first call is for count, second for list
    # But checking exact call order is tricky with AsyncMock side_effect
    # Let's just make it return the list result for the second call
    # Actually, side_effect can be an iterable
    mock_db.execute.side_effect = [mock_count_result, mock_result]

    async def override_get_db():
        yield mock_db
        
    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/admin/documents")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2
        
        # Verify content is NOT in the response
        assert "content" not in data["items"][0]
        assert data["items"][0]["filename"] == "test1.pdf"
        
        # Verify call to DB used defer (conceptually)
        # We can't easily verify the SQL query construction here without integration test
        # but we verified response model excludes content.

@pytest.mark.asyncio
async def test_get_document_details():
    # Override dependencies
    app.dependency_overrides[get_current_user] = mock_get_current_user
    
    mock_db = AsyncMock(spec=AsyncSession)
    doc_id = uuid.uuid4()
    
    doc = Document(
        id=doc_id,
        user_id=mock_user.id,
        filename="test.docx",
        status="uploaded",
        created_at=datetime.now(),
        is_configured=False,
        content="Visible content"
    )
    
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = doc
    mock_db.execute.return_value = mock_result
    
    async def override_get_db():
        yield mock_db
        
    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get(f"/api/v1/admin/documents/{doc_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["content"] == "Visible content"

@pytest.mark.asyncio
async def test_upload_sets_file_path():
    """Verify that uploading a document sets the file_path attribute."""
    app.dependency_overrides[get_current_user] = mock_get_current_user
    
    mock_db = AsyncMock(spec=AsyncSession)
    
    async def override_get_db():
        yield mock_db
    
    app.dependency_overrides[get_db] = override_get_db
    
    # Create a dummy file
    file_content = b"test content"
    files = {"file": ("test.pdf", file_content, "application/pdf")}
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/api/v1/admin/documents/upload", files=files)
        
        assert response.status_code == 200
        data = response.json()
        assert data["filename"] == "test.pdf"
        
        # Verify db.add was called with a Document having file_path set
        # We need to inspect the call args of db.add
        assert mock_db.add.called
        added_doc = mock_db.add.call_args[0][0]
        assert isinstance(added_doc, Document)
        
        # Debug info
        print(f"Added Doc: {added_doc.__dict__}")
        
        assert added_doc.filename == "test.pdf"
        assert added_doc.file_path is not None
        assert "uploads" in added_doc.file_path
        
        # Clean up created file
        import os
        if os.path.exists(added_doc.file_path):
            os.remove(added_doc.file_path)

@pytest.mark.asyncio
async def test_delete_document_cleans_up():
    """Verify that deleting a document cleans up chunks and original file."""
    app.dependency_overrides[get_current_user] = mock_get_current_user
    
    mock_db = AsyncMock(spec=AsyncSession)
    doc_id = uuid.uuid4()
    
    # Mock document to delete
    mock_doc = Document(
        id=doc_id,
        user_id=mock_user.id,
        filename="to_delete.pdf",
        file_path="uploads/dummy_to_delete.pdf"
    )
    
    # Create dummy file to delete
    import os
    if not os.path.exists("uploads"):
        os.makedirs("uploads")
    with open(mock_doc.file_path, "wb") as f:
        f.write(b"delete me")
    
    # Mock finding the document
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_doc
    mock_db.execute.return_value = mock_result
    
    async def override_get_db():
        yield mock_db
    
    app.dependency_overrides[get_db] = override_get_db
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.delete(f"/api/v1/admin/documents/{doc_id}")
        
        assert response.status_code == 200
        
        # Verify deletions
        # 1. Document chunks
        # 2. RAG Test records
        # 3. The document itself
        # 4. The physical file
        
        assert not os.path.exists(mock_doc.file_path)
        
        # Verify SQL execute calls for deletion
        # We expect at least 3 execute calls (select doc, delete chunks, delete rag records) + delete doc
        # Note: delete() constructs are passed to execute
        assert mock_db.execute.call_count >= 2 # Select + Delete chunks/rag
        assert mock_db.delete.called # Delete doc object

@pytest.mark.asyncio
async def test_get_raw_file():
    """Verify that we can retrieve the raw file."""
    app.dependency_overrides[get_current_user] = mock_get_current_user
    
    mock_db = AsyncMock(spec=AsyncSession)
    doc_id = uuid.uuid4()
    
    # Create dummy file
    import os
    file_path = "uploads/test_raw_view.txt"
    if not os.path.exists("uploads"):
        os.makedirs("uploads")
    with open(file_path, "wb") as f:
        f.write(b"Raw content view")
        
    mock_doc = Document(
        id=doc_id,
        user_id=mock_user.id,
        filename="test_raw_view.txt",
        file_path=file_path
    )
    
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_doc
    mock_db.execute.return_value = mock_result
    
    async def override_get_db():
        yield mock_db
    
    app.dependency_overrides[get_db] = override_get_db
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get(f"/api/v1/admin/documents/{doc_id}/file")
        
        assert response.status_code == 200
        assert response.content == b"Raw content view"
        
    # Cleanup
    if os.path.exists(file_path):
        os.remove(file_path)
