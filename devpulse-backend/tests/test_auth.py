"""Tests for auth routes – register, login, me."""
import pytest
import time


@pytest.mark.asyncio
async def test_register_success(client):
    unique = str(int(time.time() * 1000))
    resp = await client.post("/api/auth/register", json={
        "email": f"reg_{unique}@test.com",
        "username": f"reg_{unique}",
        "password": "StrongPass123!",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "token" in data
    assert data["user"]["email"] == f"reg_{unique}@test.com"


@pytest.mark.asyncio
async def test_register_duplicate(client):
    unique = str(int(time.time() * 1000))
    payload = {
        "email": f"dup_{unique}@test.com",
        "username": f"dup_{unique}",
        "password": "StrongPass123!",
    }
    await client.post("/api/auth/register", json=payload)
    resp = await client.post("/api/auth/register", json=payload)
    data = resp.json()
    assert data["status"] == "error"


@pytest.mark.asyncio
async def test_login_success(client):
    unique = str(int(time.time() * 1000))
    email = f"login_{unique}@test.com"
    await client.post("/api/auth/register", json={
        "email": email,
        "username": f"login_{unique}",
        "password": "StrongPass123!",
    })
    resp = await client.post("/api/auth/login", json={
        "email": email,
        "password": "StrongPass123!",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "token" in data


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    unique = str(int(time.time() * 1000))
    email = f"wrong_{unique}@test.com"
    await client.post("/api/auth/register", json={
        "email": email,
        "username": f"wrong_{unique}",
        "password": "StrongPass123!",
    })
    resp = await client.post("/api/auth/login", json={
        "email": email,
        "password": "WrongPassword!",
    })
    data = resp.json()
    assert data["status"] == "error"


@pytest.mark.asyncio
async def test_me_authenticated(client, auth_headers):
    resp = await client.get("/api/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "user" in data


@pytest.mark.asyncio
async def test_me_unauthenticated(client):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401
