"""
Marketplace Routes - Community template sharing.

Endpoints:
- GET  /api/marketplace/templates       - Browse templates
- GET  /api/marketplace/templates/{id}  - Get template details
- POST /api/marketplace/templates       - Publish a template
- POST /api/marketplace/templates/{id}/install - Install (download) a template
- POST /api/marketplace/templates/{id}/review  - Add a review
- GET  /api/marketplace/stats           - Marketplace statistics
"""
import logging
from typing import Dict, Any, Optional, List

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from services.marketplace import (
    get_templates, get_template, publish_template,
    install_template, add_review, get_marketplace_stats,
)

logger = logging.getLogger(__name__)
router = APIRouter()


class PublishTemplateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1, max_length=2000)
    category: str = Field(default="general", max_length=50)
    tags: List[str] = Field(default_factory=list)
    language: str = Field(default="python", max_length=20)
    apis_used: List[str] = Field(default_factory=list)
    code: str = Field(..., min_length=1, max_length=50000)
    author: str = Field(default="community", max_length=100)
    version: str = Field(default="1.0.0", max_length=20)


class ReviewRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: str = Field(default="", max_length=1000)


@router.get("/api/marketplace/templates")
async def browse_templates(
    category: Optional[str] = Query(None),
    language: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """Browse marketplace templates."""
    try:
        templates = await get_templates(category=category, language=language, search=search)
        return {"status": "success", "templates": templates, "count": len(templates)}
    except Exception as e:
        logger.error(f"Error browsing templates: {e}")
        return {"status": "error", "error": "Failed to browse templates"}


@router.get("/api/marketplace/templates/{template_id}")
async def get_template_detail(template_id: str) -> Dict[str, Any]:
    """Get a single template's details."""
    try:
        tmpl = await get_template(template_id)
        if not tmpl:
            return {"status": "error", "error": "Template not found"}
        return {"status": "success", "template": tmpl}
    except Exception as e:
        logger.error(f"Error getting template: {e}")
        return {"status": "error", "error": "Failed to get template"}


@router.post("/api/marketplace/templates")
async def publish(req: PublishTemplateRequest) -> Dict[str, Any]:
    """Publish a new template to the marketplace."""
    try:
        result = await publish_template(
            name=req.name, description=req.description,
            author=req.author, author_id=None,
            category=req.category, tags=req.tags,
            language=req.language, apis_used=req.apis_used,
            code=req.code, version=req.version,
        )
        return {"status": "success", **result}
    except Exception as e:
        logger.error(f"Error publishing template: {e}")
        return {"status": "error", "error": "Failed to publish template"}


@router.post("/api/marketplace/templates/{template_id}/install")
async def install(template_id: str) -> Dict[str, Any]:
    """Install (download) a template."""
    try:
        result = await install_template(template_id)
        if not result:
            return {"status": "error", "error": "Template not found"}
        return {"status": "success", **result}
    except Exception as e:
        logger.error(f"Error installing template: {e}")
        return {"status": "error", "error": "Failed to install template"}


@router.post("/api/marketplace/templates/{template_id}/review")
async def review_template(template_id: str, req: ReviewRequest) -> Dict[str, Any]:
    """Add a review to a template."""
    try:
        result = await add_review(
            template_id=template_id, user_id=None,
            rating=req.rating, comment=req.comment,
        )
        return {"status": "success", **result}
    except Exception as e:
        logger.error(f"Error adding review: {e}")
        return {"status": "error", "error": "Failed to add review"}


@router.get("/api/marketplace/stats")
async def marketplace_stats() -> Dict[str, Any]:
    """Get marketplace statistics."""
    try:
        stats = await get_marketplace_stats()
        return {"status": "success", **stats}
    except Exception as e:
        logger.error(f"Error getting marketplace stats: {e}")
        return {"status": "error", "error": "Failed to get marketplace stats"}
