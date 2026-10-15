"""Ingestion of LARGE first-party provider OpenAPI specs (e.g. Stripe, more than 8 MB), separate from user URL import.

Why separate: user imports (routes/custom_apis.py -> safe_fetch.fetch_spec) take arbitrary URLs and keep a 2 MB cap.
That cap is not raised. Provider specs come only from this hard-coded allowlist, are fetched by a backend
worker/CLI (never on a user request), and are handled like this:
  * source URL and permitted hosts are code constants (no user input reaches the URL);
  * same SSRF stack as user imports (validation, DNS pinning, TLS verified for the original host, redirects
    re-validated AND restricted to the allowlisted hosts, identity encoding);
  * a higher but still bounded size cap per source, plus a total deadline;
  * the body is streamed to a temp file while computing SHA-256 (it is never held in memory as one string);
  * streaming JSON parse with ijson: only the operation list (METHOD path) and info.version are extracted;
  * hash pinning: if PROVIDER_SPEC_PIN_<ID> is set, any other digest is refused (supply-chain freeze);
    otherwise the digest is compared with the previous snapshot to detect change.
Output is a compact snapshot (digest, operation list, added/removed operations). Wiring a snapshot diff into the
change detector as a supported change source is NOT done yet, so the registry still marks Stripe NOT_SUPPORTED.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import os
import tempfile
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from services import safe_fetch
from services.safe_fetch import SpecFetchError

HTTP_METHODS = {"get", "put", "post", "delete", "patch", "options", "head", "trace"}


@dataclass(frozen=True)
class ProviderSpecSource:
    provider_id: str
    url: str
    allowed_hosts: frozenset
    max_bytes: int
    deadline_s: float = 120.0


SOURCES: Dict[str, ProviderSpecSource] = {
    "stripe": ProviderSpecSource(
        provider_id="stripe",
        url="https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json",
        allowed_hosts=frozenset({"raw.githubusercontent.com"}),
        max_bytes=48 * 1024 * 1024,
    ),
}


def _snapshot_dir() -> str:
    d = os.getenv("PROVIDER_SPEC_DIR", os.path.join(tempfile.gettempdir(), "rakshex-provider-specs"))
    os.makedirs(d, exist_ok=True)
    return d


def _extract(path: str) -> Dict[str, Any]:
    import ijson
    with open(path, "rb") as f:
        top = {}
        for prefix, event, value in ijson.parse(f):
            if prefix in ("openapi", "swagger", "info.version") and event in ("string", "number"):
                top[prefix] = str(value)
            if prefix == "paths" and event == "start_map":
                break
    if "openapi" not in top and "swagger" not in top:
        raise SpecFetchError(422, "Not an OpenAPI/Swagger document")
    ops: List[str] = []
    with open(path, "rb") as f:
        for p, item in ijson.kvitems(f, "paths", use_float=True):
            if isinstance(item, dict):
                ops.extend(f"{m.upper()} {p}" for m in item if m.lower() in HTTP_METHODS)
    return {"openapi": top.get("openapi") or top.get("swagger"), "info_version": top.get("info.version"),
            "operations": sorted(ops)}


async def ingest(provider_id: str, *, pin: Optional[str] = None, source: Optional[ProviderSpecSource] = None) -> Dict[str, Any]:
    src = source or SOURCES.get(provider_id)
    if src is None:
        raise SpecFetchError(400, "Unknown provider spec source")
    pin = pin or os.getenv(f"PROVIDER_SPEC_PIN_{provider_id.upper()}") or None
    h = hashlib.sha256()
    fd, tmp = tempfile.mkstemp(prefix=f"spec-{provider_id}-", suffix=".json")
    try:
        with os.fdopen(fd, "wb") as out:
            def sink(chunk: bytes) -> None:
                h.update(chunk); out.write(chunk)
            try:
                await asyncio.wait_for(
                    safe_fetch.stream_pinned(src.url, sink, max_bytes=src.max_bytes, allowed_hosts=set(src.allowed_hosts),
                                             accept="application/json"),
                    src.deadline_s)
            except asyncio.TimeoutError:
                raise SpecFetchError(504, "Timed out fetching provider spec")
            size = out.tell()
        digest = h.hexdigest()
        if pin and digest != pin.lower():
            raise SpecFetchError(409, f"Provider spec digest {digest} does not match pinned {pin}")
        try:
            info = await asyncio.to_thread(_extract, tmp)
        except SpecFetchError:
            raise
        except Exception:
            raise SpecFetchError(422, "Provider spec could not be parsed")
    finally:
        try:
            os.unlink(tmp)
        except OSError:
            pass
    snap_path = os.path.join(_snapshot_dir(), f"{provider_id}.json")
    prev = None
    if os.path.exists(snap_path):
        with open(snap_path) as f:
            prev = json.load(f)
    prev_ops = set(prev["operations"]) if prev else set()
    now_ops = set(info["operations"])
    result = {
        "provider_id": provider_id, "sha256": digest, "bytes": size, "openapi": info["openapi"],
        "info_version": info["info_version"], "operation_count": len(now_ops),
        "changed": bool(prev) and prev.get("sha256") != digest,
        "added_operations": sorted(now_ops - prev_ops) if prev else [],
        "removed_operations": sorted(prev_ops - now_ops) if prev else [],
        "pinned": bool(pin),
    }
    with open(snap_path + ".tmp", "w") as f:
        json.dump({"sha256": digest, "operations": info["operations"], "info_version": info["info_version"]}, f)
    os.replace(snap_path + ".tmp", snap_path)
    return result


if __name__ == "__main__":  # backend worker / cron entrypoint: python -m services.provider_spec_ingest stripe
    import sys
    out = asyncio.run(ingest(sys.argv[1]))
    out = {k: (v[:20] + ["..."] if isinstance(v, list) and len(v) > 20 else v) for k, v in out.items()}
    print(json.dumps(out, indent=2))
