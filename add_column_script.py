
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
            await conn.execute(text("ALTER TABLE documents ADD COLUMN file_path VARCHAR"))
            await conn.commit()
            print("Added file_path column successfully.")
        except Exception as e:
            print(f"Column might already exist or error: {e}")

if __name__ == "__main__":
    asyncio.run(add_column())
