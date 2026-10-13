"""
AI Security Scanner Routes — /api/v1/security/*

Pillar 1: The AI API Security Scanner.
Exposes endpoints for token leak detection, agent attack scanning,
OWASP API Top 10, full scans, fix suggestions, threat feed, and API inventory.
All scan results are persisted to the database for real score history.
"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Body, Query
from pydantic import BaseModel, Field

from routes.auth import require_auth
from services.ai_security_engine import (
    scan_token_leaks,
    scan_agent_attacks,
    scan_owasp_api,
    full_security_scan,
    generate_fix_suggestions,
    get_threat_feed,
    scan_api_inventory,
)
from services.database import (
    save_ai_security_scan,
    get_ai_security_score_history,
    save_threat_event,
    get_threat_events_db,
    resolve_threat_event,
)
from services.cache import cache_get, cache_set, security_scan_key, make_code_hash

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/security", tags=["AI Security"])


# ── Request / Response models ───────────────────────────────────────────────

class ScanRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=500_000, description="Source code to scan")
    language: str = Field("python", max_length=30)


class FixRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=500_000)
    findings: list = Field(default_factory=list)


# ── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/scan/tokens")
async def scan_tokens_endpoint(req: ScanRequest, user=Depends(require_auth)):
    """Scan code for leaked tokens, API keys, and secrets."""
    try:
        result = scan_token_leaks(req.code)
        return {"status": "ok", **result}
    except Exception as e:
        logger.error(f"Token scan failed: {e}")
        raise HTTPException(500, "Token scan failed")


@router.post("/scan/agents")
async def scan_agents_endpoint(req: ScanRequest, user=Depends(require_auth)):
    """Scan code for AI agent attack vectors (prompt injection, SSRF, etc.)."""
    try:
        result = scan_agent_attacks(req.code)
        return {"status": "ok", **result}
    except Exception as e:
        logger.error(f"Agent scan failed: {e}")
        raise HTTPException(500, "Agent attack scan failed")


@router.post("/scan/owasp")
async def scan_owasp_endpoint(req: ScanRequest, user=Depends(require_auth)):
    """Scan for OWASP API Security Top 10 (2023) issues."""
    try:
        result = scan_owasp_api(req.code)
        return {"status": "ok", **result}
    except Exception as e:
        logger.error(f"OWASP scan failed: {e}")
        raise HTTPException(500, "OWASP scan failed")


@router.post("/scan/full")
async def full_scan_endpoint(req: ScanRequest, user=Depends(require_auth)):
    """Run complete security scan (tokens + agents + OWASP). Returns composite score. Cached 5 min. Persisted to DB."""
    try:
        code_hash = make_code_hash(req.code)
        key = security_scan_key(code_hash)
        cached = await cache_get(key)
        if cached:
            return {"status": "ok", **cached, "cached": True}

        result = full_security_scan(req.code, req.language)
        await cache_set(key, result, ttl=300)

        # Persist scan result to DB for real score history
        user_id = user.get("user_id", 0)
        if user_id:
            try:
                score = result.get("composite_score", 100)
                findings = result.get("all_findings", [])
                severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
                for f in findings:
                    sev = f.get("severity", "medium").lower()
                    if sev in severity_counts:
                        severity_counts[sev] += 1
                grade = (
                    "A+" if score >= 97 else "A" if score >= 90 else
                    "B" if score >= 75 else "C" if score >= 60 else
                    "D" if score >= 40 else "F"
                )
                await save_ai_security_scan(
                    user_id=user_id,
                    scan_type="full",
                    target=req.code[:500],
                    score=score,
                    grade=grade,
                    threats_found=result.get("total_threats", 0),
                    critical_count=severity_counts["critical"],
                    high_count=severity_counts["high"],
                    medium_count=severity_counts["medium"],
                    low_count=severity_counts["low"],
                    results_json=result,
                )
            except Exception as db_err:
                logger.warning(f"Failed to persist scan to DB: {db_err}")

        return {"status": "ok", **result}
    except Exception as e:
        logger.error(f"Full scan failed: {e}")
        raise HTTPException(500, "Full security scan failed")


@router.post("/fix-suggestions")
async def fix_suggestions_endpoint(req: FixRequest, user=Depends(require_auth)):
    """Generate AI-powered fix suggestions for security findings."""
    try:
        suggestions = await generate_fix_suggestions(req.findings, req.code)
        return {
            "status": "ok",
            "suggestions": suggestions,
            "total": len(suggestions),
        }
    except Exception as e:
        logger.error(f"Fix suggestions failed: {e}")
        raise HTTPException(500, "Fix suggestion generation failed")


@router.get("/threat-feed")
async def threat_feed_endpoint(user=Depends(require_auth)):
    """Get real-time AI/API threat intelligence feed. DB-backed with seed data fallback."""
    try:
        # Cache for 5 minutes
        cached = await cache_get("threat_feed")
        if cached:
            return {"status": "ok", "threats": cached, "cached": True}

        # Try DB first
        db_threats = await get_threat_events_db(limit=50)
        if db_threats:
            await cache_set("threat_feed", db_threats, ttl=300)
            return {"status": "ok", "threats": db_threats, "cached": False}

        # Seed the DB with known threats on first request
        seed_threats = get_threat_feed()
        for t in seed_threats:
            try:
                await save_threat_event(
                    threat_type=t.get("title", "Unknown"),
                    severity=t.get("severity", "medium"),
                    source=t.get("source", ""),
                    description=t.get("description", ""),
                    api_endpoint=",".join(t.get("affected_providers", [])),
                )
            except Exception:
                pass

        db_threats = await get_threat_events_db(limit=50)
        await cache_set("threat_feed", db_threats, ttl=300)
        return {"status": "ok", "threats": db_threats, "cached": False}
    except Exception as e:
        logger.error(f"Threat feed failed: {e}")
        raise HTTPException(500, "Threat feed unavailable")


@router.post("/threats")
async def report_threat_endpoint(
    user=Depends(require_auth),
    threat_type: str = Body(...),
    severity: str = Body("medium"),
    source: str = Body(""),
    description: str = Body(""),
    api_endpoint: str = Body(""),
):
    """Report a new threat event. Stored in DB."""
    try:
        threat_id = await save_threat_event(
            threat_type=threat_type,
            severity=severity,
            source=source,
            description=description,
            api_endpoint=api_endpoint,
            user_id=user.get("user_id"),
        )
        # Invalidate cache
        await cache_set("threat_feed", None, ttl=0)
        return {"status": "ok", "threat_id": threat_id}
    except Exception as e:
        logger.error(f"Report threat failed: {e}")
        raise HTTPException(500, "Failed to report threat")


@router.post("/threats/{threat_id}/resolve")
async def resolve_threat_endpoint(threat_id: int, user=Depends(require_auth)):
    """Mark a threat as resolved."""
    try:
        ok = await resolve_threat_event(threat_id)
        if ok:
            await cache_set("threat_feed", None, ttl=0)
            return {"status": "ok", "message": f"Threat {threat_id} resolved"}
        raise HTTPException(404, "Threat not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Resolve threat failed: {e}")
        raise HTTPException(500, "Failed to resolve threat")


@router.post("/inventory")
async def api_inventory_endpoint(req: ScanRequest, user=Depends(require_auth)):
    """Discover AI/API providers used in code."""
    try:
        result = scan_api_inventory(req.code)
        return {"status": "ok", **result}
    except Exception as e:
        logger.error(f"Inventory scan failed: {e}")
        raise HTTPException(500, "API inventory scan failed")


@router.get("/score-history")
async def score_history_endpoint(
    user=Depends(require_auth),
    limit: int = Query(20, ge=1, le=100),
):
    """Get security scan score history for the current user. Real DB-backed data."""
    try:
        user_id = user.get("user_id", 0)
        history = await get_ai_security_score_history(user_id, limit=limit)
        return {"status": "ok", "history": history, "total": len(history)}
    except Exception as e:
        logger.error(f"Score history failed: {e}")
        raise HTTPException(500, "Failed to get score history")
