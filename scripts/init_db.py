import asyncio
import asyncpg
import logging
import sys
import os

# Add project root to python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.models.base import Base
from sqlalchemy.ext.asyncio import create_async_engine

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def create_database_if_not_exists():
    """
    Connect to default 'postgres' database to check and create the target database.
    """
    sys_conn = await asyncpg.connect(
        user=settings.POSTGRES_USER,
        password=settings.POSTGRES_PASSWORD,
        host=settings.POSTGRES_SERVER,
        port=settings.POSTGRES_PORT,
        database='postgres'  # Connect to default maintenance DB
    )
    
    try:
        # Check if database exists
        exists = await sys_conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1",
            settings.POSTGRES_DB
        )
        
        if not exists:
            logger.info(f"Database '{settings.POSTGRES_DB}' does not exist. Creating...")
            await sys_conn.execute(f'CREATE DATABASE "{settings.POSTGRES_DB}"')
            logger.info(f"Database '{settings.POSTGRES_DB}' created successfully.")
        else:
            logger.info(f"Database '{settings.POSTGRES_DB}' already exists.")
            
    except Exception as e:
        logger.error(f"Error creating database: {e}")
        raise
    finally:
        await sys_conn.close()

async def init_tables():
    """
    Initialize database tables and extensions using SQLAlchemy.
    """
    logger.info("Initializing database tables...")
    
    # Create engine for the target database
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, echo=False)
    
    async with engine.begin() as conn:
        # Enable pgvector extension
        logger.info("Enabling 'vector' extension...")
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        
        # Create all tables defined in models
        logger.info("Creating tables...")
        await conn.run_sync(Base.metadata.create_all)
        
    logger.info("Tables initialized successfully.")
    await engine.dispose()

if __name__ == "__main__":
    from sqlalchemy import text
    
    try:
        # 1. Create Database (Skipped as we created it manually)
        # asyncio.run(create_database_if_not_exists())
        
        # 2. Create Tables & Extensions
        asyncio.run(init_tables())
        
        logger.info("✅ Database initialization completed successfully!")
        
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
        sys.exit(1)
