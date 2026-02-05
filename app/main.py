from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.api.endpoints import router as api_router
from app.api.admin import router as admin_router
from app.api.auth import router as auth_router
from app.api.templates import router as templates_router
from app.api.sessions import router as sessions_router
from app.api.instruction_repos import router as instruction_repos_router
from app.api.feedback import router as feedback_router
from app.api.benchmark import router as benchmark_router
from app.core.config import settings
from app.core.redis import RedisClient
from fastapi.middleware.cors import CORSMiddleware
from app.services.instruction_matcher import matcher_service
from app.db.session import AsyncSessionLocal

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    try:
        async with AsyncSessionLocal() as db:
            await matcher_service.reload(db)
    except Exception as e:
        print(f"Failed to load instruction matcher: {e}")
    yield
    # Shutdown
    await RedisClient.close()

app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

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
app.include_router(instruction_repos_router, prefix=settings.API_V1_STR, tags=["instruction-repos"])
app.include_router(feedback_router, prefix=settings.API_V1_STR, tags=["feedback"])
app.include_router(benchmark_router, prefix=f"{settings.API_V1_STR}/benchmark", tags=["benchmark"])

@app.get("/health")
async def health_check():
    return {"status": "ok"}
