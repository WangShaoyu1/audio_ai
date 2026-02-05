import asyncio
import os
import sys
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# Add parent dir to path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings

async def migrate():
    print("Starting migration for Instruction Repositories...")
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, echo=True)
    
    async with engine.begin() as conn:
        # 1. Create instruction_repositories table
        print("Creating instruction_repositories table...")
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS instruction_repositories (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id),
                name VARCHAR(255) NOT NULL,
                device_type VARCHAR(50) NOT NULL,
                language VARCHAR(10) DEFAULT 'zh',
                description TEXT,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
            );
        """))
        
        # 2. Add repository_id column to instructions
        print("Checking for repository_id column in instructions...")
        # Check if column exists
        result = await conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='instructions' AND column_name='repository_id';
        """))
        if not result.scalar():
            print("Adding repository_id column to instructions...")
            await conn.execute(text("""
                ALTER TABLE instructions 
                ADD COLUMN repository_id UUID REFERENCES instruction_repositories(id);
            """))
            print("Column added.")
            
            # 3. Create default repository for users with instructions
            print("Migrating existing instructions to default repositories...")
            # Find users with instructions
            users_result = await conn.execute(text("SELECT DISTINCT user_id FROM instructions WHERE user_id IS NOT NULL"))
            users = users_result.scalars().all()
            
            for user_id in users:
                print(f"Creating default repo for user {user_id}...")
                # Create default repo
                repo_id_result = await conn.execute(text("""
                    INSERT INTO instruction_repositories (user_id, name, device_type, language, description)
                    VALUES (:user_id, 'Default Repository', 'smart_speaker', 'zh', 'Auto-generated migration repository')
                    RETURNING id
                """), {"user_id": user_id})
                repo_id = repo_id_result.scalar()
                
                # Update instructions
                await conn.execute(text("""
                    UPDATE instructions 
                    SET repository_id = :repo_id 
                    WHERE user_id = :user_id AND repository_id IS NULL
                """), {"repo_id": repo_id, "user_id": user_id})
                print(f"Updated instructions for user {user_id} to repo {repo_id}")
                
        else:
            print("Column repository_id already exists.")
            
    print("Migration completed successfully.")

if __name__ == "__main__":
    asyncio.run(migrate())
