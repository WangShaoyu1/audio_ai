import asyncio
from sqlalchemy import text
from app.db.session import AsyncSessionLocal

async def add_column():
    async with AsyncSessionLocal() as session:
        try:
            # Check if column exists
            result = await session.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='instruction_repositories' AND column_name='active_system_version'"
            ))
            if result.scalar():
                print("Column 'active_system_version' already exists.")
                return

            print("Adding 'active_system_version' column to 'instruction_repositories'...")
            await session.execute(text("ALTER TABLE instruction_repositories ADD COLUMN active_system_version INTEGER"))
            await session.commit()
            print("Done.")
        except Exception as e:
            print(f"Error: {e}")
            await session.rollback()

if __name__ == "__main__":
    asyncio.run(add_column())
