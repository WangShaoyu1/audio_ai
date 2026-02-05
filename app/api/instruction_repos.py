from fastapi import APIRouter, Depends, HTTPException, Body
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.services.instruction_repo_service import InstructionRepositoryService
from app.models.base import User
from app.api.deps import get_current_user
from app.core.route_logging import LoggingContextRoute
import uuid
from pydantic import BaseModel

router = APIRouter(route_class=LoggingContextRoute)

class RepoCreate(BaseModel):
    name: str
    device_type: str
    language: Optional[str] = "zh"
    description: Optional[str] = None

class RepoUpdate(BaseModel):
    name: Optional[str] = None
    device_type: Optional[str] = None
    language: Optional[str] = None
    description: Optional[str] = None

@router.get("/instruction-repos")
async def list_repositories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = InstructionRepositoryService(db)
    return await service.get_repositories(user_id=current_user.id)

@router.post("/instruction-repos")
async def create_repository(
    repo: RepoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = InstructionRepositoryService(db)
    return await service.create_repository(repo.dict(), user_id=current_user.id)

@router.put("/instruction-repos/{repo_id}")
async def update_repository(
    repo_id: str,
    repo: RepoUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = InstructionRepositoryService(db)
    try:
        repo_uuid = uuid.UUID(repo_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID")
        
    result = await service.update_repository(repo_uuid, repo.dict(exclude_unset=True), user_id=current_user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Repository not found")
    return result

@router.delete("/instruction-repos/{repo_id}")
async def delete_repository(
    repo_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = InstructionRepositoryService(db)
    try:
        repo_uuid = uuid.UUID(repo_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID")
        
    result = await service.delete_repository(repo_uuid, user_id=current_user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Repository not found")
    return {"status": "success"}
