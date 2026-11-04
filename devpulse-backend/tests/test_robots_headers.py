"""Search engines must not index internal DevPulse/RaksHex API responses."""
import pytest
from middleware.security import MAX_BODY_SIZE


@pytest.mark.asyncio
@pytest.mark.parametrize("path", ["/", "/health", "/docs", "/openapi.json", "/api/dashboard"])
async def test_internal_api_noindex(client, path):
    response = await client.get(path)
    directive = response.headers.get("X-Robots-Tag", "").lower()
    assert "noindex" in directive
    assert "nofollow" in directive


@pytest.mark.asyncio
async def test_rejected_oversize_request_is_also_noindex(client):
    response = await client.post(
        "/api/auth/login",
        content=b"x",
        headers={"content-length": str(MAX_BODY_SIZE + 1)},
    )
    assert response.status_code == 413
    assert "noindex" in response.headers.get("X-Robots-Tag", "").lower()
