"""
Pydantic models for request/response validation.
"""
from pydantic import BaseModel, Field, field_validator
from typing import List


class CompatibilityRequest(BaseModel):
    """Request model for /api/compatibility endpoint."""
    api1: str = Field(..., min_length=1, max_length=500)
    api2: str = Field(..., min_length=1, max_length=500)

    @field_validator('api1', 'api2')
    @classmethod
    def validate_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Field cannot be empty")
        return v


class GenerateRequest(BaseModel):
    """Request model for /api/generate endpoint."""
    use_case: str = Field(..., min_length=1, max_length=500)

    @field_validator('use_case')
    @classmethod
    def validate_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("use_case cannot be empty")
        return v


class DocsRequest(BaseModel):
    """Request model for /api/docs endpoint."""
    question: str = Field(..., min_length=1, max_length=500)

    @field_validator('question')
    @classmethod
    def validate_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("question cannot be empty")
        return v
