
import asyncio
import sys
import os

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import engine
from app.models.base import Base, BenchmarkCase

async def create_tables():
    async with engine.begin() as conn:
        # This will only create tables that don't exist
        await conn.run_sync(Base.metadata.create_all)
    print("BenchmarkCase table created (if it didn't exist).")

if __name__ == "__main__":
    asyncio.run(create_tables())
