"""custom_apis: real HTTP status codes + SSRF defences for user-supplied spec URLs.
No real network: DNS resolver and HTTP transport are injected."""
import json

import httpx
import pytest
import pytest_asyncio

import services.safe_fetch as sf
from tests.test_change_alerts_security import _user

SPEC = {"openapi": "3.0.0", "info": {"title": "Pets", "version": "2"}, "paths": {"/pets": {"get": {}}}}


@pytest_asyncio.fixture
async def h(client):
    _, headers = await _user(client, "ssrf")
    return headers


@pytest.fixture(autouse=True)
def _reset(monkeypatch):
    monkeypatch.setattr(sf, "resolver", lambda host, port: ["93.184.216.34"])
    monkeypatch.setattr(sf, "transport_factory", None)
    monkeypatch.delenv("ALLOW_HTTP_SPEC_URLS", raising=False)


def _mock(handler):
    return lambda: httpx.MockTransport(handler)


# ── IP classification ───────────────────────────────────────────────────────
@pytest.mark.parametrize("ip", ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254",
                                "100.64.0.1", "0.0.0.0", "::1", "fe80::1", "fc00::1", "::ffff:127.0.0.1",
                                "::ffff:169.254.169.254", "224.0.0.1", "fd00:ec2::254", "64:ff9b::7f00:1", "2002:7f00:1::"])
def test_non_public_ips_blocked(ip):
    assert sf.is_public_ip(ip) is False


@pytest.mark.parametrize("ip", ["93.184.216.34", "1.1.1.1", "2606:4700:4700::1111"])
def test_public_ips_allowed(ip):
    assert sf.is_public_ip(ip) is True


# ── URL validation via the endpoint ─────────────────────────────────────────
@pytest.mark.asyncio
@pytest.mark.parametrize("url", [
    "http://example.com/spec.json",            # scheme (http not allowed by default)
    "file:///etc/passwd", "gopher://x/", "ftp://example.com/a",
    "https://user:pw@example.com/spec.json",   # credentials
    "https://example.com:8443/spec.json",      # port
    "https://127.0.0.1/spec.json", "https://[::1]/spec.json", "https://169.254.169.254/latest/meta-data/",
    "https://localhost/spec.json", "https://metadata.google.internal/x",
])
async def test_blocked_urls_return_400(client, h, url):
    r = await client.post("/api/custom/import", json={"url": url}, headers=h)
    assert r.status_code == 400, (url, r.text)


@pytest.mark.asyncio
async def test_dns_resolving_to_private_is_blocked(client, h, monkeypatch):
    monkeypatch.setattr(sf, "resolver", lambda host, port: ["10.0.0.7"])
    r = await client.post("/api/custom/import", json={"url": "https://evil.example/spec.json"}, headers=h)
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_mixed_public_and_private_answers_blocked(client, h, monkeypatch):
    monkeypatch.setattr(sf, "resolver", lambda host, port: ["93.184.216.34", "127.0.0.1"])
    r = await client.post("/api/custom/import", json={"url": "https://evil.example/spec.json"}, headers=h)
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_dns_rebinding_connection_is_pinned(client, h, monkeypatch):
    answers = iter([["93.184.216.34"], ["127.0.0.1"]])  # second lookup would rebind
    monkeypatch.setattr(sf, "resolver", lambda host, port: next(answers))
    seen = {}

    def handler(request):
        seen["url"] = str(request.url)
        seen["host"] = request.headers["host"]
        seen["sni"] = request.extensions.get("sni_hostname")
        return httpx.Response(200, json=SPEC)
    monkeypatch.setattr(sf, "transport_factory", _mock(handler))
    r = await client.post("/api/custom/import", json={"url": "https://specs.example/v1/openapi.json"}, headers=h)
    assert r.status_code == 200, r.text
    assert seen["url"] == "https://93.184.216.34/v1/openapi.json"
    assert seen["host"] == "specs.example" and seen["sni"] == "specs.example"


