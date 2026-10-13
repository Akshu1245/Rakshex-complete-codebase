"""
Security Scanning Routes - OWASP vulnerability scanning.

Endpoints:
- POST /api/security/scan/code - Scan code for vulnerabilities
- POST /api/security/scan/api  - Scan API configuration
- GET  /api/security/scans     - List past scan results
"""
import logging
from typing import Dict, Any, Optional, List

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from services.security_scanner import scan_code, scan_api_config
from services.database import save_security_scan, get_security_scans

logger = logging.getLogger(__name__)
router = APIRouter()


class CodeScanRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=50000, description="Source code to scan")
    language: str = Field(default="python", max_length=20, description="Programming language")


class ApiScanRequest(BaseModel):
    url: str = Field(..., min_length=5, max_length=500, description="API endpoint URL")
    headers: Dict[str, str] = Field(default_factory=dict, description="Headers to analyze")


@router.post("/api/security/scan/code")
async def scan_code_endpoint(req: CodeScanRequest) -> Dict[str, Any]:
    """Scan source code for OWASP vulnerabilities."""
    try:
        result = scan_code(req.code, req.language)
        # Persist scan
        await save_security_scan(
            user_id=None, scan_type="code", target=f"{req.language} snippet",
            score=result.get("score", 0), grade=result.get("grade", "?"),
            vulnerabilities=result.get("vulnerabilities", []),
        )
        return {"status": "success", **result}
    except Exception as e:
        logger.error(f"Code scan error: {e}")
        return {"status": "error", "error": "Failed to scan code"}


@router.post("/api/security/scan/api")
async def scan_api_endpoint(req: ApiScanRequest) -> Dict[str, Any]:
    """Scan an API configuration for security issues."""
    try:
        result = scan_api_config(req.url, req.headers)
        await save_security_scan(
            user_id=None, scan_type="api", target=req.url,
            score=result.get("score", 0), grade=result.get("grade", "?"),
            vulnerabilities=result.get("issues", []),
        )
        return {"status": "success", **result}
    except Exception as e:
        logger.error(f"API scan error: {e}")
        return {"status": "error", "error": "Failed to scan API configuration"}


@router.get("/api/security/scans")
async def list_scans(
    limit: int = Query(20, ge=1, le=100),
) -> Dict[str, Any]:
    """List past security scan results."""
    try:
        scans = await get_security_scans(limit=limit)
        return {"status": "success", "scans": scans, "count": len(scans)}
    except Exception as e:
        logger.error(f"Error listing scans: {e}")
        return {"status": "error", "error": "Failed to list scans"}
