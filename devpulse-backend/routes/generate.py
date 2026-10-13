"""
Generate Routes - AI-powered code generation endpoint using Groq API.

Implements complete input validation, sanitization, and error handling.
Never returns HTTP 500 - all errors are caught and returned as structured responses.
"""
import re
import logging
from typing import Dict, Any

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field, field_validator

from services.groq_client import generate_code, detect_relevant_apis, sanitize_input

logger = logging.getLogger(__name__)

router = APIRouter()


# =============================================================================
# ENHANCED REQUEST MODEL WITH SANITIZATION
# =============================================================================

class GenerateCodeRequest(BaseModel):
    """
    Request model for code generation endpoint.
    Implements Pydantic validation with sanitization.
    """
    use_case: str = Field(..., min_length=1, max_length=500)
    language: str = Field(default="python", description="Target language: python, javascript, typescript, java, go, rust")
    auto_repair: bool = Field(default=True, description="Automatically repair code if validation fails")
    
    @field_validator("language")
    @classmethod
    def validate_language(cls, v: str) -> str:
        allowed = {"python", "javascript", "typescript", "java", "go", "rust"}
        v = v.strip().lower()
        if v not in allowed:
            raise ValueError(f"Unsupported language '{v}'. Choose from: {', '.join(sorted(allowed))}")
        return v
    
    @field_validator("use_case")
    @classmethod
    def validate_and_sanitize(cls, v: str) -> str:
        """
        Validate and sanitize use_case input.
        
        Steps:
        1. Strip leading/trailing whitespace
        2. Remove HTML tags
        3. Remove dangerous characters
        4. Validate non-empty result
        """
        if not v:
            raise ValueError("use_case cannot be empty")
        
        # Strip whitespace
        sanitized = v.strip()
        
        # Remove HTML tags
        sanitized = re.sub(r'<[^>]+>', '', sanitized)
        
        # Remove dangerous characters: semicolons, backticks, angle brackets
        sanitized = re.sub(r'[;`<>]', '', sanitized)
        
        # Final strip
        sanitized = sanitized.strip()
        
        # Validate non-empty after sanitization
        if not sanitized:
            raise ValueError("use_case is empty after removing invalid characters")
        
        if len(sanitized) > 500:
            raise ValueError("use_case exceeds 500 characters after sanitization")
        
        return sanitized


# =============================================================================
# MAIN ENDPOINT
# =============================================================================

@router.post("/api/generate")
async def generate_integration_code(request_body: GenerateCodeRequest, request: Request) -> Dict[str, Any]:
    """
    Generate production-ready Python integration code using Groq AI.
    
    Request Body:
        {"use_case": str} - Description of the integration use case (1-500 chars)
    
    Returns:
        Success: {"code": str, "apis_used": list, "tokens_used": int, "status": "success"}
        Fallback: {"code": "", "apis_used": list, "status": "fallback", "message": str}
        Error: {"code": "", "apis_used": [], "status": "error", "message": str}
    
    This endpoint never returns HTTP 500. All errors are caught and returned
    as structured JSON responses with appropriate status codes.
    """
    try:
        # Request is already validated and sanitized by Pydantic
        result = await generate_code(request_body.use_case, language=request_body.language, auto_repair=request_body.auto_repair)
        return result
        
    except ValueError as e:
        # Validation errors from Pydantic
        logger.warning(f"Generate validation error: {e}")
        return {
            "code": "",
            "apis_used": [],
            "tokens_used": 0,
            "status": "error",
            "message": f"Validation error: {str(e)}"
        }
        
    except TypeError as e:
        # Type errors (shouldn't happen with proper validation)
        logger.error(f"Generate type error: {e}")
        return {
            "code": "",
            "apis_used": [],
            "tokens_used": 0,
            "status": "error",
            "message": "Invalid input type"
        }
        
    except Exception as e:
        # Catch-all: never crash, never return 500
        logger.error(f"Unexpected error in generate endpoint: {e}")
        return {
            "code": "",
            "apis_used": [],
            "tokens_used": 0,
            "status": "error",
            "message": "An unexpected error occurred. Please try again."
        }


# =============================================================================
# HELPER ENDPOINT - Preview API Detection
# =============================================================================

@router.post("/api/generate/preview")
async def preview_api_detection(request: GenerateCodeRequest) -> Dict[str, Any]:
    """
    Preview which APIs would be used for a given use case.
    
    Useful for users to understand what APIs will be integrated
    before generating code.
    
    Returns:
        {"apis_detected": list, "use_case_sanitized": str, "status": "success"}
    """
    try:
        detected_apis = detect_relevant_apis(request.use_case)
        
        return {
            "apis_detected": detected_apis,
            "use_case_sanitized": request.use_case,
            "count": len(detected_apis),
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"Preview API detection error: {e}")
        return {
            "apis_detected": [],
            "use_case_sanitized": "",
            "count": 0,
            "status": "error",
            "message": "Failed to detect APIs"
        }