@pytest.mark.asyncio
async def test_redirect_to_private_blocked(client, h, monkeypatch):
    def resolve(host, port):
        return ["93.184.216.34"] if host == "specs.example" else ["169.254.169.254"]
    monkeypatch.setattr(sf, "resolver", resolve)
    monkeypatch.setattr(sf, "transport_factory", _mock(lambda req: httpx.Response(302, headers={"location": "https://meta.example/latest"})))
    r = await client.post("/api/custom/import", json={"url": "https://specs.example/spec.json"}, headers=h)
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_redirect_scheme_downgrade_blocked(client, h, monkeypatch):
    monkeypatch.setattr(sf, "transport_factory", _mock(lambda req: httpx.Response(301, headers={"location": "http://specs.example/x"})))
    r = await client.post("/api/custom/import", json={"url": "https://specs.example/spec.json"}, headers=h)
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_too_many_redirects(client, h, monkeypatch):
    monkeypatch.setattr(sf, "transport_factory", _mock(lambda req: httpx.Response(302, headers={"location": "/again"})))
    r = await client.post("/api/custom/import", json={"url": "https://specs.example/spec.json"}, headers=h)
    assert r.status_code == 400 and "redirect" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_size_limit_413(client, h, monkeypatch):
    big = b'{"openapi":"3.0.0","x":"' + b"a" * (sf.MAX_BYTES + 10) + b'"}'
    monkeypatch.setattr(sf, "transport_factory", _mock(lambda req: httpx.Response(200, content=big)))
    r = await client.post("/api/custom/import", json={"url": "https://specs.example/spec.json"}, headers=h)
    assert r.status_code == 413


@pytest.mark.asyncio
async def test_timeout_504(client, h, monkeypatch):
    def handler(req):
        raise httpx.ReadTimeout("slow", request=req)
    monkeypatch.setattr(sf, "transport_factory", _mock(handler))
    r = await client.post("/api/custom/import", json={"url": "https://specs.example/spec.json"}, headers=h)
    assert r.status_code == 504


@pytest.mark.asyncio
async def test_upstream_error_502(client, h, monkeypatch):
    monkeypatch.setattr(sf, "transport_factory", _mock(lambda req: httpx.Response(500)))
    r = await client.post("/api/custom/import", json={"url": "https://specs.example/spec.json"}, headers=h)
    assert r.status_code == 502


@pytest.mark.asyncio
@pytest.mark.parametrize("body,ctype", [(b"not json", "application/json"), (b'["a"]', "application/json"),
                                        (b'{"hello": 1}', "application/json"),
                                        (b"a: &x [1]\nb: *x\nopenapi: 3", "application/yaml")])
async def test_parse_and_shape_errors_422(client, h, monkeypatch, body, ctype):
    monkeypatch.setattr(sf, "transport_factory", _mock(lambda req: httpx.Response(200, content=body, headers={"content-type": ctype})))
    r = await client.post("/api/custom/import", json={"url": "https://specs.example/spec"}, headers=h)
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_yaml_spec_ok(client, h, monkeypatch):
    y = b"openapi: 3.0.0\ninfo:\n  title: YamlPets\n  version: '1'\npaths: {}\n"
    monkeypatch.setattr(sf, "transport_factory", _mock(lambda req: httpx.Response(200, content=y, headers={"content-type": "application/yaml"})))
    r = await client.post("/api/custom/import", json={"url": "https://specs.example/spec.yaml"}, headers=h)
    assert r.status_code == 200 and r.json()["api_name"] == "YamlPets"


# ── status codes for the rest of custom_apis ───────────────────────────────
@pytest.mark.asyncio
async def test_custom_api_status_codes(client, h):
    assert (await client.post("/api/custom/import", json={"spec_json": SPEC})).status_code == 401
    assert (await client.post("/api/custom/import", json={}, headers=h)).status_code == 422
    r = await client.post("/api/custom/import", json={"spec_json": SPEC}, headers=h)
    assert r.status_code == 200 and r.json()["endpoint_count"] == 1
    lst = await client.get("/api/custom/apis", headers=h)
    assert lst.status_code == 200 and lst.json()["count"] == 1
    api_id = lst.json()["apis"][0]["id"]
    _, other = await _user(client, "ssrf2")
    assert (await client.delete(f"/api/custom/apis/{api_id}", headers=other)).status_code == 404
    assert (await client.delete(f"/api/custom/apis/{api_id}", headers=h)).status_code == 200
    assert (await client.delete(f"/api/custom/apis/{api_id}", headers=h)).status_code == 404


@pytest.mark.asyncio
async def test_custom_api_list_failure_is_500(client, h, monkeypatch):
    import routes.custom_apis as ca

    async def boom(uid):
        raise RuntimeError("db down")
    monkeypatch.setattr(ca, "get_custom_apis", boom)
    r = await client.get("/api/custom/apis", headers=h)
    assert r.status_code == 500 and "db down" not in r.text
