from fastapi import FastAPI
from app.api.endpoints import router as api_router
from app.api.admin import router as admin_router
from app.core.config import settings
from app.core.middleware import log_requests
from starlette.middleware.base import BaseHTTPMiddleware

app = FastAPI(title=settings.PROJECT_NAME)
app.add_middleware(BaseHTTPMiddleware, dispatch=log_requests)

app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(admin_router, prefix=settings.API_V1_STR)

@app.get("/health")
async def health_check():
    return {"status": "ok"}
