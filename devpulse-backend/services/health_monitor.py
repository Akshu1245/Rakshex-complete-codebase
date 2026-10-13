"""
Health Monitor Service - Production-grade async API health monitoring.

Probes 15 real APIs every 60 seconds with proper classification,
error handling, and thread-safe storage.
"""
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import httpx

# Module-level health data storage
health_data: Dict[str, Dict[str, Any]] = {}

# Lock for thread-safe writes to health_data
_health_lock = asyncio.Lock()

# Background task reference
_monitor_task: Optional[asyncio.Task] = None

# Last run timestamp
_last_run: Optional[str] = None

# API configurations with probe URLs
API_CONFIGS = [
    {"name": "OpenWeatherMap", "url": "https://api.openweathermap.org/data/2.5/weather?q=London&appid=test", "category": "weather"},
    {"name": "NASA", "url": "https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY", "category": "science"},
    {"name": "GitHub", "url": "https://api.github.com", "category": "development"},
    {"name": "Twitter", "url": "https://api.twitter.com/2/tweets/search/recent", "category": "social"},
    {"name": "Stripe", "url": "https://api.stripe.com/v1/charges", "category": "payment"},
    {"name": "Twilio", "url": "https://api.twilio.com/2010-04-01", "category": "communication"},
    {"name": "SendGrid", "url": "https://api.sendgrid.com/v3/mail/send", "category": "email"},
    {"name": "Spotify", "url": "https://api.spotify.com/v1/browse/featured-playlists", "category": "media"},
    {"name": "Google Maps", "url": "https://maps.googleapis.com/maps/api/geocode/json", "category": "maps"},
    {"name": "CoinGecko", "url": "https://api.coingecko.com/api/v3/ping", "category": "finance"},
    {"name": "Reddit", "url": "https://www.reddit.com/r/programming.json", "category": "social"},
    {"name": "Slack", "url": "https://slack.com/api/api.test", "category": "communication"},
    {"name": "Discord", "url": "https://discord.com/api/v10/gateway", "category": "communication"},
    {"name": "NewsAPI", "url": "https://newsapi.org/v2/top-headlines?country=us", "category": "news"},
    {"name": "OpenAI", "url": "https://api.openai.com/v1/models", "category": "ai"},
]


def _classify_status(
    status_code: Optional[int],
    latency_ms: float,
    is_timeout: bool,
    is_rate_limited: bool,
    has_error: bool
) -> str:
    """
    Classify API health status based on probe results.
    
    Classification logic:
    - healthy   → status_code 200-299 AND latency_ms < 800
    - degraded  → status_code 200-299 AND latency_ms >= 800
                OR status_code 400-428 or 430-499
                OR is_rate_limited = True (429)
    - down      → is_timeout = True
                OR status_code 500-599
                OR any connection error
    """
    # Down conditions
    if is_timeout:
        return "down"
    if has_error:
        return "down"
    if status_code is None:
        return "down"
    if 500 <= status_code <= 599:
        return "down"
    
    # Rate limited is degraded
    if is_rate_limited:
        return "degraded"
    
    # 4xx errors (except 429) are degraded
    if 400 <= status_code <= 428 or 430 <= status_code <= 499:
        return "degraded"
    
    # 2xx responses
    if 200 <= status_code <= 299:
        if latency_ms >= 800:
            return "degraded"
        return "healthy"
    
    # Any other status code
    return "down"


