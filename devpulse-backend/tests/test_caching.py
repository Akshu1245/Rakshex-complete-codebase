"""
Test suite for the Redis/in-memory cache layer (services/cache.py).

All tests run against the in-memory LRU fallback (REDIS_URL is empty
in the test environment) so no Redis server is needed.
"""
import pytest
import pytest_asyncio

from services.cache import (
    cache_get,
    cache_set,
    cache_delete,
    cache_delete_pattern,
    cache_clear_prefix,
    health_cache_key,
    security_scan_key,
    cost_breakdown_key,
    user_plan_key,
    make_code_hash,
    _fallback,
)


@pytest.fixture(autouse=True)
def _clear_fallback():
    """Clear the in-memory fallback store before each test."""
    _fallback.clear()
    yield
    _fallback.clear()


# ── Key helpers ──────────────────────────────────────────────────────────────

class TestCacheKeyHelpers:
    def test_health_cache_key(self):
        assert health_cache_key() == "health:dashboard"

    def test_security_scan_key(self):
        assert security_scan_key("abc123") == "scan:abc123"

    def test_cost_breakdown_key(self):
        assert cost_breakdown_key(42, 30) == "cost:42:30"

    def test_user_plan_key(self):
        assert user_plan_key(7) == "plan:7"

    def test_make_code_hash_deterministic(self):
        h1 = make_code_hash("print('hello')")
        h2 = make_code_hash("print('hello')")
        assert h1 == h2
        assert len(h1) == 16

    def test_make_code_hash_varies(self):
        h1 = make_code_hash("a")
        h2 = make_code_hash("b")
        assert h1 != h2


# ── Basic get / set / delete ─────────────────────────────────────────────────

class TestCacheOperations:
    @pytest.mark.asyncio
    async def test_get_miss_returns_none(self):
        result = await cache_get("nonexistent")
        assert result is None

    @pytest.mark.asyncio
    async def test_set_and_get(self):
        await cache_set("k1", {"msg": "hello"}, ttl=60)
        result = await cache_get("k1")
        assert result == {"msg": "hello"}

    @pytest.mark.asyncio
    async def test_set_overwrites(self):
        await cache_set("k1", {"v": 1})
        await cache_set("k1", {"v": 2})
        result = await cache_get("k1")
        assert result == {"v": 2}

    @pytest.mark.asyncio
    async def test_delete(self):
        await cache_set("k1", {"v": 1})
        await cache_delete("k1")
        assert await cache_get("k1") is None

    @pytest.mark.asyncio
    async def test_delete_nonexistent_no_error(self):
        await cache_delete("does_not_exist")  # should not raise

    @pytest.mark.asyncio
    async def test_set_string_value(self):
        await cache_set("str_key", "just a string", ttl=60)
        result = await cache_get("str_key")
        assert result == "just a string"

    @pytest.mark.asyncio
    async def test_set_list_value(self):
        data = [1, 2, 3]
        await cache_set("list_key", data, ttl=60)
        result = await cache_get("list_key")
        assert result == [1, 2, 3]


# ── Pattern / prefix deletion ────────────────────────────────────────────────

class TestCachePatternDeletion:
    @pytest.mark.asyncio
    async def test_delete_pattern(self):
        await cache_set("cost:1:30", {"a": 1})
        await cache_set("cost:1:60", {"b": 2})
        await cache_set("other:1", {"c": 3})
        count = await cache_delete_pattern("cost:*")
        assert count == 2
        assert await cache_get("cost:1:30") is None
        assert await cache_get("cost:1:60") is None
        assert await cache_get("other:1") == {"c": 3}

    @pytest.mark.asyncio
    async def test_clear_prefix_is_alias(self):
        await cache_set("scan:a", {"x": 1})
        await cache_set("scan:b", {"x": 2})
        count = await cache_clear_prefix("scan:")
        assert count == 2
        assert await cache_get("scan:a") is None

    @pytest.mark.asyncio
    async def test_delete_pattern_no_matches(self):
        await cache_set("foo:1", {"a": 1})
        count = await cache_delete_pattern("bar:*")
        assert count == 0
        assert await cache_get("foo:1") == {"a": 1}


# ── LRU eviction ─────────────────────────────────────────────────────────────

class TestLRUEviction:
    @pytest.mark.asyncio
    async def test_eviction_when_full(self):
        from services import cache as cache_mod
        original_max = cache_mod._FALLBACK_MAX
        cache_mod._FALLBACK_MAX = 5
        try:
            for i in range(6):
                await cache_set(f"item:{i}", {"i": i})
            # First item should have been evicted
            assert await cache_get("item:0") is None
            # Last item should still be there
            assert await cache_get("item:5") == {"i": 5}
        finally:
            cache_mod._FALLBACK_MAX = original_max
