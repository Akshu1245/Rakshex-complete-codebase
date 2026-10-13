"""
Test suite for the rate-limiting middleware (middleware/rate_limit.py).

Tests are run against the in-memory fallback (no Redis) using
the FastAPI async test client.
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from middleware.rate_limit import (
    _is_exempt,
    _mem_store,
    TIER_LIMITS,
    WINDOW_SECONDS,
    RateLimitMiddleware,
)


# ── Unit tests for helper functions ──────────────────────────────────────────

class TestRateLimitHelpers:
    def test_exempt_health(self):
        assert _is_exempt("/health") is True

    def test_exempt_docs(self):
        assert _is_exempt("/docs") is True

    def test_exempt_openapi(self):
        assert _is_exempt("/openapi.json") is True

    def test_exempt_root(self):
        assert _is_exempt("/") is True

    def test_not_exempt_api(self):
        assert _is_exempt("/api/v1/security/scan/full") is False

    def test_not_exempt_auth(self):
        assert _is_exempt("/api/auth/login") is False

    def test_tier_limits_defined(self):
        assert TIER_LIMITS["free"] == 100
        assert TIER_LIMITS["pro"] == 2_000
        assert TIER_LIMITS["team"] == 10_000
        assert TIER_LIMITS["enterprise"] == 10_000

    def test_window_is_one_hour(self):
        assert WINDOW_SECONDS == 3600


# ── Integration tests through the FastAPI app ────────────────────────────────

class TestRateLimitIntegration:
    @pytest.fixture(autouse=True)
    def _clear_mem_store(self):
        """Clear the in-memory rate limit store between tests."""
        _mem_store.clear()
        yield
        _mem_store.clear()

    @pytest.mark.asyncio
    async def test_health_has_no_rate_limit_headers(self, client: AsyncClient):
        resp = await client.get("/health")
        assert resp.status_code == 200
        # Exempt routes should NOT have rate-limit headers
        assert "X-RateLimit-Limit" not in resp.headers

    @pytest.mark.asyncio
    async def test_api_endpoint_has_rate_limit_headers(self, client: AsyncClient):
        resp = await client.get("/api/dashboard")
        # Any non-exempt endpoint should include rate-limit headers
        assert "X-RateLimit-Limit" in resp.headers
        assert "X-RateLimit-Remaining" in resp.headers
        assert "X-RateLimit-Reset" in resp.headers

    @pytest.mark.asyncio
    async def test_rate_limit_remaining_decrements(self, client: AsyncClient):
        r1 = await client.get("/api/dashboard")
        remaining1 = int(r1.headers.get("X-RateLimit-Remaining", "0"))
        r2 = await client.get("/api/dashboard")
        remaining2 = int(r2.headers.get("X-RateLimit-Remaining", "0"))
        assert remaining2 < remaining1

    @pytest.mark.asyncio
    async def test_root_is_exempt(self, client: AsyncClient):
        resp = await client.get("/")
        assert resp.status_code == 200
        assert "X-RateLimit-Limit" not in resp.headers
