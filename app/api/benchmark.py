
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from typing import List, Optional
from pydantic import BaseModel
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.responses import Response, StreamingResponse
import io

from app.api.deps import get_db, get_current_user
from app.services.benchmark_service import BenchmarkService
from app.services.instruction_matcher import matcher_service
from app.models.base import User

router = APIRouter()

class BenchmarkCaseCreate(BaseModel):
    question: str
    answer: str
    intent: Optional[str] = "instruction"
    repository_id: Optional[uuid.UUID] = None

class BenchmarkCaseUpdate(BaseModel):
    question: Optional[str] = None
    answer: Optional[str] = None
    intent: Optional[str] = None

class BenchmarkCaseResponse(BaseModel):
    id: uuid.UUID
    question: str
    answer: str
    intent: str
    repository_id: Optional[uuid.UUID]
    version: int
    source: str
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

class BenchmarkListResponse(BaseModel):
    total: int
    items: List[BenchmarkCaseResponse]

class GeneratePairsRequest(BaseModel):
    provider: Optional[str] = None
    model_name: Optional[str] = None
    count_per_instr: int = 3

@router.get("", response_model=BenchmarkListResponse)
async def get_cases(
    skip: int = 0,
    limit: int = 100,
    query: Optional[str] = None,
    repository_id: Optional[uuid.UUID] = None,
    version: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = BenchmarkService(db)
    items = await service.get_cases(skip, limit, query, repository_id, version)
    total = await service.get_total_count(query, repository_id, version)
    return {"total": total, "items": items}

@router.get("/versions/{repo_id}", response_model=List[int])
async def get_versions(
    repo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = BenchmarkService(db)
    return await service.get_versions(repo_id)

@router.post("/versions/{repo_id}/apply")
async def apply_version(
    repo_id: uuid.UUID,
    version: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = BenchmarkService(db)
    try:
        await service.set_active_version(repo_id, version)
        await matcher_service.reload(db)
        return {"status": "success", "active_version": version}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/versions/{repo_id}/{version}")
async def delete_version(
    repo_id: uuid.UUID,
    version: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = BenchmarkService(db)
    count = await service.delete_version(repo_id, version)
    return {"status": "success", "deleted_count": count}

@router.get("/versions/{repo_id}/active")
async def get_active_version(
    repo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = BenchmarkService(db)
    version = await service.get_active_version(repo_id)
    return {"active_version": version}

@router.post("", response_model=BenchmarkCaseResponse)
async def create_case(
    case: BenchmarkCaseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = BenchmarkService(db)
    result = await service.create_case(case.question, case.answer, case.intent, case.repository_id)
    await matcher_service.reload(db)
    return result

@router.put("/{case_id}", response_model=BenchmarkCaseResponse)
async def update_case(
    case_id: uuid.UUID,
    case: BenchmarkCaseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = BenchmarkService(db)
    updated = await service.update_case(case_id, case.question, case.answer, case.intent)
    if not updated:
        raise HTTPException(status_code=404, detail="Case not found")
    await matcher_service.reload(db)
    return updated

@router.delete("/{case_id}")
async def delete_case(
    case_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = BenchmarkService(db)
    deleted = await service.delete_case(case_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Case not found")
    await matcher_service.reload(db)
    return {"status": "success"}

@router.post("/import")
async def import_excel(
    repository_id: Optional[uuid.UUID] = None,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files are allowed")
    
    content = await file.read()
    service = BenchmarkService(db)
    try:
        result = await service.import_excel(content, repository_id)
        await matcher_service.reload(db)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/export")
async def export_excel(
    repository_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = BenchmarkService(db)
    content = await service.export_excel(repository_id)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=benchmark_cases.xlsx"}
    )

@router.get("/template")
async def get_template(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = BenchmarkService(db)
    content = service.get_template()
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=benchmark_template.xlsx"}
    )

@router.post("/generate-pairs/{repo_id}")
async def generate_cases(
    repo_id: uuid.UUID,
    request: GeneratePairsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate benchmark cases from instruction repository.
    """
    service = BenchmarkService(db)
    try:
        count = await service.generate_system_pairs(
            repo_id=repo_id,
            provider=request.provider,
            model_name=request.model_name,
            count_per_instr=request.count_per_instr
        )
        await matcher_service.reload(db)
        return {"count": count, "message": f"Successfully generated {count} instruction pairs."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