async def _probe_single_api(
    client: httpx.AsyncClient,
    name: str,
    url: str
) -> Dict[str, Any]:
    """
    Probe a single API and return health data.
    
    Each probe is wrapped in try/except to handle:
    - TimeoutException → is_timeout=True, status="down"
    - ConnectError → status="down", error="Connection refused"
    - Exception → status="down", error=str(e)
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    
    result = {
        "name": name,
        "status": "down",
        "latency_ms": 0.0,
        "status_code": None,
        "is_rate_limited": False,
        "is_timeout": False,
        "error": None,
        "last_checked": timestamp,
    }
    
    try:
        start_time = asyncio.get_event_loop().time()
        response = await client.get(url)
        end_time = asyncio.get_event_loop().time()
        
        latency_ms = (end_time - start_time) * 1000
        status_code = response.status_code
        is_rate_limited = status_code == 429
        
        result["latency_ms"] = round(latency_ms, 2)
        result["status_code"] = status_code
        result["is_rate_limited"] = is_rate_limited
        result["is_timeout"] = False
        result["error"] = None
        
        result["status"] = _classify_status(
            status_code=status_code,
            latency_ms=latency_ms,
            is_timeout=False,
            is_rate_limited=is_rate_limited,
            has_error=False
        )
        
    except httpx.TimeoutException:
        result["is_timeout"] = True
        result["status"] = "down"
        result["error"] = "Request timed out"
        
    except httpx.ConnectError:
        result["status"] = "down"
        result["error"] = "Connection refused"
        
    except httpx.ConnectTimeout:
        result["is_timeout"] = True
        result["status"] = "down"
        result["error"] = "Connection timed out"
        
    except httpx.ReadTimeout:
        result["is_timeout"] = True
        result["status"] = "down"
        result["error"] = "Read timed out"
        
    except httpx.HTTPStatusError as e:
        result["status_code"] = e.response.status_code
        result["status"] = "down"
        result["error"] = f"HTTP error: {e.response.status_code}"
        
    except Exception as e:
        result["status"] = "down"
        result["error"] = str(e)
    
    # Log every probe result
    print(f"[HEALTH] {name}: {result['status']} ({result['latency_ms']}ms)")
    
    return result


async def _run_all_probes() -> Dict[str, Dict[str, Any]]:
    """
    Run all API probes in parallel using asyncio.gather.
    Returns dict mapping API name to health data.
    """
    global _last_run
    
    timeout = httpx.Timeout(5.0)
    
    async with httpx.AsyncClient(
        timeout=timeout,
        follow_redirects=True,
        headers={"User-Agent": "DevPulse-HealthMonitor/1.0"}
    ) as client:
        # Create probe tasks
        probes = [
            _probe_single_api(client, api["name"], api["url"])
            for api in API_CONFIGS
        ]
        
        # Execute all probes in parallel
        results = await asyncio.gather(*probes, return_exceptions=True)
    
    # Process results
    processed: Dict[str, Dict[str, Any]] = {}
    timestamp = datetime.now(timezone.utc).isoformat()
    
    for i, result in enumerate(results):
        api_name = API_CONFIGS[i]["name"]
        
        if isinstance(result, Exception):
            # Handle any exceptions that weren't caught in probe
            processed[api_name] = {
                "name": api_name,
                "status": "down",
                "latency_ms": 0.0,
                "status_code": None,
                "is_rate_limited": False,
                "is_timeout": False,
                "error": str(result),
                "last_checked": timestamp,
            }
            print(f"[HEALTH] {api_name}: down (exception: {result})")
        else:
            processed[api_name] = result
    
    _last_run = timestamp
    return processed


async def _update_health_data(new_data: Dict[str, Dict[str, Any]]) -> None:
    """Thread-safe update of health_data dict."""
    global health_data
    async with _health_lock:
        health_data.clear()
        health_data.update(new_data)


async def _monitor_loop() -> None:
    """
    Background monitoring loop.
    Runs every 60 seconds indefinitely.
    """
    print("[HEALTH] Starting health monitor background task...")
    
    while True:
        try:
            print(f"[HEALTH] Running health probes at {datetime.now(timezone.utc).isoformat()}")
            
            # Run all probes
            new_data = await _run_all_probes()
            
            # Update health_data with lock
            await _update_health_data(new_data)
            
            # Count statuses
            healthy = sum(1 for api in new_data.values() if api["status"] == "healthy")
            degraded = sum(1 for api in new_data.values() if api["status"] == "degraded")
            down = sum(1 for api in new_data.values() if api["status"] == "down")
            
            print(f"[HEALTH] Probe complete: {healthy} healthy, {degraded} degraded, {down} down")
            
        except asyncio.CancelledError:
            print("[HEALTH] Monitor loop cancelled, shutting down...")
            raise
        except Exception as e:
            print(f"[HEALTH] Error in monitor loop: {e}")
        
        # Wait 60 seconds before next run
        try:
            await asyncio.sleep(60)
        except asyncio.CancelledError:
            print("[HEALTH] Sleep cancelled, shutting down...")
            raise


async def start_monitor() -> None:
    """
    Start the background health monitor.
    Called from FastAPI startup event.
    """
    global _monitor_task
    
    if _monitor_task is not None and not _monitor_task.done():
        print("[HEALTH] Monitor already running")
        return
    
    _monitor_task = asyncio.create_task(_monitor_loop())
    print("[HEALTH] Health monitor started")


async def stop_monitor() -> None:
    """
    Stop the background health monitor.
    Called from FastAPI shutdown event.
    """
    global _monitor_task
    
    if _monitor_task is None:
        return
    
    if not _monitor_task.done():
        _monitor_task.cancel()
        try:
            await _monitor_task
        except asyncio.CancelledError:
            pass
    
    _monitor_task = None
    print("[HEALTH] Health monitor stopped")


def get_health_data() -> Dict[str, Any]:
    """
    Get current health data for all APIs.
    Returns the health_data dict (read-only snapshot).
    """
    return dict(health_data)


def get_dashboard_response() -> Dict[str, Any]:
    """
    Get formatted dashboard response with summary.
    
    Returns:
    {
      "apis": health_data,
      "summary": {
        "total": 15,
        "healthy": <count>,
        "degraded": <count>,
        "down": <count>,
        "last_run": "<ISO UTC timestamp>"
      },
      "status": "success"
    }
    """
    current_data = dict(health_data)
    
    healthy = sum(1 for api in current_data.values() if api.get("status") == "healthy")
    degraded = sum(1 for api in current_data.values() if api.get("status") == "degraded")
    down = sum(1 for api in current_data.values() if api.get("status") == "down")
    
    return {
        "apis": current_data,
        "summary": {
            "total": len(API_CONFIGS),
            "healthy": healthy,
            "degraded": degraded,
            "down": down,
            "last_run": _last_run
        },
        "status": "success"
    }


def get_api_details_list() -> list:
    """
    Get list of API details for /api/api-details endpoint.
    Returns list of dicts with all probe data.
    """
    current_data = dict(health_data)
    
    # If no data yet, return initial placeholder
    if not current_data:
        timestamp = datetime.now(timezone.utc).isoformat()
        return [
            {
                "name": api["name"],
                "category": api["category"],
                "status": "unknown",
                "latency_ms": 0,
                "status_code": None,
                "is_rate_limited": False,
                "is_timeout": False,
                "error": "Not yet probed",
                "last_checked": timestamp,
            }
            for api in API_CONFIGS
        ]
    
    # Return actual probe data
    result = []
    for api in API_CONFIGS:
        if api["name"] in current_data:
            data = current_data[api["name"]].copy()
            data["category"] = api["category"]
            result.append(data)
        else:
            result.append({
                "name": api["name"],
                "category": api["category"],
                "status": "unknown",
                "latency_ms": 0,
                "status_code": None,
                "is_rate_limited": False,
                "is_timeout": False,
                "error": "Not yet probed",
                "last_checked": datetime.now(timezone.utc).isoformat(),
            })
    
    return result
