from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, delete
from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.base import User, ChatSession
from pydantic import BaseModel
from typing import List

router = APIRouter()

class SessionRenameRequest(BaseModel):
    name: str

class SessionResponse(BaseModel):
    id: str
    name: str
    created_at: str

@router.get("/sessions", response_model=List[SessionResponse])
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(ChatSession)
        .filter(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.created_at.desc())
    )
    sessions = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "name": s.name or "New Chat",
            "created_at": s.created_at.isoformat()
        }
        for s in sessions
    ]

@router.put("/sessions/{session_id}/rename")
async def rename_session(
    session_id: str,
    request: SessionRenameRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify ownership
    result = await db.execute(
        select(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session.name = request.name
    await db.commit()
    return {"status": "success", "name": session.name}

@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify ownership
    result = await db.execute(
        select(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    await db.delete(session)
    await db.commit()
    return {"status": "success"}
