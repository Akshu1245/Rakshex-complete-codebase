"""
Shared pytest fixtures for DevPulse backend tests.

Forces SQLite for tests so CI / local runs never need PostgreSQL.
Creates tables once per session, truncates between tests for isolation.
"""
import asyncio
import os
import sys
from typing import AsyncGenerator, Dict, Any

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport

# Ensure project root is on path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# ── Force SQLite for test runs ───────────────────────────────────────────────
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///"
os.environ["REDIS_URL"] = ""       # disable Redis; use in-memory fallback
os.environ["ENV"] = "test"

from main import app
from services.database import init_db, close_db
from services.db_config import engine, AsyncSessionLocal
from models.tables import Base


@pytest.fixture(scope="session")
def event_loop():
    """Create a session-scoped event loop."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def db():
    """Initialize test database once per session (creates all tables)."""
    await init_db()
    yield
    await close_db()


@pytest_asyncio.fixture(autouse=True)
async def _truncate_tables(db):
    """Truncate every table between tests for full isolation."""
    yield
    from sqlalchemy import text
    async with AsyncSessionLocal() as session:
        # SQLite doesn't support TRUNCATE, so DELETE FROM each table
        for table in reversed(Base.metadata.sorted_tables):
            await session.execute(text(f"DELETE FROM {table.name}"))
        await session.commit()


@pytest.fixture(scope="session")
def sync_client() -> TestClient:
    """Synchronous test client."""
    return TestClient(app)


@pytest_asyncio.fixture
async def client(db) -> AsyncGenerator[AsyncClient, None]:
    """Async test client with DB ready."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient) -> Dict[str, str]:
    """Register a test user and return auth headers."""
    import time
    unique = str(int(time.time() * 1000))
    resp = await client.post("/api/auth/register", json={
        "email": f"test_{unique}@devpulse.test",
        "username": f"tester_{unique}",
        "password": "TestPass123!",
    })
    data = resp.json()
    token = data.get("token", "")
    return {"Authorization": f"Bearer {token}"}
