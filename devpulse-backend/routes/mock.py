"""
Mock Server Routes - Mock API responses and offline code generation.

Endpoints:
- GET  /api/mock/response/{api_name} - Get a mock response for an API
- GET  /api/mock/responses            - Get all mock responses
- POST /api/mock/generate             - Generate offline integration code
"""
import logging
from typing import Dict, Any

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from services.mock_server import get_mock_response, get_all_mock_responses, generate_mock_code

logger = logging.getLogger(__name__)
router = APIRouter()


class MockCodeRequest(BaseModel):
    use_case: str = Field(..., min_length=1, max_length=300, description="Use-case description")
    language: str = Field(default="python", description="Target language: python, javascript, typescript")


@router.get("/api/mock/response/{api_name}")
async def mock_response(
    api_name: str,
    randomize: bool = Query(True),
) -> Dict[str, Any]:
    """Get a mock response for a specific API."""
    try:
        result = get_mock_response(api_name, randomize)
        return {"status": "success", **result}
    except Exception as e:
        logger.error(f"Mock response error: {e}")
        return {"status": "error", "error": "Failed to generate mock response"}


@router.get("/api/mock/responses")
async def all_mock_responses() -> Dict[str, Any]:
    """Get mock responses for all supported APIs."""
    try:
        result = get_all_mock_responses()
        return {"status": "success", **result}
    except Exception as e:
        logger.error(f"Mock responses error: {e}")
        return {"status": "error", "error": "Failed to generate mock responses"}


@router.post("/api/mock/generate")
async def generate_code(req: MockCodeRequest) -> Dict[str, Any]:
    """Generate offline integration code for a use case."""
    try:
        result = generate_mock_code(req.use_case, req.language)
        return {"status": "success", **result}
    except Exception as e:
        logger.error(f"Mock code generation error: {e}")
        return {"status": "error", "error": "Failed to generate code"}
