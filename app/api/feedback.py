from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Literal, Optional
from pydantic import BaseModel
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_db, get_current_user
from app.services.feedback_service import FeedbackService
from app.services.instruction_matcher import matcher_service
from app.models.base import User, Message, Session
from sqlalchemy import select
import json

router = APIRouter()

class FeedbackRequest(BaseModel):
    feedback: Literal["like", "dislike", "delete"]

class BatchFeedbackRequest(BaseModel):
    message_ids: List[uuid.UUID]
    feedback: Literal["like", "dislike", "delete"]

class InstructionPairResponse(BaseModel):
    id: uuid.UUID
    session_id: Optional[uuid.UUID]
    session_name: Optional[str]
    question: str
    answer: str
    timestamp: datetime
    feedback: Optional[str]
    intent: str
    hit_count: Optional[int] = 0
    hit_source: Optional[str] = None

@router.post("/messages/{message_id}/feedback")
async def submit_feedback(
    message_id: uuid.UUID,
    request: FeedbackRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = FeedbackService(db)
    try:
        await service.submit_feedback(message_id, request.feedback)
        
        # Adaptive Learning: If Like, promote to System Pairs (Generalized)
        if request.feedback == "like":
            try:
                stmt = select(Message).where(Message.id == message_id)
                result = await db.execute(stmt)
                msg = result.scalar_one_or_none()
                
                if msg and msg.role == "assistant":
                    meta = msg.metadata_ or {}
                    # Only learn if it was an instruction
                    if meta.get("route") == "instruction":
                        reply_to_id = meta.get("reply_to")
                        if reply_to_id:
                            stmt_user = select(Message).where(Message.id == reply_to_id)
                            res_user = await db.execute(stmt_user)
                            user_msg = res_user.scalar_one_or_none()
                            
                            if user_msg:
                                try:
                                    # Fetch Session to get Repository ID
                                    repo_id = None
                                    try:
                                        stmt_session = select(Session).where(Session.id == msg.session_id)
                                        res_session = await db.execute(stmt_session)
                                        session_obj = res_session.scalar_one_or_none()
                                        if session_obj and session_obj.context:
                                            repo_id_str = session_obj.context.get("llm_config", {}).get("INSTRUCTION_REPO_ID")
                                            if repo_id_str:
                                                repo_id = uuid.UUID(repo_id_str)
                                    except Exception as e:
                                        print(f"Failed to get repository ID from session: {e}")

                                    answer_json = json.loads(msg.content)
                                    await matcher_service.generalize_and_save(user_msg.content, answer_json, db, repository_id=repo_id)
                                except Exception as e:
                                    # Skip if not JSON or other error
                                    pass
            except Exception as e:
                print(f"Error during manual learning in single feedback: {e}")
                
        return {"status": "success"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sessions/{session_id}/feedback/batch")
async def batch_submit_feedback(
    session_id: uuid.UUID,
    request: BatchFeedbackRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = FeedbackService(db)
    await service.batch_submit_feedback(request.message_ids, request.feedback)
    return {"status": "success"}

@router.get("/feedback/instruction-pairs", response_model=List[InstructionPairResponse])
async def get_instruction_pairs(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    marked: Optional[bool] = Query(None),
    order: Literal["asc", "desc"] = Query("desc"),
    session_query: Optional[str] = Query(None),
    session_ids: Optional[List[uuid.UUID]] = Query(None),
    source: Literal["user", "system"] = Query("user"),
    repository_id: Optional[uuid.UUID] = Query(None),
    version: Optional[int] = Query(None),
    unmatched: Optional[bool] = Query(None),
    sort_by: Optional[str] = Query(None),
    hit_source: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = FeedbackService(db)
    try:
        pairs = await service.get_instruction_pairs(
            start_date=start_date, 
            end_date=end_date, 
            marked=marked, 
            order=order, 
            session_query=session_query, 
            session_ids=session_ids, 
            source=source, 
            repository_id=repository_id, 
            version=version,
            unmatched=unmatched,
            sort_by=sort_by,
            hit_source=hit_source
        )
        return pairs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/feedback/batch-global")
async def batch_global_feedback(
    request: BatchFeedbackRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = FeedbackService(db)

    if request.feedback == "delete":
        # Handle batch delete
        from app.models.base import BenchmarkCase
        from sqlalchemy import delete, update
        
        try:
            # 1. Try to delete from BenchmarkCase (System Pairs)
            stmt = delete(BenchmarkCase).where(BenchmarkCase.id.in_(request.message_ids))
            res = await db.execute(stmt)
            
            # 2. Also try to Unmark (feedback='deleted') for Messages (User History)
            # This allows "deleting" from the "Marked" view in the UI without losing chat history.
            stmt_msg = update(Message).where(Message.id.in_(request.message_ids)).values(feedback='deleted')
            await db.execute(stmt_msg)
            
            await db.commit()
            
            # Trigger matcher reload (in case System Pairs were deleted)
            await matcher_service.reload(db)
        except Exception as e:
            print(f"Error during batch delete: {e}")
            raise HTTPException(status_code=500, detail=str(e))
            
        return {"status": "success"}

    await service.batch_submit_feedback(request.message_ids, request.feedback)
    
    # Adaptive Learning: If Like, promote to System Pairs (Generalized)
    if request.feedback == "like":
        try:
            # Fetch messages
            stmt = select(Message).where(Message.id.in_(request.message_ids))
            result = await db.execute(stmt)
            messages = result.scalars().all()
            
            for msg in messages:
                if msg.role == "assistant":
                    meta = msg.metadata_ or {}
                    # Only learn if it was an instruction
                    if meta.get("route") == "instruction":
                        reply_to_id = meta.get("reply_to")
                        if reply_to_id:
                            stmt_user = select(Message).where(Message.id == reply_to_id)
                            res_user = await db.execute(stmt_user)
                            user_msg = res_user.scalar_one_or_none()
                            
                            if user_msg:
                                try:
                                    # Fetch Session to get Repository ID
                                    repo_id = None
                                    try:
                                        stmt_session = select(Session).where(Session.id == msg.session_id)
                                        res_session = await db.execute(stmt_session)
                                        session_obj = res_session.scalar_one_or_none()
                                        if session_obj and session_obj.context:
                                            repo_id_str = session_obj.context.get("llm_config", {}).get("INSTRUCTION_REPO_ID")
                                            if repo_id_str:
                                                repo_id = uuid.UUID(repo_id_str)
                                    except Exception as e:
                                        print(f"Failed to get repository ID from session in batch: {e}")

                                    answer_json = json.loads(msg.content)
                                    await matcher_service.generalize_and_save(user_msg.content, answer_json, db, repository_id=repo_id)
                                except Exception as e:
                                    # Skip if not JSON or other error
                                    pass
        except Exception as e:
            # Log error but don't fail the request
            print(f"Error during manual learning in batch feedback: {e}")

    return {"status": "success"}
