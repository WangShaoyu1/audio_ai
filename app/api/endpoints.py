from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from app.services.dialogue_manager import DialogueManager

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
async def chat(request: ChatRequest):
    try:
        result = await dm.process_request(
            request.session_id,
            request.query,
            request.user_id
        )
        return {"code": 0, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
