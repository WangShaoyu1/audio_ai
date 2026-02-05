from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, delete, or_
from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.base import User, Session as ChatSession
from app.core.route_logging import LoggingContextRoute
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(route_class=LoggingContextRoute)

class SessionRenameRequest(BaseModel):
    name: str

class SessionResponse(BaseModel):
    id: str
    name: str
    created_at: str
    timezone: str = "Asia/Shanghai"

@router.post("/sessions", response_model=SessionResponse)
async def create_session(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_session = ChatSession(
        user_id=current_user.id,
        name="New Chat"
    )
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    
    return {
        "id": str(new_session.id),
        "name": new_session.name,
        "created_at": new_session.start_time.isoformat(),
        "timezone": new_session.timezone or "Asia/Shanghai"
    }

@router.get("/sessions", response_model=List[SessionResponse])
async def list_sessions(
    repository_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(ChatSession).filter(ChatSession.user_id == current_user.id)

    if repository_id:
        query = query.filter(
            ChatSession.context.isnot(None),
            or_(
                ChatSession.context['INSTRUCTION_REPO_ID'].astext == repository_id,
                ChatSession.context['llm_config']['INSTRUCTION_REPO_ID'].astext == repository_id
            )
        )

    result = await db.execute(
        query.order_by(ChatSession.start_time.desc())
    )
    sessions = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "name": s.name or "New Chat",
            "created_at": s.start_time.isoformat(),
            "timezone": s.timezone or "Asia/Shanghai"
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

@router.put("/sessions/{session_id}/config")
async def update_session_config(
    session_id: str,
    config: dict,
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
    
    # Update timezone if present
    if "timezone" in config:
        session.timezone = config["timezone"]
    
    # Update language if present
    if "language" in config:
        session.language = config["language"]
    
    # Update context with other config
    current_context = session.context or {}
    current_context.update(config)
    session.context = current_context
    
    await db.commit()
    return {"status": "success", "config": config}

@router.get("/sessions/{session_id}/config")
async def get_session_config(
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
    
    config = session.context or {}
    # Create a copy to avoid modifying the session object and handle nested llm_config
    if config:
        config = config.copy()
        if "llm_config" in config and isinstance(config["llm_config"], dict):
            llm_config = config.pop("llm_config")
            config.update(llm_config)
    else:
        config = {}

    config["timezone"] = session.timezone or "Asia/Shanghai"
    config["language"] = session.language or "zh"
    
    return config

@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.base import Message

    # Verify ownership
    result = await db.execute(
        select(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Delete messages first (to handle FK constraints if cascade is not set)
    await db.execute(
        delete(Message).where(Message.session_id == session_id)
    )
    
    await db.delete(session)
    await db.commit()
    return {"status": "success"}

@router.get("/sessions/{session_id}/history")
async def get_session_history(
    session_id: str,
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.base import Message
    import pytz
    from datetime import timezone
    
    # Verify ownership
    result = await db.execute(
        select(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Fetch messages
    result = await db.execute(
        select(Message)
        .filter(Message.session_id == session_id)
        .order_by(Message.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    messages = result.scalars().all()
    
    # Return in chronological order (reversed from desc fetch)
    target_tz = pytz.timezone(session.timezone or "Asia/Shanghai")
    formatted_messages = []
    for msg in reversed(messages):
        dt = msg.created_at
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        dt = dt.astimezone(target_tz)
        
        formatted_messages.append({
            "id": str(msg.id),
            "role": msg.role,
            "content": msg.content,
            "timestamp": dt.isoformat(),
            "metadata": msg.metadata_,
            "hit_source": msg.hit_source,
            "hit_count": msg.hit_count
        })
    return formatted_messages

@router.get("/search/messages")
async def search_messages(
    q: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.base import Message
    from sqlalchemy import or_
    import pytz
    from datetime import timezone
    
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
        select(Message, ChatSession.name.label("session_name"), ChatSession.timezone.label("session_timezone"))
        .join(ChatSession, Message.session_id == ChatSession.id)
        .filter(
            Message.session_id.in_(user_session_ids),
            Message.content.ilike(f"%{q}%")
        )
        .order_by(Message.created_at.desc())
        .limit(20)
    )
    
    result = await db.execute(messages_query)
    matches = result.all()
    
    formatted_matches = []
    for msg in matches:
        # msg is a Row object with (Message, session_name, session_timezone)
        message_obj = msg[0]
        session_name = msg[1]
        session_tz_str = msg[2] or "Asia/Shanghai"
        
        dt = message_obj.created_at
        if dt:
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            target_tz = pytz.timezone(session_tz_str)
            dt = dt.astimezone(target_tz)
            timestamp_str = dt.isoformat()
        else:
            timestamp_str = ""

        formatted_matches.append({
            "session_id": str(message_obj.session_id),
            "session_name": session_name or "New Chat",
            "message_id": str(message_obj.id),
            "content": message_obj.content,
            "role": message_obj.role,
            "timestamp": timestamp_str,
            "hit_source": message_obj.hit_source,
            "hit_count": message_obj.hit_count
        })
    
    return formatted_matches

class UpdateMessageRequest(BaseModel):
    content: str

@router.put("/sessions/{session_id}/messages/{message_id}")
async def update_message(
    session_id: str,
    message_id: str,
    request: UpdateMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.base import Message
    
    # Verify session ownership
    result = await db.execute(
        select(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    # Get message
    result = await db.execute(
        select(Message).filter(Message.id == message_id, Message.session_id == session_id)
    )
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
        
    msg.content = request.content
    # Also update the json content if it's an instruction response to keep them in sync?
    # But usually we just update the raw content. 
    # If the content is JSON, we should try to preserve structure? 
    # For now, just update raw content as the user likely edits the text.
    
    await db.commit()
    return {"status": "success", "content": msg.content}
