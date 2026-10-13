"""
Pydantic models for DevPulse API request/response validation.
All models use Pydantic v2 syntax with field validators.
"""
import re
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class HealthResponse(BaseModel):
    """Response model for health check endpoint."""
    status: str
    timestamp: str


class APIDetail(BaseModel):
    """Model representing a single API's health details."""
    name: str
    category: str
    status: str
    latency_ms: int
    last_checked: str
    is_rate_limited: bool
    is_timeout: bool


class CompatibilityRequest(BaseModel):
    """Request model for API compatibility check."""
    api1: str = Field(..., min_length=1, max_length=100)
    api2: str = Field(..., min_length=1, max_length=100)

    @field_validator("api1", "api2")
    @classmethod
    def validate_not_whitespace(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Field cannot be empty or whitespace only")
        return stripped


class CompatibilityResponse(BaseModel):
    """Response model for API compatibility check."""
    score: int
    path: List[str]
    reason: str
    status: str


class GenerateRequest(BaseModel):
    """
    Request model for code generation.
    Implements sanitization: strips whitespace, removes HTML tags and dangerous characters.
    """
    use_case: str = Field(..., min_length=1, max_length=500)

    @field_validator("use_case")
    @classmethod
    def validate_and_sanitize(cls, v: str) -> str:
        """
        Validate and sanitize use_case input.
        
        Steps:
        1. Strip leading/trailing whitespace
        2. Remove HTML tags using regex
        3. Remove dangerous characters: semicolons, backticks, angle brackets
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
        
        return sanitized


class GenerateResponse(BaseModel):
    """Response model for code generation."""
    code: str
    apis_used: List[str]
    tokens_used: Optional[int] = 0
    status: str
    message: Optional[str] = None


class DocsRequest(BaseModel):
    """Request model for documentation search."""
    question: str = Field(..., min_length=1, max_length=300)

    @field_validator("question")
    @classmethod
    def validate_and_sanitize(cls, v: str) -> str:
        """Validate and sanitize question input."""
        if not v:
            raise ValueError("question cannot be empty")
        
        # Strip whitespace
        sanitized = v.strip()
        
        # Remove HTML tags
        sanitized = re.sub(r'<[^>]+>', '', sanitized)
        
        # Remove dangerous characters
        sanitized = re.sub(r'[;`<>]', '', sanitized)
        
        # Final strip
        sanitized = sanitized.strip()
        
        if not sanitized:
            raise ValueError("question is empty after removing invalid characters")
        
        return sanitized


class DocsResponse(BaseModel):
    """Response model for documentation search."""
    summary: str
    sources: List[str]
    status: str


class ErrorResponse(BaseModel):
    """Standard error response model."""
    status: str = "error"
    error: str
