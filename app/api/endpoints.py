from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.dialogue_manager import DialogueManager
from app.db.session import get_db

router = APIRouter()
dm = DialogueManager()

class ChatRequest(BaseModel):
    session_id: str
    query: str
    user_id: str
    stream: bool = False

class ChatResponse(BaseModel):
    code: int
    data: Dict[str, Any]

@router.post("/chat/completions", response_model=ChatResponse)
async def chat(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    try:
        result = await dm.process_request(
            request.session_id,
            request.query,
            request.user_id,
            db
        )
        return {"code": 0, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
