import asyncio
import sys
import os

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.db.session import engine

async def add_missing_columns():
    async with engine.begin() as conn:
        try:
            print("Adding timezone column to sessions table...")
            await conn.execute(text("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS timezone VARCHAR DEFAULT 'Asia/Shanghai'"))
            
            print("Adding hit_source column to messages table...")
            await conn.execute(text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS hit_source VARCHAR"))
            
            print("Adding hit_count column to messages table...")
            await conn.execute(text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS hit_count INTEGER DEFAULT 0"))
            
            print("All columns added successfully.")
        except Exception as e:
            print(f"Error adding columns: {e}")

if __name__ == "__main__":
    asyncio.run(add_missing_columns())
