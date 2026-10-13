"""Tests for billing routes."""
import pytest


@pytest.mark.asyncio
async def test_list_plans(client):
    resp = await client.get("/api/billing/plans")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "free" in data["plans"]
    assert "pro" in data["plans"]
    assert "enterprise" in data["plans"]


@pytest.mark.asyncio
async def test_billing_status(client, auth_headers):
    resp = await client.get("/api/billing/status", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "plan" in data


@pytest.mark.asyncio
async def test_subscribe_invalid_plan(client, auth_headers):
    resp = await client.post("/api/billing/subscribe", json={
        "plan": "nonexistent",
        "billing_period": "monthly",
    }, headers=auth_headers)
    data = resp.json()
    assert data["status"] == "error"


@pytest.mark.asyncio
async def test_subscribe_to_pro(client, auth_headers):
    resp = await client.post("/api/billing/subscribe", json={
        "plan": "pro",
        "billing_period": "monthly",
    }, headers=auth_headers)
    data = resp.json()
    assert data["status"] == "success"
    assert data["plan"] == "pro"


@pytest.mark.asyncio
async def test_billing_history(client, auth_headers):
    resp = await client.get("/api/billing/history", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "history" in data


@pytest.mark.asyncio
async def test_cancel_subscription(client, auth_headers):
    # Subscribe first
    await client.post("/api/billing/subscribe", json={
        "plan": "pro", "billing_period": "monthly",
    }, headers=auth_headers)
    # Cancel
    resp = await client.post("/api/billing/cancel", json={
        "reason": "testing",
    }, headers=auth_headers)
    data = resp.json()
    assert data["status"] == "success"
