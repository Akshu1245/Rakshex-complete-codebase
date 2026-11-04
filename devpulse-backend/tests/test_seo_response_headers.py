"""The application API must not compete with the public marketing site in search."""

import pytest


@pytest.mark.asyncio
async def test_successful_api_response_has_noindex_header(client):
    response = await client.get("/")
    assert response.status_code == 200
    assert response.headers.get("x-robots-tag") == "noindex, nofollow, noarchive"


@pytest.mark.asyncio
async def test_missing_api_route_has_noindex_header(client):
    response = await client.get("/__not_a_public_marketing_page__")
    assert response.status_code == 404
    assert response.headers.get("x-robots-tag") == "noindex, nofollow, noarchive"


@pytest.mark.asyncio
async def test_cors_preflight_is_not_indexable(client):
    response = await client.options("/", headers={
        "Origin": "http://localhost:5000",
        "Access-Control-Request-Method": "GET",
    })
    assert response.headers.get("x-robots-tag") == "noindex, nofollow, noarchive"
