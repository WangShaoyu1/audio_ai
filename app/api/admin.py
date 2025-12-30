from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.services.instruction_service import InstructionService
from app.services.rag_engine import RAGEngine
from app.models.base import Document
from typing import List, Dict, Any
import uuid

router = APIRouter()

@router.post("/admin/instructions")
async def create_instruction(
    data: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    service = InstructionService(db)
    try:
        return await service.create_instruction(data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/admin/instructions")
async def list_instructions(db: AsyncSession = Depends(get_db)):
    service = InstructionService(db)
    return await service.get_all_instructions()

@router.post("/admin/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    # 1. Save file metadata
    doc_id = uuid.uuid4()
    doc = Document(id=doc_id, filename=file.filename, status="processing")
    db.add(doc)
    await db.commit()
    
    # 2. Read content (Simplified: assume text file)
    # In prod: use OCR/PDF parser
    content = (await file.read()).decode("utf-8")
    
    # 3. Indexing
    rag = RAGEngine(db)
    await rag.index_document(doc_id, content)
    
    # 4. Update status
    doc.status = "indexed"
    await db.commit()
    
    return {"id": str(doc_id), "status": "indexed"}
