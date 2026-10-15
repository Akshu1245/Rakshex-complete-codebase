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


# ── review round: URL parsing edge cases, ranges, deadline, compression ───────
@pytest.mark.parametrize("ip", ["100.127.255.254", "0.1.2.3", "239.255.255.250", "240.0.0.1", "255.255.255.255",
                                "198.18.0.1", "192.0.0.8", "::", "ff02::1", "fd12:3456::1", "fc00::1",
                                "::ffff:10.0.0.1", "::ffff:100.64.0.1", "64:ff9b::a00:1", "64:ff9b::808:808",
                                "2001:db8::1", "fe80::1%eth0", "::ffff:0:7f00:1"])
def test_more_non_public_ranges_blocked(ip):
    assert sf.is_public_ip(ip) is False


@pytest.mark.asyncio
@pytest.mark.parametrize("url", [
    "https://2130706433/spec.json",      # decimal 127.0.0.1
    "https://0177.0.0.1/spec.json",      # octal
    "https://0x7f.0.0.1/spec.json",      # hex
    "https://127.1/spec.json",           # short form
    "https://[::ffff:127.0.0.1]/spec.json",
    "https://[fe80::1%25eth0]/spec.json",          # zone id
    "https://[2606:4700:4700::1111%25eth0]/x",     # zone on public addr also refused
    "https://localhost./spec.json",                # trailing dot
    "https://user@example.com/spec.json",          # userinfo without password
    "https://example.com@127.0.0.1/spec.json",     # confusable userinfo
    "https:///spec.json",
])
async def test_parsing_edge_cases_blocked_with_real_resolver(client, h, monkeypatch, url):
    monkeypatch.setattr(sf, "resolver", sf._system_resolve)  # numeric forms resolve locally, no network needed
    r = await client.post("/api/custom/import", json={"url": url}, headers=h)
    assert r.status_code == 400, (url, r.text)


@pytest.mark.asyncio
async def test_idn_host_is_punycoded_for_dns_host_and_sni(monkeypatch):
    seen = {}
    def resolver(host, port):
        seen["dns"] = host
        return ["93.184.216.34"]
    def handler(req):
        seen["host"] = req.headers["host"]; seen["sni"] = req.extensions.get("sni_hostname")
        return httpx.Response(200, json=SPEC)
    monkeypatch.setattr(sf, "resolver", resolver)
    monkeypatch.setattr(sf, "transport_factory", _mock(handler))
    await sf.fetch_spec("https://bücher.example/spec.json")
    assert seen == {"dns": "xn--bcher-kva.example", "host": "xn--bcher-kva.example", "sni": "xn--bcher-kva.example"}


@pytest.mark.asyncio
async def test_total_deadline_stops_slow_drip(monkeypatch):
    import asyncio
    class Drip(httpx.AsyncByteStream):
        async def __aiter__(self):
            for _ in range(1000):
                await asyncio.sleep(0.05); yield b" "
    monkeypatch.setattr(sf, "transport_factory", _mock(lambda req: httpx.Response(200, stream=Drip())))
    with pytest.raises(sf.SpecFetchError) as e:
        await sf.fetch_spec("https://example.com/spec.json", deadline=0.5)
    assert e.value.status == 504


@pytest.mark.asyncio
async def test_compressed_body_refused(monkeypatch):
    import gzip
    bomb = gzip.compress(b"{" + b" " * (20 * 1024 * 1024) + b"}")
    monkeypatch.setattr(sf, "transport_factory", _mock(lambda req: httpx.Response(200, content=bomb, headers={"content-encoding": "gzip"})))
    with pytest.raises(sf.SpecFetchError) as e:
        await sf.fetch_spec("https://example.com/spec.json")
    assert e.value.status == 422


@pytest.mark.asyncio
async def test_identity_encoding_requested(monkeypatch):
    seen = {}
    def handler(req):
        seen["ae"] = req.headers.get("accept-encoding"); return httpx.Response(200, json=SPEC)
    monkeypatch.setattr(sf, "transport_factory", _mock(handler))
    await sf.fetch_spec("https://example.com/spec.json")
    assert seen["ae"] == "identity"


# ── real TLS (local server, no internet): the connection goes to the pinned IP, but the certificate is
#    verified against the ORIGINAL hostname (SNI + check_hostname). The box's egress uses a fake-IP proxy,
#    so this is tested against a local TLS server instead of a public host.
import shutil, ssl, subprocess, threading, http.server


@pytest.fixture
def tls_server(tmp_path, monkeypatch):
    if not shutil.which("openssl"):
        pytest.skip("openssl not available")
    ca_key, ca, key, csr, crt = (tmp_path / n for n in ("ca.key", "ca.pem", "s.key", "s.csr", "s.pem"))
    run = lambda *a: subprocess.run(a, check=True, capture_output=True)
    run("openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", str(ca_key), "-out", str(ca), "-days", "1", "-subj", "/CN=test-ca",
        "-addext", "basicConstraints=critical,CA:TRUE", "-addext", "keyUsage=critical,keyCertSign,cRLSign")
    run("openssl", "req", "-newkey", "rsa:2048", "-nodes", "-keyout", str(key), "-out", str(csr), "-subj", "/CN=good.test")
    ext = tmp_path / "ext.cnf"; ext.write_text("subjectAltName=DNS:good.test\n")
    run("openssl", "x509", "-req", "-in", str(csr), "-CA", str(ca), "-CAkey", str(ca_key), "-CAcreateserial", "-out", str(crt), "-days", "1", "-extfile", str(ext))

    class H(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            body = json.dumps(SPEC).encode()
            self.send_response(200); self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(body))); self.end_headers(); self.wfile.write(body)
        def log_message(self, *a): pass
    srv = http.server.HTTPServer(("127.0.0.1", 0), H)
    sctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); sctx.load_cert_chain(str(crt), str(key))
    srv.socket = sctx.wrap_socket(srv.socket, server_side=True)
    port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    cctx = ssl.create_default_context(cafile=str(ca))
    monkeypatch.setattr(sf, "ALLOWED_PORTS", {443, 80, port})
    monkeypatch.setattr(sf, "is_public_ip", lambda ip: True)            # allow the local test server only here
    monkeypatch.setattr(sf, "resolver", lambda host, p: ["127.0.0.1"])  # every name pinned to the local server
    monkeypatch.setattr(sf, "transport_factory", lambda: httpx.AsyncHTTPTransport(verify=cctx))
    yield port
    srv.shutdown()


@pytest.mark.asyncio
async def test_real_tls_pinned_ip_verifies_original_hostname(tls_server):
    spec = await sf.fetch_spec(f"https://good.test:{tls_server}/spec.json")
    assert spec["info"]["title"] == "Pets"


@pytest.mark.asyncio
async def test_real_tls_wrong_hostname_on_pinned_ip_rejected(tls_server):
    with pytest.raises(sf.SpecFetchError) as e:
        await sf.fetch_spec(f"https://evil.test:{tls_server}/spec.json")
    assert e.value.status == 502
