"""
Database Configuration — async PostgreSQL engine & session factory.

Uses SQLAlchemy 2.0 async with asyncpg driver.
Falls back to SQLite (aiosqlite) when DATABASE_URL is not set,
so dev/test workflows keep working without PostgreSQL.

Environment variables:
  DATABASE_URL    — postgresql+asyncpg://user:pass@host:5432/devpulse
  DB_POOL_MIN     — retained pool capacity (default: 1 in free resource profile)
  DB_POOL_MAX     — total pool capacity (default: 3 in free resource profile)
  DB_POOL_RECYCLE — connection recycle seconds (default: 1800)
  SQL_ECHO        — echo SQL statements (default: false)
"""
import os
import logging
import ssl
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
from typing import AsyncGenerator
from services.resource_config import POOL_MIN, POOL_MAX

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
def normalize_database_url(raw):
    raw = raw.strip().replace("postgresql://", "postgresql+asyncpg://", 1).replace("postgres://", "postgresql+asyncpg://", 1)
    if not raw.startswith("postgresql"):
        return raw, {}
    parts = urlsplit(raw)
    query = dict(parse_qsl(parts.query))
    mode = query.pop("sslmode", None)
    # These libpq options are not accepted as asyncpg connection kwargs.
    query.pop("channel_binding", None)
    connect_args = {}
    if mode == "disable":
        connect_args["ssl"] = False
    elif mode in ("require", "verify-ca", "verify-full"):
        connect_args["ssl"] = ssl.create_default_context()
    return urlunsplit(parts._replace(query=urlencode(query))), connect_args


_raw_url, _connect_args = normalize_database_url(os.getenv("DATABASE_URL", ""))

DATABASE_URL: str = _raw_url or "sqlite+aiosqlite:///devpulse.db"
if os.getenv("ENV") == "production" and not DATABASE_URL.startswith("postgresql"):
    raise RuntimeError("Production requires persistent PostgreSQL")

# ── Detect driver ────────────────────────────────────────────────────────────
IS_POSTGRES: bool = DATABASE_URL.startswith("postgresql")

# ── Engine kwargs (pool settings only apply to PostgreSQL) ───────────────────
_engine_kwargs: dict = {
    "echo": os.getenv("SQL_ECHO", "").lower() == "true",
}

if IS_POSTGRES:
    _pool_min = POOL_MIN
    _pool_max = POOL_MAX
    _engine_kwargs.update(
        pool_size=_pool_min,
        max_overflow=max(0, _pool_max - _pool_min),
        pool_timeout=30,
        pool_recycle=int(os.getenv("DB_POOL_RECYCLE", "1800")),
        pool_pre_ping=True,
    )
    if _connect_args:
        _engine_kwargs["connect_args"] = _connect_args

# ── Engine & Session Factory ────────────────────────────────────────────────
engine: AsyncEngine = create_async_engine(DATABASE_URL, hide_parameters=True, **_engine_kwargs)

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
    logger.info("Database tables initialised (driver=%s)", driver)


async def close_db() -> None:
    """Dispose the connection pool on shutdown."""
    await engine.dispose()
    logger.info("Database connection pool disposed")
