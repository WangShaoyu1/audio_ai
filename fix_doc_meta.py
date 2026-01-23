import asyncio
import uuid
from app.db.session import AsyncSessionLocal
from app.models.base import Document

async def fix_doc_metadata():
    doc_id_str = "7b91c365-7bf4-4088-9e59-631f0627f9b5"
    doc_id = uuid.UUID(doc_id_str)
    
    async with AsyncSessionLocal() as session:
        doc = await session.get(Document, doc_id)
        if doc:
            print(f"Updating doc {doc_id}...")
            doc.provider = "ollama"
            doc.model = "bge-large:latest"
            await session.commit()
            print("Update complete.")
        else:
            print("Doc not found.")

if __name__ == "__main__":
    asyncio.run(fix_doc_metadata())
