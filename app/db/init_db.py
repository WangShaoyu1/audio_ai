import asyncio
from app.db.session import engine
from app.models.base import Base
from app.models.instruction import Instruction
from app.models.rag_config import RAGConfig

async def init_models():
    async with engine.begin() as conn:
        # In production, use Alembic. For this demo/prototype, we drop and recreate.
        # WARNING: This deletes all data!
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    print("Database tables created successfully.")

if __name__ == "__main__":
    asyncio.run(init_models())
