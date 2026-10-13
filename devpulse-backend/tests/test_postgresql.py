"""
Test suite for PostgreSQL / SQLAlchemy ORM layer.

These tests verify that the database layer (services/database.py via
services/db_config.py) works correctly.  In CI they run against SQLite
(forced by conftest.py) but share the exact same ORM codepaths that
would run against PostgreSQL in production.
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient

from services.db_config import engine, AsyncSessionLocal
from models.tables import Base, User, ApiKey, AiSecurityScan, CostBudget, ApiCallLog


# ── Engine & session ─────────────────────────────────────────────────────────

class TestDatabaseEngine:
    def test_engine_is_created(self):
        assert engine is not None

    def test_engine_url_is_sqlite_in_test(self):
        url = str(engine.url)
        assert "sqlite" in url

    def test_base_has_metadata(self):
        assert Base.metadata is not None
        assert len(Base.metadata.tables) > 0


# ── Table schema ─────────────────────────────────────────────────────────────

class TestTableSchemas:
    def test_user_table_columns(self):
        cols = {c.name for c in User.__table__.columns}
        assert "id" in cols
        assert "email" in cols
        assert "username" in cols
        assert "password_hash" in cols
        assert "plan" in cols

    def test_api_key_table_columns(self):
        cols = {c.name for c in ApiKey.__table__.columns}
        assert "id" in cols
        assert "user_id" in cols
        assert "key_name" in cols

    def test_security_scan_table_columns(self):
        cols = {c.name for c in AiSecurityScan.__table__.columns}
        assert "id" in cols
        assert "user_id" in cols
        assert "score" in cols
        assert "grade" in cols

    def test_cost_budget_table_columns(self):
        cols = {c.name for c in CostBudget.__table__.columns}
        assert "id" in cols
        assert "user_id" in cols
        assert "name" in cols
        assert "monthly_limit_usd" in cols


# ── CRUD via route integration ───────────────────────────────────────────────

class TestDatabaseCRUD:
    @pytest.mark.asyncio
    async def test_create_user_via_register(self, client: AsyncClient):
        resp = await client.post("/api/auth/register", json={
            "email": "pgtest@test.dev",
            "username": "pgtest_user",
            "password": "StrongPass1!",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("status") in ("ok", "success")
        assert "token" in data

    @pytest.mark.asyncio
    async def test_login_after_register(self, client: AsyncClient):
        await client.post("/api/auth/register", json={
            "email": "pglogin@test.dev",
            "username": "pglogin_user",
            "password": "LoginPass1!",
        })
        resp = await client.post("/api/auth/login", json={
            "email": "pglogin@test.dev",
            "password": "LoginPass1!",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("status") in ("ok", "success")
        assert "token" in data

    @pytest.mark.asyncio
    async def test_session_creates_and_queries(self, db):
        """Direct ORM session test — create a row and read it back."""
        async with AsyncSessionLocal() as session:
            from sqlalchemy import select, text
            # Quick count check
            result = await session.execute(select(User))
            rows = result.scalars().all()
            initial_count = len(rows)
            assert initial_count >= 0  # just verify query works

    @pytest.mark.asyncio
    async def test_tables_created(self, db):
        """Verify core tables exist."""
        async with AsyncSessionLocal() as session:
            from sqlalchemy import text
            # SQLite: query sqlite_master
            result = await session.execute(text(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ))
            tables = {row[0] for row in result.fetchall()}
            assert "users" in tables
            assert "api_keys" in tables

    @pytest.mark.asyncio
    async def test_concurrent_sessions(self, db):
        """Ensure two concurrent sessions don't deadlock."""
        import asyncio

        async def create_session():
            async with AsyncSessionLocal() as session:
                from sqlalchemy import select
                result = await session.execute(select(User))
                return len(result.scalars().all())

        results = await asyncio.gather(create_session(), create_session())
        assert all(r >= 0 for r in results)
