"""SSRF-safe fetch for user-supplied OpenAPI spec URLs.

Defences:
- Scheme allowlist (https; http only if ALLOW_HTTP_SPEC_URLS=true), no userinfo, port allowlist.
- Resolve the hostname ONCE, require EVERY resolved address to be public (blocks loopback,
  private, link-local incl. 169.254.169.254 metadata, CGNAT, multicast, reserved, unspecified,
  IPv4-mapped/6to4/NAT64 forms of those), then connect to that pinned IP with the original
  Host header and TLS SNI/cert verification for the original hostname. A second DNS answer
  (rebinding) is never used.
- Redirects are not auto-followed; each Location is re-validated (max 3).
- Total timeout, streamed size cap, content parsing limits (YAML aliases rejected).
"""
from __future__ import annotations

import asyncio
import ipaddress
import json
import os
import socket
from typing import Any, Callable, Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlsplit, urlunsplit

import httpx

MAX_BYTES = 2 * 1024 * 1024
MAX_REDIRECTS = 3
TIMEOUT = httpx.Timeout(10.0, connect=5.0)   # per operation
TOTAL_DEADLINE = 15.0                          # whole fetch incl. redirects (stops slow-drip bodies)
ALLOWED_PORTS = {443, 80}


class SpecFetchError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


# Overridable in tests.
def _system_resolve(host: str, port: int) -> List[str]:
    infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    return sorted({i[4][0] for i in infos})


resolver: Callable[[str, int], List[str]] = _system_resolve
transport_factory: Optional[Callable[[], httpx.AsyncBaseTransport]] = None

_EXTRA_BLOCKED = [ipaddress.ip_network(n) for n in (
    "100.64.0.0/10", "192.0.0.0/24", "198.18.0.0/15", "64:ff9b::/96", "64:ff9b:1::/48", "2002::/16", "fd00:ec2::/32",
)]


def is_public_ip(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip.split("%", 1)[0])
    except ValueError:
        return False
    if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped:
        addr = addr.ipv4_mapped
    if (addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_multicast or addr.is_reserved
            or addr.is_unspecified or not addr.is_global):
        return False
    return not any(addr in n for n in _EXTRA_BLOCKED)


def _allowed_schemes() -> set:
    return {"https", "http"} if os.getenv("ALLOW_HTTP_SPEC_URLS", "").lower() == "true" else {"https"}


async def validate_url(url: str) -> Tuple[str, str, int, str]:
    """Return (scheme, host, port, pinned_ip) or raise SpecFetchError(400)."""
    try:
        parts = urlsplit(url)
    except ValueError:
        raise SpecFetchError(400, "Invalid URL")
    scheme = (parts.scheme or "").lower()
    if scheme not in _allowed_schemes():
        raise SpecFetchError(400, "URL scheme not allowed (https only)")
    if parts.username or parts.password:
        raise SpecFetchError(400, "Credentials in URL are not allowed")
    host = parts.hostname
    if not host:
        raise SpecFetchError(400, "URL has no host")
    if "%" in host:
        raise SpecFetchError(400, "IPv6 zone identifiers are not allowed")
    host = host.rstrip(".")
    if not host:
        raise SpecFetchError(400, "URL has no host")
    try:  # IDN -> ASCII (punycode) so DNS, Host header and SNI all use the same name
        host = host.encode("idna").decode("ascii").lower()
    except UnicodeError:
        raise SpecFetchError(400, "Invalid hostname")
    try:
        port = parts.port or (443 if scheme == "https" else 80)
    except ValueError:
        raise SpecFetchError(400, "Invalid port")
    if port not in ALLOWED_PORTS:
        raise SpecFetchError(400, "Port not allowed")
    try:
        literal = ipaddress.ip_address(host)
        ips = [str(literal)]
    except ValueError:
        if host.lower() in ("localhost",) or host.lower().endswith((".localhost", ".local", ".internal")):
            raise SpecFetchError(400, "Host not allowed")
        try:
            ips = await asyncio.to_thread(resolver, host, port)
        except Exception:
            raise SpecFetchError(400, "Host could not be resolved")
    if not ips:
        raise SpecFetchError(400, "Host could not be resolved")
    if not all(is_public_ip(ip) for ip in ips):
        raise SpecFetchError(400, "Destination address not allowed")
    return scheme, host, port, ips[0]




async def _aiter(items):
    for i in items:
        yield i


def _yaml_load(text: str) -> Any:
    import yaml

    class Loader(yaml.SafeLoader):
        def compose_node(self, parent, index):  # type: ignore[override]
            if self.check_event(yaml.AliasEvent):
                raise yaml.YAMLError("YAML aliases are not allowed")
            return super().compose_node(parent, index)

    return yaml.load(text, Loader=Loader)  # noqa: S506 (SafeLoader subclass)


