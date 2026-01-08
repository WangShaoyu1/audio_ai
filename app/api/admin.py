from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.services.instruction_service import InstructionService
from app.services.eval_service import EvalService
from app.services.instruction_import_service import InstructionImportService
from app.services.rag_engine import RAGEngine
from app.models.base import Document
from typing import List, Dict, Any
import uuid
import io

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

@router.post("/admin/instructions/import")
async def import_instructions(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    service = InstructionImportService(db)
    try:
        content = await file.read()
        return await service.import_from_excel(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/admin/eval/batch")
async def run_batch_eval(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    service = EvalService(db)
    try:
        content = await file.read()
        result_bytes = await service.run_batch_test(content)
        
        return StreamingResponse(
            io.BytesIO(result_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=eval_result.xlsx"}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

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
    try:
        content = (await file.read()).decode("utf-8")
    except UnicodeDecodeError:
        # Fallback for binary files (mocking text extraction)
        content = "Binary file content placeholder"
    
    # 3. Indexing
    rag = RAGEngine(db)
    await rag.index_document(doc_id, content)
    
    # 4. Update status
    doc.status = "indexed"
    await db.commit()
    
    return {"id": str(doc_id), "status": "indexed"}
