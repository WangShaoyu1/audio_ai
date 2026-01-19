from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
from app.db.session import get_db
from app.models.base import User
from app.core.security import create_access_token
from app.core.route_logging import LoggingContextRoute
from datetime import datetime
import uuid

router = APIRouter(route_class=LoggingContextRoute)

class LoginRequest(BaseModel):
    phone: str

class Token(BaseModel):
    access_token: str
    token_type: str

@router.post("/login", response_model=Token)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    # 1. Check if user exists
    result = await db.execute(select(User).filter(User.phone == request.phone))
    user = result.scalars().first()
    
    # 2. If not, create new user (Auto Registration)
    if not user:
        user = User(id=uuid.uuid4(), phone=request.phone)
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        # Update last login
        user.last_login = datetime.utcnow()
        await db.commit()
    
    # 3. Create access token
    access_token = create_access_token(subject=user.id)
    return {"access_token": access_token, "token_type": "bearer"}