def parse_spec(body: bytes, content_type: str, url_path: str) -> Dict[str, Any]:
    try:
        text = body.decode("utf-8")
    except UnicodeDecodeError:
        raise SpecFetchError(422, "Spec is not UTF-8 text")
    try:
        if "yaml" in content_type or url_path.endswith((".yaml", ".yml")):
            spec = _yaml_load(text)
        else:
            spec = json.loads(text)
    except Exception:
        raise SpecFetchError(422, "Spec could not be parsed")
    if not isinstance(spec, dict) or not ("openapi" in spec or "swagger" in spec):
        raise SpecFetchError(422, "Not an OpenAPI/Swagger document")
    return spec


async def fetch_spec(url: str, deadline: float = None) -> Dict[str, Any]:
    try:
        return await asyncio.wait_for(_fetch_spec(url), TOTAL_DEADLINE if deadline is None else deadline)
    except asyncio.TimeoutError:
        raise SpecFetchError(504, "Timed out fetching spec")


async def stream_pinned(url: str, sink: Callable[[bytes], None], *, max_bytes: int = MAX_BYTES,
                        allowed_hosts: Optional[set] = None, max_redirects: int = MAX_REDIRECTS,
                        accept: str = "application/json, application/yaml, text/yaml") -> Tuple[str, str]:
    """GET url with SSRF defences (validated, DNS-pinned, TLS verified for the original host, every redirect
    re-validated, identity encoding, size cap). Body chunks go to sink; returns (content_type, final_path).
    allowed_hosts, if given, must contain the host of the URL and of every redirect target."""
    current = url
    limit_mb = f"{max_bytes // (1024 * 1024)} MB"
    for _ in range(max_redirects + 1):
        scheme, host, port, ip = await validate_url(current)
        if allowed_hosts is not None and host not in allowed_hosts:
            raise SpecFetchError(400, "Host is not on the allowlist")
        parts = urlsplit(current)
        ip_host = f"[{ip}]" if ":" in ip else ip
        netloc = ip_host if port in (80, 443) and ((scheme == "https") == (port == 443)) else f"{ip_host}:{port}"
        pinned = urlunsplit((scheme, netloc, parts.path or "/", parts.query, ""))
        host_header = host if port in (80, 443) else f"{host}:{port}"
        kwargs: Dict[str, Any] = {"timeout": TIMEOUT, "follow_redirects": False, "trust_env": False}
        if transport_factory:
            kwargs["transport"] = transport_factory()
        try:
            async with httpx.AsyncClient(**kwargs) as client:
                req = client.build_request("GET", pinned, headers={"Host": host_header, "Accept": accept,
                                                                   "Accept-Encoding": "identity"},
                                           extensions={"sni_hostname": host} if scheme == "https" else {})
                resp = await client.send(req, stream=True)
                try:
                    if resp.status_code in (301, 302, 303, 307, 308):
                        loc = resp.headers.get("location")
                        if not loc:
                            raise SpecFetchError(502, "Redirect without Location")
                        current = urljoin(current, loc)
                        continue
                    if resp.status_code != 200:
                        raise SpecFetchError(502, f"Spec URL returned HTTP {resp.status_code}")
                    if resp.headers.get("content-encoding", "identity").lower() not in ("", "identity"):
                        # compressed bodies are refused: a small gzip can expand far past the cap in one chunk
                        raise SpecFetchError(422, "Compressed responses are not accepted")
                    declared = resp.headers.get("content-length")
                    if declared and declared.isdigit() and int(declared) > max_bytes:
                        raise SpecFetchError(413, f"Spec too large (max {limit_mb})")
                    size = 0
                    # (in-memory test transports pre-read the body; real transports stream it)
                    chunks = [resp.content] if resp.is_stream_consumed else None
                    async for chunk in (_aiter(chunks) if chunks is not None else resp.aiter_raw()):
                        size += len(chunk)
                        if size > max_bytes:
                            raise SpecFetchError(413, f"Spec too large (max {limit_mb})")
                        sink(chunk)
                    return resp.headers.get("content-type", ""), parts.path
                finally:
                    await resp.aclose()
        except SpecFetchError:
            raise
        except httpx.TimeoutException:
            raise SpecFetchError(504, "Timed out fetching spec")
        except httpx.HTTPError:
            raise SpecFetchError(502, "Failed to fetch spec")
    raise SpecFetchError(400, "Too many redirects")


async def _fetch_spec(url: str) -> Dict[str, Any]:
    buf = bytearray()
    ctype, path = await stream_pinned(url, buf.extend)
    return parse_spec(bytes(buf), ctype, path)
