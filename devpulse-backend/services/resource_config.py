"""Resource defaults for small/free deployments; no billing or hosting changes."""
import os


def positive_int(name: str, default: int, minimum: int = 1) -> int:
    value = int(os.getenv(name, str(default)))
    if value < minimum:
        raise ValueError(f"{name} must be at least {minimum}")
    return value


FREE_PROFILE = os.getenv("RESOURCE_PROFILE", "free").lower() == "free"
HEALTH_INTERVAL = positive_int("HEALTH_PROBE_INTERVAL_SECONDS", 300 if FREE_PROFILE else 60, 60)
CHANGE_INTERVAL = positive_int("CHANGE_PROBE_INTERVAL_SECONDS", 900 if FREE_PROFILE else 300, 60)
WEBSOCKET_INTERVAL = positive_int("HEALTH_WEBSOCKET_INTERVAL_SECONDS", 60 if FREE_PROFILE else 10, 10)
POOL_MIN = positive_int("DB_POOL_MIN", 1 if FREE_PROFILE else 5)
POOL_MAX = positive_int("DB_POOL_MAX", 3 if FREE_PROFILE else 20)
if POOL_MAX < POOL_MIN:
    raise ValueError("DB_POOL_MAX must be greater than or equal to DB_POOL_MIN")
