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
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from routes.auth import require_auth
from services.database import save_custom_api, get_custom_apis, delete_custom_api

logger = logging.getLogger(__name__)
router = APIRouter()


class ImportRequest(BaseModel):
    url: Optional[str] = Field(default=None, max_length=500, description="URL to OpenAPI spec")
    spec_json: Optional[Dict[str, Any]] = Field(default=None, description="OpenAPI spec as JSON")
    protocol: str = Field(default="rest", description="rest, graphql, grpc, websocket")


@router.post("/api/custom/import")
async def import_api(req: ImportRequest, user: Dict = Depends(require_auth)) -> Dict[str, Any]:
    """Import an OpenAPI/Swagger specification."""
    try:
        spec: Optional[Dict[str, Any]] = req.spec_json

        # Fetch from URL if provided
        if not spec and req.url:
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.get(req.url)
                r.raise_for_status()
                ct = r.headers.get("content-type", "")
                if "yaml" in ct or req.url.endswith((".yaml", ".yml")):
                    # basic YAML-like parse (for robustness; full yaml needs pyyaml)
                    try:
                        import yaml  # type: ignore
                        spec = yaml.safe_load(r.text)
                    except ImportError:
                        spec = json.loads(r.text)
                else:
                    spec = r.json()

        if not spec or not isinstance(spec, dict):
            return {"status": "error", "error": "No valid spec provided"}

        # Extract metadata from OpenAPI spec
        info = spec.get("info", {})
        api_name = info.get("title", "Imported API")
        version = info.get("version", "1.0.0")
        base_url = ""
        servers = spec.get("servers", [])
        if servers and isinstance(servers, list):
            base_url = servers[0].get("url", "")

        # Count endpoints
        paths = spec.get("paths", {})
        endpoint_count = sum(len(v) for v in paths.values() if isinstance(v, dict))

        # Save to DB
        await save_custom_api(
            user_id=user["id"], name=api_name, protocol=req.protocol,
            base_url=base_url, spec_json=spec,
        )

        return {
            "status": "success",
            "api_name": api_name,
            "version": version,
            "base_url": base_url,
            "endpoint_count": endpoint_count,
            "protocol": req.protocol,
            "paths": list(paths.keys())[:20],
        }
    except httpx.HTTPError as e:
        logger.error(f"Failed to fetch spec: {e}")
        return {"status": "error", "error": "Failed to fetch OpenAPI spec from URL"}
    except Exception as e:
        logger.error(f"Import error: {e}")
        return {"status": "error", "error": "Failed to import API spec"}


@router.get("/api/custom/apis")
async def list_custom_apis(user: Dict = Depends(require_auth)) -> Dict[str, Any]:
    """List user's imported custom APIs."""
    try:
        apis = await get_custom_apis(user["id"])
        return {"status": "success", "apis": apis, "count": len(apis)}
    except Exception as e:
        logger.error(f"Error listing custom APIs: {e}")
        return {"status": "error", "error": "Failed to list custom APIs"}


@router.delete("/api/custom/apis/{api_id}")
async def remove_custom_api(api_id: int, user: Dict = Depends(require_auth)) -> Dict[str, Any]:
    """Delete a custom imported API."""
    try:
        ok = await delete_custom_api(api_id, user["id"])
        if ok:
            return {"status": "success", "message": f"API {api_id} deleted"}
        return {"status": "error", "error": "API not found"}
    except Exception as e:
        logger.error(f"Error deleting custom API: {e}")
        return {"status": "error", "error": "Failed to delete custom API"}
