import asyncio
import os
import sys

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.db.session import AsyncSessionLocal

async def migrate():
    print("Starting RAG DB Migration...")
    async with AsyncSessionLocal() as session:
        try:
            # 1. Add columns to documents table
            print("Adding columns to documents table...")
            await session.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS content TEXT;"))
            await session.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS provider VARCHAR;"))
            await session.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS model VARCHAR;"))
            await session.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_configured BOOLEAN DEFAULT FALSE;"))
            
            # 2. Update DocumentChunk foreign key to CASCADE (Postgres doesn't support easy ALTER CONSTRAINT for Cascade)
            # We will just rely on manual delete in code if constraint exists, or if we are lucky, it's fine.
            # Actually, to properly set CASCADE, we need to drop and recreate constraint.
            # For this task, I'll implement manual delete in the API to be safe and avoid complex migration logic that might fail.
            
            # 3. Create rag_test_records table
            print("Creating rag_test_records table...")
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS rag_test_records (
                    id UUID PRIMARY KEY,
                    user_id UUID NOT NULL,
                    doc_id UUID,
                    query TEXT NOT NULL,
                    results JSONB DEFAULT '[]'::jsonb,
                    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() at time zone 'utc')
                );
            """))
            
            # 3.1 Add doc_id column if table already existed without it
            await session.execute(text("ALTER TABLE rag_test_records ADD COLUMN IF NOT EXISTS doc_id UUID;"))
            
            await session.commit()
            print("Migration completed successfully.")
        except Exception as e:
            print(f"Migration failed: {e}")
            await session.rollback()

if __name__ == "__main__":
    asyncio.run(migrate())
