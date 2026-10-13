"""
API Change Detection & Versioning Alerts Service.

Detects schema changes in API responses by comparing response samples
over time. Stores snapshots in DB and generates diffs when changes occur.
"""
import asyncio
import json
import hashlib
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from collections import OrderedDict

import httpx

logger = logging.getLogger(__name__)

_detector_task: Optional[asyncio.Task] = None
_schema_cache: Dict[str, Dict[str, Any]] = {}
_change_alerts_cache: List[Dict[str, Any]] = []
_lock = asyncio.Lock()
MAX_CACHE_ALERTS = 200

MONITORED_APIS = [
    {"name": "GitHub", "url": "https://api.github.com", "type": "rest"},
    {"name": "CoinGecko", "url": "https://api.coingecko.com/api/v3/ping", "type": "rest"},
    {"name": "Reddit", "url": "https://www.reddit.com/r/programming.json", "type": "rest"},
    {"name": "NASA", "url": "https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY", "type": "rest"},
    {"name": "Discord", "url": "https://discord.com/api/v10/gateway", "type": "rest"},
    {"name": "Slack", "url": "https://slack.com/api/api.test", "type": "rest"},
]


def _extract_schema(data: Any, path: str = "") -> Dict[str, str]:
    schema: Dict[str, str] = {}
    if isinstance(data, dict):
        for key, value in sorted(data.items()):
            fp = f"{path}.{key}" if path else key
            schema[fp] = type(value).__name__
            if isinstance(value, (dict, list)):
                schema.update(_extract_schema(value, fp))
    elif isinstance(data, list) and data:
        schema[f"{path}[]"] = type(data[0]).__name__
        if isinstance(data[0], (dict, list)):
            schema.update(_extract_schema(data[0], f"{path}[]"))
    return schema


def _compute_hash(schema: Dict[str, str]) -> str:
    ordered = json.dumps(OrderedDict(sorted(schema.items())), sort_keys=True)
    return hashlib.sha256(ordered.encode()).hexdigest()[:16]


def _diff_schemas(old_schema: Dict[str, str], new_schema: Dict[str, str]) -> Dict[str, Any]:
    old_keys, new_keys = set(old_schema.keys()), set(new_schema.keys())
    added = sorted(new_keys - old_keys)
    removed = sorted(old_keys - new_keys)
    type_changed = [
        {"path": k, "old_type": old_schema[k], "new_type": new_schema[k]}
        for k in sorted(old_keys & new_keys) if old_schema[k] != new_schema[k]
    ]
    return {
        "added": [{"path": p, "type": new_schema[p]} for p in added],
        "removed": [{"path": p, "type": old_schema[p]} for p in removed],
        "type_changed": type_changed,
    }


