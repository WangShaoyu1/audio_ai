import asyncio
import os
import sys
from sqlalchemy import text
from app.db.session import engine

# Add current directory to path
sys.path.append(os.getcwd())

async def update_schema():
    async with engine.begin() as conn:
        print("Checking for 'version' and 'source' columns in 'benchmark_cases'...")
        
        # Check if columns exist
        result = await conn.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_name='benchmark_cases' AND column_name='version'"
        ))
        if not result.scalar():
            print("Adding 'version' column...")
            await conn.execute(text("ALTER TABLE benchmark_cases ADD COLUMN version INTEGER DEFAULT 1"))
        else:
            print("'version' column already exists.")
            
        result = await conn.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_name='benchmark_cases' AND column_name='source'"
        ))
        if not result.scalar():
            print("Adding 'source' column...")
            await conn.execute(text("ALTER TABLE benchmark_cases ADD COLUMN source VARCHAR DEFAULT 'manual'"))
        else:
            print("'source' column already exists.")

    print("Schema update complete.")

if __name__ == "__main__":
    if os.name == 'nt':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(update_schema())
