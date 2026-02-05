
import asyncio
from app.db.session import AsyncSessionLocal
from app.models.base import BenchmarkCase
from sqlalchemy import delete

async def clear_benchmark_data():
    async with AsyncSessionLocal() as db:
        print("Clearing all data from BenchmarkCase...")
        await db.execute(delete(BenchmarkCase))
        await db.commit()
        print("Done.")

if __name__ == "__main__":
    asyncio.run(clear_benchmark_data())
