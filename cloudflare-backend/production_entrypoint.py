"""Production-only launch checks for the restored backend."""
import os
from urllib.parse import urlsplit


def validate_config(environ):
    secret = environ.get("JWT_SECRET", "")
    if len(secret) < 32 or secret == "devpulse-secret-key-change-in-production":
        raise RuntimeError("A strong JWT_SECRET is required")
    if not environ.get("DEVPULSE_ENCRYPTION_KEY"):
        raise RuntimeError("A persistent DEVPULSE_ENCRYPTION_KEY is required")
    url = environ.get("DATABASE_URL", "")
    if not url.startswith(("postgres://", "postgresql://", "postgresql+asyncpg://")):
        raise RuntimeError("Persistent PostgreSQL DATABASE_URL is required")
    origin = urlsplit(environ.get("FRONTEND_URL", ""))
    if origin.scheme != "https" or not origin.netloc or origin.path not in ("", "/"):
        raise RuntimeError("An HTTPS FRONTEND_URL origin is required")


if __name__ == "__main__":
    validate_config(os.environ)
    os.environ["ENV"] = "production"
    import asyncio
    from sqlalchemy import text
    from services.db_config import engine

    async def check_database():
        # Fail before opening the HTTP port when the database/schema is unavailable.
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1 FROM users LIMIT 1"))
        await engine.dispose()

    asyncio.run(check_database())
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000)
