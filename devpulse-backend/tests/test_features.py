"""Tests for security, CI/CD, and reports routes."""
import pytest


@pytest.mark.asyncio
async def test_security_scan_code(client, auth_headers):
    resp = await client.post("/api/security/scan/code", json={
        "code": "import os\nos.system('ls')",
        "language": "python",
    }, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data


@pytest.mark.asyncio
async def test_cicd_check(client, auth_headers):
    resp = await client.post("/api/cicd/check", json={
        "code": "def hello(): return 'world'",
        "language": "python",
    }, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data


@pytest.mark.asyncio
async def test_reports_summary(client, auth_headers):
    resp = await client.get("/api/reports/summary", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data


@pytest.mark.asyncio
async def test_reports_export_json(client, auth_headers):
    resp = await client.get("/api/reports/export?type=health&format=json", headers=auth_headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_changes_alerts(client, auth_headers):
    resp = await client.get("/api/changes/alerts", headers=auth_headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_marketplace_templates(client):
    resp = await client.get("/api/marketplace/templates")
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
