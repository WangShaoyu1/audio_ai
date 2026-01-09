from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.dialogue_manager import DialogueManager
from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.base import User

router = APIRouter()
dm = DialogueManager()

class ChatRequest(BaseModel):
    session_id: Optional[str] = None # Optional, if None create new
    query: str
    stream: bool = False

class ChatResponse(BaseModel):
    code: int
    data: Dict[str, Any]

@router.post("/chat/completions", response_model=ChatResponse)
async def chat(
    request: ChatRequest, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        # Pass current_user.id instead of request.user_id to ensure security
        result = await dm.process_request(
            request.session_id,
            request.query,
            str(current_user.id),
            db
        )
        return {"code": 0, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
