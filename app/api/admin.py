from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.session import get_db
from app.services.instruction_service import InstructionService
from app.services.eval_service import EvalService
from app.services.instruction_import_service import InstructionImportService
from app.services.rag_engine import RAGEngine
from app.models.base import Document, User
from app.api.deps import get_current_user
from typing import List, Dict, Any
from pydantic import BaseModel
from app.core.route_logging import LoggingContextRoute
import uuid
import io

router = APIRouter(route_class=LoggingContextRoute)

@router.post("/admin/instructions")
async def create_instruction(
    data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = InstructionService(db)
    try:
        # Pass user_id to service
        return await service.create_instruction(data, user_id=current_user.id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/admin/instructions")
async def list_instructions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = InstructionService(db)
    # Pass user_id to service
    return await service.get_all_instructions(user_id=current_user.id)

@router.post("/admin/instructions/import")
async def import_instructions(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = InstructionImportService(db)
    try:
        content = await file.read()
        # Pass user_id to service
        return await service.import_from_excel(content, user_id=current_user.id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/admin/eval/batch")
async def run_batch_eval(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = EvalService(db)
    try:
        content = await file.read()
        # Pass user_id to service
        result_bytes = await service.run_batch_test(content, user_id=current_user.id)
        
        return StreamingResponse(
            io.BytesIO(result_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=eval_result.xlsx"}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/admin/documents")
async def list_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Implement list documents with user filter
    result = await db.execute(select(Document).filter(Document.user_id == current_user.id))
    docs = result.scalars().all()
    return docs

@router.post("/admin/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Save file metadata with user_id
    doc_id = uuid.uuid4()
    doc = Document(
        id=doc_id, 
        user_id=current_user.id, # Bind to current user
        filename=file.filename, 
        status="processing"
    )
    db.add(doc)
    await db.commit()
    
    # 2. Read content
    content = ""
    try:
        file_content = await file.read()
        
        if file.filename.lower().endswith('.pdf'):
            import io
            from pypdf import PdfReader
            pdf_file = io.BytesIO(file_content)
            reader = PdfReader(pdf_file)
            text_content = []
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    text_content.append(text)
            content = "\n".join(text_content)
        else:
            try:
                content = file_content.decode("utf-8")
            except UnicodeDecodeError:
                # Try latin-1 as fallback
                content = file_content.decode("latin-1")
        
        if not content.strip():
            raise ValueError("Empty document content")

        # 3. Indexing
        rag = RAGEngine(db)
        await rag.index_document(doc_id, content)
        
        # 4. Update status
        doc.status = "indexed"
        await db.commit()
        
    except Exception as e:
        doc.status = "failed"
        await db.commit()
        from app.core.logger import logger
        logger.exception(f"Document upload failed for {doc_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Document processing failed: {str(e)}")
    
    return {"id": str(doc_id), "status": "indexed"}

class RetrieveRequest(BaseModel):
    query: str
    top_k: int = 3

@router.post("/admin/rag/retrieve")
async def retrieve_documents(
    request: RetrieveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    rag = RAGEngine(db)
    results = await rag.search(request.query, current_user.id, request.top_k)
    return {"results": results}
