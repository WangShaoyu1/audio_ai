from fastapi import APIRouter, Depends, HTTPException
from fastapi import Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any, Union
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.dialogue_manager import DialogueManager
from app.db.session import get_db, AsyncSessionLocal
from app.api.deps import get_current_user
from app.models.base import User
from app.core.route_logging import LoggingContextRoute
import json
import asyncio

router = APIRouter(route_class=LoggingContextRoute)
dm = DialogueManager()

class ChatRequest(BaseModel):
    session_id: Optional[str] = None # Optional, if None create new
    query: str
    stream: bool = False

class ChatResponse(BaseModel):
    code: int
    data: Dict[str, Any]

@router.post("/chat/completions", response_model=Union[ChatResponse, Any])
async def chat(
    request: ChatRequest, 
    raw_request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        trace_id = getattr(raw_request.state, "request_id", None)
        
        if request.stream:
            async def generate():
                # Use a new session for streaming to avoid premature closure
                try:
                    async with AsyncSessionLocal() as session:
                        async for chunk in dm.stream_process_request(
                            request.session_id,
                            request.query,
                            str(current_user.id),
                            session,
                            trace_id=trace_id
                        ):
                            if isinstance(chunk, dict):
                                # Metadata/Actions chunk
                                yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
                            else:
                                # Content chunk
                                yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"
                        yield "data: [DONE]\n\n"
                except BaseException as e:
                    # Check for cancellation/exit to avoid yielding during cleanup
                    if isinstance(e, (GeneratorExit, asyncio.CancelledError)):
                        # Stream cancelled by client or server shutdown
                        return

                    import logging
                    logger = logging.getLogger(__name__)
                    logger.error(f"Stream generation error: {e}", exc_info=True)
                    
                    try:
                        # Send error as content to be displayed to user
                        error_msg = f"\n\n[System Error] {str(e)}"
                        yield f"data: {json.dumps({'content': error_msg}, ensure_ascii=False)}\n\n"
                        yield "data: [DONE]\n\n"
                    except BaseException:
                        # If yielding fails (e.g. connection closed), just exit
                        pass
            
            return StreamingResponse(generate(), media_type="text/event-stream")
        else:
            # Pass current_user.id instead of request.user_id to ensure security
            result = await dm.process_request(
                request.session_id,
                request.query,
                str(current_user.id),
                db,
                trace_id=trace_id
            )
            return {"code": 0, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
