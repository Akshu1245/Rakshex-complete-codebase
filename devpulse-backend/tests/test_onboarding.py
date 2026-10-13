"""Tests for onboarding routes."""
import pytest
import time


@pytest.mark.asyncio
async def test_onboarding_signup(client):
    unique = str(int(time.time() * 1000))
    resp = await client.post("/api/onboarding/signup", json={
        "email": f"onboard_{unique}@test.com",
        "username": f"onboard_{unique}",
        "password": "StrongPass123!",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["user"]["plan"] == "pro"
    assert data["user"]["trial"] is True
    assert data["user"]["trial_days_remaining"] == 14


@pytest.mark.asyncio
async def test_onboarding_status(client, auth_headers):
    resp = await client.get("/api/onboarding/status", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "steps" in data
    assert "progress_percent" in data


@pytest.mark.asyncio
async def test_complete_onboarding_step(client, auth_headers):
    resp = await client.post("/api/onboarding/complete", json={
        "step_id": "add_api",
    }, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "add_api" in data["completed"]


@pytest.mark.asyncio
async def test_complete_invalid_step(client, auth_headers):
    resp = await client.post("/api/onboarding/complete", json={
        "step_id": "nonexistent_step",
    }, headers=auth_headers)
    data = resp.json()
    assert data["status"] == "error"


@pytest.mark.asyncio
async def test_trial_info(client, auth_headers):
    resp = await client.get("/api/onboarding/trial-info", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "plan" in data
