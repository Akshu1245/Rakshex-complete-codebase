"""
CI/CD Integration Routes - Quality gates for pipelines.

Endpoints:
- POST /api/cicd/check     - Run quality gate check (security + health)
- POST /api/cicd/webhook   - CI/CD webhook receiver
- GET  /api/cicd/runs      - List CI/CD run history
- GET  /api/cicd/badge/{pipeline_id} - Status badge (SVG)
"""
import uuid
import logging
from typing import Dict, Any, Optional, List

from fastapi import APIRouter, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field

from services.security_scanner import scan_code
from services.database import save_cicd_run, get_cicd_runs_db

logger = logging.getLogger(__name__)
router = APIRouter()

BADGE_TEMPLATE = '''<svg xmlns="http://www.w3.org/2000/svg" width="120" height="20">
  <rect width="60" height="20" fill="#555"/>
  <rect x="60" width="60" height="20" fill="{color}"/>
  <text x="30" y="14" fill="#fff" text-anchor="middle" font-size="11" font-family="monospace">DevPulse</text>
  <text x="90" y="14" fill="#fff" text-anchor="middle" font-size="11" font-family="monospace">{label}</text>
</svg>'''


class CICDCheckRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=50000, description="Code to check")
    language: str = Field(default="python", max_length=20)
    pipeline_id: str = Field(default="default", max_length=100)
    repo: str = Field(default="unknown", max_length=200)
    branch: str = Field(default="main", max_length=100)
    min_score: int = Field(default=70, ge=0, le=100, description="Minimum security score to pass")


class WebhookPayload(BaseModel):
    event: str = Field(..., max_length=50)
    pipeline_id: str = Field(default="default", max_length=100)
    repo: str = Field(default="unknown", max_length=200)
    branch: str = Field(default="main", max_length=100)
    commit_sha: str = Field(default="", max_length=50)
    code: Optional[str] = Field(default=None, max_length=50000)
    language: str = Field(default="python", max_length=20)


@router.post("/api/cicd/check")
async def cicd_check(req: CICDCheckRequest) -> Dict[str, Any]:
    """Run a CI/CD quality gate check — scans code and returns pass/fail."""
    try:
        run_id = f"run-{uuid.uuid4().hex[:8]}"
        scan = scan_code(req.code, req.language)
        score = scan.get("score", 0)
        grade = scan.get("grade", "?")
        passed = score >= req.min_score
        vuln_count = len(scan.get("vulnerabilities", []))

        await save_cicd_run(
            run_id=run_id, pipeline_id=req.pipeline_id,
            repo=req.repo, branch=req.branch,
            status="pass" if passed else "fail",
            security_score=score, details=scan,
        )

        return {
            "status": "success",
            "run_id": run_id,
            "passed": passed,
            "security_score": score,
            "grade": grade,
            "vulnerabilities_found": vuln_count,
            "threshold": req.min_score,
            "verdict": "PASS ✅" if passed else "FAIL ❌",
            "details": scan.get("vulnerabilities", []),
        }
    except Exception as e:
        logger.error(f"CI/CD check error: {e}")
        return {"status": "error", "error": "CI/CD check failed"}


@router.post("/api/cicd/webhook")
async def cicd_webhook(payload: WebhookPayload) -> Dict[str, Any]:
    """Receive CI/CD webhook events and optionally run quality gate."""
    try:
        run_id = f"run-{uuid.uuid4().hex[:8]}"
        result: Dict[str, Any] = {"event": payload.event, "run_id": run_id}

        if payload.code:
            scan = scan_code(payload.code, payload.language)
            score = scan.get("score", 0)
            passed = score >= 70
            result.update({"security_score": score, "passed": passed,
                           "grade": scan.get("grade", "?")})
            status = "pass" if passed else "fail"
        else:
            status = "received"
            result["message"] = "Webhook received (no code to scan)"

        await save_cicd_run(
            run_id=run_id, pipeline_id=payload.pipeline_id,
            repo=payload.repo, branch=payload.branch,
            status=status, security_score=result.get("security_score", 0),
            details=result,
        )
        return {"status": "success", **result}
    except Exception as e:
        logger.error(f"CI/CD webhook error: {e}")
        return {"status": "error", "error": "Webhook processing failed"}


@router.get("/api/cicd/runs")
async def list_runs(
    limit: int = Query(20, ge=1, le=100),
    pipeline_id: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """List CI/CD run history."""
    try:
        runs = await get_cicd_runs_db(limit=limit, pipeline_id=pipeline_id)
        return {"status": "success", "runs": runs, "count": len(runs)}
    except Exception as e:
        logger.error(f"Error listing CI/CD runs: {e}")
        return {"status": "error", "error": "Failed to list runs"}


@router.get("/api/cicd/badge/{pipeline_id}")
async def status_badge(pipeline_id: str) -> Response:
    """Get an SVG status badge for a pipeline."""
    try:
        runs = await get_cicd_runs_db(limit=1, pipeline_id=pipeline_id)
        if runs:
            last = runs[0]
            st = last.get("status", "unknown")
            color = "#4c1" if st == "pass" else "#e05d44" if st == "fail" else "#9f9f9f"
            label = st.upper()
        else:
            color, label = "#9f9f9f", "N/A"
        svg = BADGE_TEMPLATE.format(color=color, label=label)
        return Response(content=svg, media_type="image/svg+xml")
    except Exception:
        svg = BADGE_TEMPLATE.format(color="#9f9f9f", label="ERR")
        return Response(content=svg, media_type="image/svg+xml")
