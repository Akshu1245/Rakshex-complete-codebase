"""
Analytics & Error Tracking - PostHog + Sentry integration.

- PostHog for product analytics (feature usage, funnels, retention)
- Sentry for error tracking and performance monitoring

Both degrade gracefully when not configured.
"""
import os
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# ── PostHog ──────────────────────────────────────────────────────────────────
POSTHOG_API_KEY = os.getenv("POSTHOG_API_KEY", "")
POSTHOG_HOST = os.getenv("POSTHOG_HOST", "https://app.posthog.com")

_posthog_client = None

try:
    from posthog import Posthog
    POSTHOG_AVAILABLE = True
except ImportError:
    POSTHOG_AVAILABLE = False
    logger.warning("posthog package not installed – analytics disabled")


def init_posthog():
    """Initialize PostHog client."""
    global _posthog_client
    if POSTHOG_AVAILABLE and POSTHOG_API_KEY:
        _posthog_client = Posthog(POSTHOG_API_KEY, host=POSTHOG_HOST)
        logger.info("PostHog initialized (host=%s)", POSTHOG_HOST)
    else:
        logger.info("PostHog not configured – analytics in stub mode")


def track_event(
    user_id: str,
    event: str,
    properties: Optional[Dict[str, Any]] = None,
) -> None:
    """Track a product analytics event."""
    if _posthog_client:
        _posthog_client.capture(
            distinct_id=user_id,
            event=event,
            properties=properties or {},
        )
    else:
        logger.debug("PostHog stub: %s → %s %s", user_id, event, properties)


def identify_user(
    user_id: str,
    traits: Optional[Dict[str, Any]] = None,
) -> None:
    """Identify a user with traits."""
    if _posthog_client:
        _posthog_client.identify(user_id, traits or {})
    else:
        logger.debug("PostHog stub identify: %s %s", user_id, traits)


# ── Sentry ───────────────────────────────────────────────────────────────────
SENTRY_DSN = os.getenv("SENTRY_DSN", "")

try:
    import sentry_sdk
    SENTRY_AVAILABLE = True
except ImportError:
    sentry_sdk = None  # type: ignore
    SENTRY_AVAILABLE = False
    logger.warning("sentry-sdk not installed – error tracking disabled")


def init_sentry():
    """Initialize Sentry error tracking."""
    if SENTRY_AVAILABLE and SENTRY_DSN:
        sentry_sdk.init(
            dsn=SENTRY_DSN,
            traces_sample_rate=0.2,
            profiles_sample_rate=0.1,
            environment=os.getenv("ENV", "development"),
            release=f"devpulse-backend@{os.getenv('APP_VERSION', '3.0.0')}",
        )
        logger.info("Sentry initialized")
    else:
        logger.info("Sentry not configured – error tracking in stub mode")


# ── Combined init ────────────────────────────────────────────────────────────
def init_analytics():
    """Initialize all analytics services."""
    init_posthog()
    init_sentry()
