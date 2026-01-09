import asyncio
from sqlalchemy import text
from app.db.session import engine
from app.models.base import Base
from app.models.instruction import Instruction
from app.models.rag_config import RAGConfig

async def init_models():
    # Try to enable pgvector extension first
    try:
        async with engine.begin() as conn:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            
            # Check schema of vector extension
            result = await conn.execute(text("SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON e.extnamespace = n.oid WHERE e.extname = 'vector'"))
            schema_name = result.scalar()
            print(f"Vector extension is in schema: {schema_name}")
            
            if schema_name != 'public':
                print(f"Moving vector extension from {schema_name} to public schema...")
                await conn.execute(text("ALTER EXTENSION vector SET SCHEMA public"))
                print("Moved vector extension to public schema.")
            
    except Exception as e:
        print(f"Warning: Could not enable 'vector' extension. Error: {e}")

    async with engine.begin() as conn:
        # In production, use Alembic. For this demo/prototype, we drop and recreate.
        # WARNING: This deletes all data!
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    print("Database tables created successfully.")

if __name__ == "__main__":
    asyncio.run(init_models())
