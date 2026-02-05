
import asyncio
import sys
import os

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.db.session import engine

async def add_column():
    async with engine.connect() as conn:
        try:
            # Check if column exists to avoid error spam if running multiple times
            # But simple ALTER TABLE ... ADD COLUMN IF NOT EXISTS is valid in Postgres 9.6+
            await conn.execute(text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS feedback VARCHAR"))
            await conn.commit()
            print("Added feedback column successfully.")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(add_column())
