"""
PostgreSQL Database Service — async connection pool + session factory.

Uses SQLAlchemy 2.0 async with asyncpg driver.
Falls back to SQLite (aiosqlite) when DATABASE_URL is not set,
so existing dev workflows keep working without PostgreSQL.
"""
import os
import logging
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from models.tables import Base

logger = logging.getLogger(__name__)

# ── Connection URL ───────────────────────────────────────────────────────────
# Production:  postgresql+asyncpg://user:pass@host:5432/devpulse
# Development: sqlite+aiosqlite:///devpulse.db  (default)
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite+aiosqlite:///devpulse.db",
)

# ── Engine configuration ────────────────────────────────────────────────────
_is_postgres = DATABASE_URL.startswith("postgresql")

_engine_kwargs: dict = {
    "echo": os.getenv("SQL_ECHO", "").lower() == "true",
}

if _is_postgres:
    _engine_kwargs.update(
        pool_size=int(os.getenv("DB_POOL_MIN", "5")),
        max_overflow=int(os.getenv("DB_POOL_MAX", "20")) - int(os.getenv("DB_POOL_MIN", "5")),
        pool_timeout=30,
        pool_recycle=1800,
        pool_pre_ping=True,
    )

engine = create_async_engine(DATABASE_URL, **_engine_kwargs)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency — yields an async session and auto-closes."""
    async with async_session_factory() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_pg():
    """
    Create all tables from ORM metadata.
    In production use Alembic migrations instead.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    driver = "asyncpg" if _is_postgres else "aiosqlite"
    logger.info(f"PostgreSQL/SQLAlchemy tables initialized (driver={driver})")


async def close_pg():
    """Dispose the connection pool."""
    await engine.dispose()
    logger.info("Database connection pool disposed")