async def _probe_api(client: httpx.AsyncClient, api: Dict[str, str]) -> Optional[Dict[str, Any]]:
    try:
        resp = await client.get(api["url"])
        if resp.status_code not in range(200, 300):
            return None
        try:
            data = resp.json()
        except Exception:
            return None
        schema = _extract_schema(data)
        return {
            "api_name": api["name"], "schema": schema,
            "schema_hash": _compute_hash(schema),
            "status_code": resp.status_code,
            "response_keys": list(data.keys()) if isinstance(data, dict) else [],
            "field_count": len(schema),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.debug(f"Change probe failed for {api['name']}: {e}")
        return None


async def _detect_changes() -> List[Dict[str, Any]]:
    from services.database import save_api_response, get_last_api_response, save_change_alert
    new_alerts = []
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(8.0), follow_redirects=True,
        headers={"User-Agent": "DevPulse-ChangeDetector/2.0", "Accept": "application/json"}
    ) as client:
        results = await asyncio.gather(
            *[_probe_api(client, api) for api in MONITORED_APIS],
            return_exceptions=True
        )
    for result in results:
        if isinstance(result, Exception) or result is None:
            continue
        api_name = result["api_name"]
        try:
            prev = await get_last_api_response(api_name)
            await save_api_response(
                api_name, result["schema_hash"], json.dumps(result["schema"]),
                json.dumps(result["response_keys"]), result["field_count"], result["status_code"],
            )
            if prev and prev["response_hash"] != result["schema_hash"]:
                old_schema = json.loads(prev["schema_json"]) if prev.get("schema_json") else {}
                diff = _diff_schemas(old_schema, result["schema"])
                total = len(diff["added"]) + len(diff["removed"]) + len(diff["type_changed"])
                severity = "critical" if diff["removed"] or diff["type_changed"] else "warning"
                summary = f"{total} schema change(s) detected in {api_name}"
                alert_id = await save_change_alert(
                    api_name, severity, summary, json.dumps(diff),
                    prev["response_hash"], result["schema_hash"],
                )
                alert = {
                    "id": alert_id, "api_name": api_name, "severity": severity,
                    "change_type": "schema_change", "summary": summary, "details": diff,
                    "detected_at": result["timestamp"], "acknowledged": False,
                }
                async with _lock:
                    _change_alerts_cache.append(alert)
                    if len(_change_alerts_cache) > MAX_CACHE_ALERTS:
                        _change_alerts_cache[:] = _change_alerts_cache[-MAX_CACHE_ALERTS:]
                new_alerts.append(alert)
                logger.warning(f"[CHANGE] {severity.upper()}: {summary}")
            async with _lock:
                _schema_cache[api_name] = result
        except Exception as e:
            logger.error(f"[CHANGE] Error processing {api_name}: {e}")
    return new_alerts


async def _detection_loop():
    logger.info("[CHANGE] Starting change detection loop...")
    await asyncio.sleep(30)
    while True:
        try:
            alerts = await _detect_changes()
            if alerts:
                logger.info(f"[CHANGE] {len(alerts)} new change(s)")
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error(f"[CHANGE] Loop error: {e}")
        await asyncio.sleep(300)


async def start_detector():
    global _detector_task
    if _detector_task and not _detector_task.done():
        return
    _detector_task = asyncio.create_task(_detection_loop())


async def stop_detector():
    global _detector_task
    if _detector_task and not _detector_task.done():
        _detector_task.cancel()
        try:
            await _detector_task
        except asyncio.CancelledError:
            pass
    _detector_task = None


async def get_change_alerts(limit: int = 50, api_name: Optional[str] = None,
                            unacked_only: bool = False) -> List[Dict[str, Any]]:
    from services.database import get_change_alerts_db
    alerts = await get_change_alerts_db(limit, api_name, unacked_only)
    for a in alerts:
        if a.get("diff_json"):
            try:
                a["details"] = json.loads(a["diff_json"])
            except Exception:
                a["details"] = {}
    return alerts


async def acknowledge_alert(alert_id: int) -> bool:
    from services.database import ack_change_alert_db
    return await ack_change_alert_db(alert_id)


async def get_schema_history(api_name: str, limit: int = 20) -> List[Dict[str, Any]]:
    from services.database import get_api_response_history
    rows = await get_api_response_history(api_name, limit)
    return [{
        "schema_hash": r["response_hash"], "field_count": r["field_count"],
        "response_keys": json.loads(r["response_keys"]) if r.get("response_keys") else [],
        "timestamp": r["created_at"],
    } for r in rows]


def get_monitored_apis() -> List[Dict[str, Any]]:
    result = []
    for api in MONITORED_APIS:
        cached = _schema_cache.get(api["name"])
        pending = sum(1 for a in _change_alerts_cache if a["api_name"] == api["name"] and not a.get("acknowledged"))
        result.append({
            "name": api["name"], "url": api["url"], "type": api["type"],
            "last_checked": cached["timestamp"] if cached else None,
            "last_hash": cached["schema_hash"] if cached else None,
            "field_count": cached["field_count"] if cached else 0,
            "pending_alerts": pending,
        })
    return result
