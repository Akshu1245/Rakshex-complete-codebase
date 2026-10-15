"""Large provider-spec ingestion path (allowlisted, bounded, streamed, hash-pinned); separate from user import."""
import hashlib, json
import httpx, pytest
import services.safe_fetch as sf
import services.provider_spec_ingest as ing
from services.provider_spec_ingest import ProviderSpecSource


def big_spec(n_paths=12000, extra=None):
    paths = {f"/v1/res{i}": {"get": {"description": "x" * 700}, "post": {}} for i in range(n_paths)}
    if extra:
        paths.update(extra)
    return json.dumps({"openapi": "3.0.0", "info": {"title": "Stripe API", "version": "2026-09-30"}, "paths": paths}).encode()


@pytest.fixture(autouse=True)
def env(monkeypatch, tmp_path):
    monkeypatch.setenv("PROVIDER_SPEC_DIR", str(tmp_path))
    monkeypatch.delenv("PROVIDER_SPEC_PIN_STRIPE", raising=False)
    monkeypatch.setattr(sf, "resolver", lambda h, p: ["93.184.216.34"])


def serve(monkeypatch, body, headers=None, status=200):
    seen = []
    def handler(req):
        seen.append(req)
        return httpx.Response(status, content=body, headers=headers or {"content-type": "application/json"})
    monkeypatch.setattr(sf, "transport_factory", lambda: httpx.MockTransport(handler))
    return seen


@pytest.mark.asyncio
async def test_spec_over_8mb_ingested_and_user_import_still_capped_at_2mb(monkeypatch):
    body = big_spec(); assert len(body) > 8 * 1024 * 1024
    serve(monkeypatch, body)
    out = await ing.ingest("stripe")
    assert out["bytes"] == len(body) and out["sha256"] == hashlib.sha256(body).hexdigest()
    assert out["operation_count"] == 24000 and out["info_version"] == "2026-09-30" and out["changed"] is False
    with pytest.raises(sf.SpecFetchError) as e:
        await sf.fetch_spec("https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json")
    assert e.value.status == 413


@pytest.mark.asyncio
async def test_change_detection_added_removed_operations(monkeypatch):
    serve(monkeypatch, big_spec(50)); await ing.ingest("stripe")
    serve(monkeypatch, big_spec(49, extra={"/v1/new": {"delete": {}}}))
    out = await ing.ingest("stripe")
    assert out["changed"] and out["added_operations"] == ["DELETE /v1/new"]
    assert out["removed_operations"] == ["GET /v1/res49", "POST /v1/res49"]


@pytest.mark.asyncio
async def test_hash_pin_mismatch_refused(monkeypatch):
    serve(monkeypatch, big_spec(5))
    monkeypatch.setenv("PROVIDER_SPEC_PIN_STRIPE", "0" * 64)
    with pytest.raises(sf.SpecFetchError) as e:
        await ing.ingest("stripe")
    assert e.value.status == 409


@pytest.mark.asyncio
async def test_hash_pin_match_accepted(monkeypatch):
    body = big_spec(5); serve(monkeypatch, body)
    out = await ing.ingest("stripe", pin=hashlib.sha256(body).hexdigest())
    assert out["pinned"] is True


@pytest.mark.asyncio
async def test_redirect_off_allowlist_refused(monkeypatch):
    serve(monkeypatch, b"", headers={"location": "https://evil.example/spec.json"}, status=302)
    with pytest.raises(sf.SpecFetchError) as e:
        await ing.ingest("stripe")
    assert e.value.status == 400 and "allowlist" in e.value.message


@pytest.mark.asyncio
async def test_bounded_size_cap(monkeypatch):
    src = ProviderSpecSource("stripe", ing.SOURCES["stripe"].url, frozenset({"raw.githubusercontent.com"}), max_bytes=1024 * 1024)
    serve(monkeypatch, big_spec(3000))
    with pytest.raises(sf.SpecFetchError) as e:
        await ing.ingest("stripe", source=src)
    assert e.value.status == 413


@pytest.mark.asyncio
async def test_private_ip_still_blocked(monkeypatch):
    monkeypatch.setattr(sf, "resolver", lambda h, p: ["10.0.0.5"])
    with pytest.raises(sf.SpecFetchError) as e:
        await ing.ingest("stripe")
    assert e.value.status == 400


@pytest.mark.asyncio
async def test_non_openapi_and_unknown_provider(monkeypatch):
    serve(monkeypatch, json.dumps({"hello": 1}).encode())
    with pytest.raises(sf.SpecFetchError) as e:
        await ing.ingest("stripe")
    assert e.value.status == 422
    with pytest.raises(sf.SpecFetchError) as e:
        await ing.ingest("https://evil.example/x")
    assert e.value.status == 400


def test_not_reachable_from_user_routes():
    import pathlib
    for f in pathlib.Path("routes").glob("*.py"):
        assert "provider_spec_ingest" not in f.read_text(), f
