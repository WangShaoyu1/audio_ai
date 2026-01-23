import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_db():
    # Retry logic for database connections
    retries = 3
    for i in range(retries):
        session = AsyncSessionLocal()
        try:
            yield session
            # If we get here, the request was successful
            # We don't commit here because we yield the session to the dependency
            # and the commit is usually handled by the caller or by explicit commits
            # But wait, yield keeps the function state.
            # The 'finally' block runs after the generator is closed.
            return
        except Exception:
            try:
                await session.rollback()
            except Exception:
                pass
            
            # If it's the last retry, re-raise
            if i == retries - 1:
                raise
            
            # Wait a bit before retrying
            await asyncio.sleep(0.5)
        finally:
            try:
                await session.close()
            except Exception:
                # Suppress errors during session close
                pass
