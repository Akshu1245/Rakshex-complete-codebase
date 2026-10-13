"""
Database Configuration — async PostgreSQL engine & session factory.

Uses SQLAlchemy 2.0 async with asyncpg driver.
Falls back to SQLite (aiosqlite) when DATABASE_URL is not set,
so dev/test workflows keep working without PostgreSQL.

Environment variables:
  DATABASE_URL    — postgresql+asyncpg://user:pass@host:5432/devpulse
  DB_POOL_MIN     — minimum pool size  (default: 5)
  DB_POOL_MAX     — maximum pool size  (default: 20)
  DB_POOL_RECYCLE — connection recycle seconds (default: 1800)
  SQL_ECHO        — echo SQL statements (default: false)
"""
import os
import logging
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
    AsyncEngine,
)

logger = logging.getLogger(__name__)

# ── Connection URL ───────────────────────────────────────────────────────────
# Production:  postgresql+asyncpg://user:pass@host:5432/devpulse
# Development: sqlite+aiosqlite:///devpulse.db  (auto-fallback)
_raw_url: str = os.getenv("DATABASE_URL", "").strip()

# Replit provides a plain postgresql:// URL; rewrite it to use the async driver
if _raw_url.startswith("postgresql://") or _raw_url.startswith("postgres://"):
    _raw_url = _raw_url.replace("postgresql://", "postgresql+asyncpg://", 1).replace("postgres://", "postgresql+asyncpg://", 1)

# asyncpg does not accept sslmode as a query parameter — strip it and handle via connect_args
import re as _re
_ssl_match = _re.search(r'[?&]sslmode=([^&]+)', _raw_url)
_ssl_mode = _ssl_match.group(1) if _ssl_match else None
if _ssl_mode:
    _raw_url = _re.sub(r'[?&]sslmode=[^&]+', '', _raw_url).rstrip('?').rstrip('&')

DATABASE_URL: str = _raw_url or "sqlite+aiosqlite:///devpulse.db"

# ── Detect driver ────────────────────────────────────────────────────────────
IS_POSTGRES: bool = DATABASE_URL.startswith("postgresql")

# ── Engine kwargs (pool settings only apply to PostgreSQL) ───────────────────
_engine_kwargs: dict = {
    "echo": os.getenv("SQL_ECHO", "").lower() == "true",
}

if IS_POSTGRES:
    _pool_min = int(os.getenv("DB_POOL_MIN", "5"))
    _pool_max = int(os.getenv("DB_POOL_MAX", "20"))
    _engine_kwargs.update(
        pool_size=_pool_min,
        max_overflow=max(0, _pool_max - _pool_min),
        pool_timeout=30,
        pool_recycle=int(os.getenv("DB_POOL_RECYCLE", "1800")),
        pool_pre_ping=True,
    )
    # Pass ssl=False when sslmode=disable was present in the original URL
    if _ssl_mode == "disable":
        _engine_kwargs["connect_args"] = {"ssl": False}

# ── Engine & Session Factory ────────────────────────────────────────────────
engine: AsyncEngine = create_async_engine(DATABASE_URL, **_engine_kwargs)

AsyncSessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ── FastAPI dependency ──────────────────────────────────────────────────────
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Yield an AsyncSession for request-scoped database access.

    Usage in routes:
        @router.get("/items")
        async def list_items(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


# ── Lifecycle helpers ───────────────────────────────────────────────────────
async def init_db() -> None:
    """
    Create all ORM tables.  Used for dev/test bootstrapping.
    Production deployments should use Alembic migrations.
    """
    from models.tables import Base  # deferred import avoids circular ref

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    driver = "asyncpg" if IS_POSTGRES else "aiosqlite"
    logger.info(f"Database tables initialised (driver={driver}, url={DATABASE_URL[:40]}…)")


async def close_db() -> None:
    """Dispose the connection pool on shutdown."""
    await engine.dispose()
    logger.info("Database connection pool disposed")
