from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, delete
from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.base import User, Session as ChatSession
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
        .order_by(ChatSession.start_time.desc())
    )
    sessions = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "name": s.name or "New Chat",
            "created_at": s.start_time.isoformat()
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

@router.get("/sessions/{session_id}/history")
async def get_session_history(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.base import ChatMessage
    
    # Verify ownership
    result = await db.execute(
        select(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Fetch messages
    result = await db.execute(
        select(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.timestamp.asc())
    )
    messages = result.scalars().all()
    
    return [
        {
            "role": msg.role,
            "content": msg.content,
            "timestamp": msg.timestamp.isoformat()
        }
        for msg in messages
    ]

@router.get("/search/messages")
async def search_messages(
    q: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.base import ChatMessage
    from sqlalchemy import or_
    
    if not q:
        return []
        
    # Search in sessions (names) and messages (content)
    # First, find sessions belonging to user
    user_sessions_query = select(ChatSession.id).filter(ChatSession.user_id == current_user.id)
    user_sessions_result = await db.execute(user_sessions_query)
    user_session_ids = user_sessions_result.scalars().all()
    
    if not user_session_ids:
        return []
        
    # Search messages in these sessions
    messages_query = (
        select(ChatMessage, ChatSession.name.label("session_name"))
        .join(ChatSession, ChatMessage.session_id == ChatSession.id)
        .filter(
            ChatMessage.session_id.in_(user_session_ids),
            ChatMessage.content.ilike(f"%{q}%")
        )
        .order_by(ChatMessage.timestamp.desc())
        .limit(20)
    )
    
    result = await db.execute(messages_query)
    matches = result.all()
    
    return [
        {
            "session_id": str(msg.ChatMessage.session_id),
            "session_name": msg.session_name or "New Chat",
            "message_id": str(msg.ChatMessage.id),
            "content": msg.ChatMessage.content,
            "role": msg.ChatMessage.role,
            "timestamp": msg.ChatMessage.timestamp.isoformat()
        }
        for msg in matches
    ]
