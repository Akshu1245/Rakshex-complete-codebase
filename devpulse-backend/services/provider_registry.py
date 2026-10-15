"""Canonical provider registry for workspace change-alert subscriptions.

Rules:
- Subscriptions store the canonical provider `id`, never a free-text name.
- Imported OpenAPI titles are NOT mapped to providers (an "Acme Stripe Wrapper" spec is not Stripe).
- coverage == "SUPPORTED" only if services/change_detector.MONITORED_APIS really probes it.
  What "supported" means today is deliberately narrow: periodic unauthenticated GET of ONE
  public endpoint and diffing the JSON response *shape*. It is not changelog/OpenAPI
  monitoring and will miss most breaking changes.
"""
from typing import Dict, List, Optional

DETECTOR_COVERAGE = ("Response-shape drift of one public, unauthenticated endpoint (polled). "
                     "Not changelog, OpenAPI, SDK or versioned-API monitoring.")

PROVIDERS: List[Dict[str, str]] = [
    {"id": "github", "name": "GitHub", "detector_name": "GitHub", "endpoint": "GET https://api.github.com"},
    {"id": "coingecko", "name": "CoinGecko", "detector_name": "CoinGecko", "endpoint": "GET /api/v3/ping"},
    {"id": "reddit", "name": "Reddit", "detector_name": "Reddit", "endpoint": "GET /r/programming.json"},
    {"id": "nasa", "name": "NASA APOD", "detector_name": "NASA", "endpoint": "GET /planetary/apod (DEMO_KEY)"},
    {"id": "discord", "name": "Discord", "detector_name": "Discord", "endpoint": "GET /api/v10/gateway"},
    {"id": "slack", "name": "Slack", "detector_name": "Slack", "endpoint": "GET /api/api.test"},
]
for _p in PROVIDERS:
    _p["coverage"] = "SUPPORTED"
    _p["coverage_detail"] = DETECTOR_COVERAGE

# Listed so the UI can be honest about what is NOT monitored. Not subscribable.
UNSUPPORTED: List[Dict[str, str]] = [
    {"id": "stripe", "name": "Stripe", "coverage": "NOT_SUPPORTED",
     "coverage_detail": "No Stripe change source in the detector (no changelog/OpenAPI feed, no API key probe). "
                        "The Endive self-repair demo is a separate offline sandbox, not live monitoring."},
    {"id": "openai", "name": "OpenAI", "coverage": "NOT_SUPPORTED", "coverage_detail": "No change source implemented."},
    {"id": "twilio", "name": "Twilio", "coverage": "NOT_SUPPORTED", "coverage_detail": "No change source implemented."},
    {"id": "shopify", "name": "Shopify", "coverage": "NOT_SUPPORTED", "coverage_detail": "No change source implemented."},
]

_BY_ID = {p["id"]: p for p in PROVIDERS}
_UNSUPPORTED_IDS = {p["id"] for p in UNSUPPORTED}
_BY_DETECTOR = {p["detector_name"]: p["id"] for p in PROVIDERS}


def get_supported(provider_id: str) -> Optional[Dict[str, str]]:
    return _BY_ID.get(provider_id)


def is_known_unsupported(provider_id: str) -> bool:
    return provider_id in _UNSUPPORTED_IDS


def provider_id_for_detector(detector_api_name: str) -> Optional[str]:
    """Exact detector name -> canonical id. No fuzzy matching."""
    return _BY_DETECTOR.get(detector_api_name)


def catalog() -> Dict[str, List[Dict[str, str]]]:
    return {"supported": [dict(p) for p in PROVIDERS], "unsupported": [dict(p) for p in UNSUPPORTED]}
