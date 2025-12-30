from fastapi import FastAPI
from app.api.endpoints import router
from app.core.config import settings

app = FastAPI(title=settings.PROJECT_NAME)

app.include_router(router, prefix=settings.API_V1_STR)

@app.get("/health")
async def health_check():
    return {"status": "ok"}
