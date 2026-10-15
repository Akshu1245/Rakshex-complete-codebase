"""
Custom API / OpenAPI Import Routes - Import and manage custom APIs.

Endpoints:
- POST /api/custom/import   - Import an OpenAPI/Swagger spec (URL or JSON)
- GET  /api/custom/apis     - List user's custom APIs
- DELETE /api/custom/apis/{id} - Remove a custom API
"""
import json
import logging
from typing import Dict, Any, Optional

import httpx
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from routes.auth import require_auth
from services.database import save_custom_api, get_custom_apis, delete_custom_api

logger = logging.getLogger(__name__)
router = APIRouter()


class ImportRequest(BaseModel):
    url: Optional[str] = Field(default=None, max_length=500, description="HTTPS URL to OpenAPI spec (SSRF-validated)")
    spec_json: Optional[Dict[str, Any]] = Field(default=None, description="OpenAPI spec as JSON")
    protocol: str = Field(default="rest", description="rest, graphql, grpc, websocket")


@router.post("/api/custom/import")
async def import_api(req: ImportRequest, user: Dict = Depends(require_auth)) -> Dict[str, Any]:
    """Import an OpenAPI/Swagger specification (inline JSON or SSRF-safe URL fetch).

    Imported titles are stored as custom APIs only; they are never mapped to
    change-detection providers (see services/provider_registry.py).
    """
    from services.safe_fetch import fetch_spec, SpecFetchError
    spec: Optional[Dict[str, Any]] = req.spec_json
    if spec is None and req.url:
        try:
            spec = await fetch_spec(req.url)
        except SpecFetchError as e:
            raise HTTPException(status_code=e.status, detail=e.message)
    if not spec or not isinstance(spec, dict):
        raise HTTPException(status_code=422, detail="No valid spec provided")

    info = spec.get("info") if isinstance(spec.get("info"), dict) else {}
    api_name = str(info.get("title") or "Imported API")[:255]
    version = str(info.get("version") or "1.0.0")[:50]
    base_url = ""
    servers = spec.get("servers", [])
    if servers and isinstance(servers, list) and isinstance(servers[0], dict):
        base_url = str(servers[0].get("url", ""))[:500]
    paths = spec.get("paths") if isinstance(spec.get("paths"), dict) else {}
    endpoint_count = sum(len(v) for v in paths.values() if isinstance(v, dict))

    try:
        await save_custom_api(
            user_id=user["id"], name=api_name, protocol=req.protocol,
            base_url=base_url, spec_json=spec,
            metadata_json={"version": version, "endpoint_count": endpoint_count},
        )
    except Exception as e:
        logger.error(f"Import save error: {e}")
        raise HTTPException(status_code=500, detail="Failed to import API spec")

    return {
        "status": "success",
        "api_name": api_name,
        "version": version,
        "base_url": base_url,
        "endpoint_count": endpoint_count,
        "protocol": req.protocol,
        "paths": list(paths.keys())[:20],
    }


@router.get("/api/custom/apis")
async def list_custom_apis(user: Dict = Depends(require_auth)) -> Dict[str, Any]:
    """List user's imported custom APIs."""
    try:
        apis = await get_custom_apis(user["id"])
    except Exception as e:
        logger.error(f"Error listing custom APIs: {e}")
        raise HTTPException(status_code=500, detail="Failed to list custom APIs")
    return {"status": "success", "apis": apis, "count": len(apis)}


@router.delete("/api/custom/apis/{api_id}")
async def remove_custom_api(api_id: int, user: Dict = Depends(require_auth)) -> Dict[str, Any]:
    """Delete a custom imported API (owner only; others get 404)."""
    try:
        ok = await delete_custom_api(api_id, user["id"])
    except Exception as e:
        logger.error(f"Error deleting custom API: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete custom API")
    if not ok:
        raise HTTPException(status_code=404, detail="API not found")
    return {"status": "success", "message": f"API {api_id} deleted"}
