from fastapi import FastAPI
from app.api.endpoints import router as api_router
from app.api.admin import router as admin_router
from app.api.auth import router as auth_router
from app.api.templates import router as templates_router
from app.api.sessions import router as sessions_router
from app.core.config import settings
from app.core.middleware import log_requests
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title=settings.PROJECT_NAME)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# app.add_middleware(BaseHTTPMiddleware, dispatch=log_requests)

app.include_router(auth_router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(api_router, prefix=settings.API_V1_STR, tags=["chat"])
app.include_router(admin_router, prefix=settings.API_V1_STR, tags=["admin"])
app.include_router(templates_router, prefix=settings.API_V1_STR, tags=["templates"])
app.include_router(sessions_router, prefix=settings.API_V1_STR, tags=["sessions"])

@app.get("/health")
async def health_check():
    return {"status": "ok"}
