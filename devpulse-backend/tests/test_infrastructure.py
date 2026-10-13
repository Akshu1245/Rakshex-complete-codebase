"""
Tests for PostgreSQL migration and Redis cache infrastructure.
"""
import pytest
import pytest_asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ── PostgreSQL Service ────────────────────────────────────────────────────────

class TestDatabaseConfig:
    """Test db_config service module."""

    def test_import_db_config(self):
        """Should import db_config module without errors."""
        from services.db_config import init_db, close_db, get_db
        assert callable(init_db)
        assert callable(close_db)

    def test_db_config_has_engine_var(self):
        """Module should define engine variable."""
        from services import db_config
        assert hasattr(db_config, 'engine')

    def test_db_config_has_session_factory(self):
        """Module should define AsyncSessionLocal."""
        from services import db_config
        assert hasattr(db_config, 'AsyncSessionLocal')


# ── Redis Cache Service ───────────────────────────────────────────────────────

class TestCache:
    """Test cache service module."""

    def test_import_cache(self):
        """Should import cache module without errors."""
        from services.cache import cache_get, cache_set, cache_delete, cache_clear_prefix, close_cache
        assert callable(cache_get)
        assert callable(cache_set)
        assert callable(cache_delete)
        assert callable(cache_clear_prefix)
        assert callable(close_cache)

    @pytest.mark.asyncio
    async def test_cache_set_and_get(self):
        """Should store and retrieve values from in-memory fallback."""
        from services.cache import cache_set, cache_get
        await cache_set("test_key_1", "hello_world", ttl=10)
        val = await cache_get("test_key_1")
        assert val == "hello_world"

    @pytest.mark.asyncio
    async def test_cache_delete(self):
        """Should delete a cached key."""
        from services.cache import cache_set, cache_get, cache_delete
        await cache_set("test_key_2", "to_delete", ttl=10)
        await cache_delete("test_key_2")
        val = await cache_get("test_key_2")
        assert val is None

    @pytest.mark.asyncio
    async def test_cache_clear_prefix(self):
        """Should clear all keys matching a prefix."""
        from services.cache import cache_set, cache_get, cache_clear_prefix
        await cache_set("prefix:a", "1", ttl=10)
        await cache_set("prefix:b", "2", ttl=10)
        await cache_set("other:c", "3", ttl=10)
        await cache_clear_prefix("prefix:")
        assert await cache_get("prefix:a") is None
        assert await cache_get("prefix:b") is None
        assert await cache_get("other:c") == "3"


# ── ORM Models ────────────────────────────────────────────────────────────────

class TestModels:
    """Test SQLAlchemy model definitions."""

    def test_import_all_models(self):
        """Should import all ORM table models."""
        from models.tables import (
            Base, User, ApiKey, AiSecurityScan, ThreatEvent,
            ApiCallLog, CostBudget, CostForecast,
        )
        assert Base is not None
        assert hasattr(AiSecurityScan, '__tablename__')
        assert hasattr(ThreatEvent, '__tablename__')
        assert hasattr(ApiCallLog, '__tablename__')
        assert hasattr(CostBudget, '__tablename__')
        assert hasattr(CostForecast, '__tablename__')

    def test_ai_security_scan_columns(self):
        """AiSecurityScan should have required columns."""
        from models.tables import AiSecurityScan
        mapper = AiSecurityScan.__table__
        col_names = [c.name for c in mapper.columns]
        for expected in ['id', 'score', 'grade', 'threats_found']:
            assert expected in col_names, f"Missing column: {expected}"

    def test_cost_budget_columns(self):
        """CostBudget should have required columns."""
        from models.tables import CostBudget
        mapper = CostBudget.__table__
        col_names = [c.name for c in mapper.columns]
        for expected in ['id', 'provider', 'monthly_limit_usd']:
            assert expected in col_names, f"Missing column: {expected}"


# ── Alembic Configuration ────────────────────────────────────────────────────

class TestAlembicConfig:
    """Test Alembic migration configuration."""

    def test_alembic_ini_exists(self):
        """alembic.ini should exist."""
        ini_path = os.path.join(os.path.dirname(__file__), '..', 'alembic.ini')
        assert os.path.exists(ini_path)

    def test_alembic_env_exists(self):
        """alembic/env.py should exist."""
        env_path = os.path.join(os.path.dirname(__file__), '..', 'alembic', 'env.py')
        assert os.path.exists(env_path)
