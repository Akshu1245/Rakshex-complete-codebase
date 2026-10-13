"""
DevPulse Backend - Production-grade FastAPI Application

Endpoints:
1. GET /health - Health check
2. GET /api/dashboard - Health data placeholder
3. GET /api/api-details - List of 15 API objects
4. POST /api/compatibility - API compatibility check
5. POST /api/generate - Code generation
6. POST /api/docs - Documentation search
"""
from contextlib import asynccontextmanager
from typing import List, Dict, Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.models import (
    CompatibilityRequest,
    GenerateRequest,
    DocsRequest,
)


# Placeholder API data (15 APIs)
PLACEHOLDER_APIS: List[Dict[str, Any]] = [
    {"name": "GitHub API", "category": "development", "status": "healthy", "latency_ms": 45},
    {"name": "OpenWeatherMap", "category": "weather", "status": "healthy", "latency_ms": 120},
    {"name": "Stripe API", "category": "payment", "status": "healthy", "latency_ms": 89},
    {"name": "Twilio API", "category": "communication", "status": "degraded", "latency_ms": 230},
    {"name": "SendGrid API", "category": "email", "status": "healthy", "latency_ms": 67},
    {"name": "AWS S3", "category": "storage", "status": "healthy", "latency_ms": 34},
    {"name": "MongoDB Atlas", "category": "database", "status": "healthy", "latency_ms": 28},
    {"name": "Auth0", "category": "authentication", "status": "healthy", "latency_ms": 55},
    {"name": "Slack API", "category": "communication", "status": "healthy", "latency_ms": 78},
    {"name": "Google Maps", "category": "maps", "status": "healthy", "latency_ms": 92},
    {"name": "Cloudinary", "category": "media", "status": "healthy", "latency_ms": 145},
    {"name": "Algolia", "category": "search", "status": "healthy", "latency_ms": 23},
    {"name": "Redis Cloud", "category": "cache", "status": "healthy", "latency_ms": 12},
    {"name": "PagerDuty", "category": "monitoring", "status": "down", "latency_ms": 0},
    {"name": "Datadog", "category": "analytics", "status": "healthy", "latency_ms": 88},
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    print("=" * 50)
    print("DevPulse Backend Server is running!")
    print("API Documentation: http://localhost:8000/docs")
    print("=" * 50)
    yield
    print("DevPulse Backend Server shutting down...")


# Create FastAPI app
app = FastAPI(
    title="DevPulse API",
    description="Backend API for DevPulse - Developer Tool Platform",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware - allow all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Exception Handlers - Consistent error responses
# =============================================================================

@app.exception_handler(ValidationError)
async def validation_exception_handler(request: Request, exc: ValidationError):
    """Handle Pydantic validation errors."""
    return JSONResponse(
        status_code=422,
        content={"error": "Validation error: " + str(exc), "status": "error"}
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Catch-all exception handler."""
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "status": "error"}
    )


# =============================================================================
# Endpoint 1: GET /health
# =============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    try:
        return {"status": "ok"}
    except Exception as e:
        return {"error": str(e), "status": "error"}


# =============================================================================
# Endpoint 2: GET /api/dashboard
# =============================================================================

@app.get("/api/dashboard")
async def get_dashboard():
    """Returns placeholder for health data."""
    try:
        return {}
    except Exception as e:
        return {"error": str(e), "status": "error"}


# =============================================================================
# Endpoint 3: GET /api/api-details
# =============================================================================

@app.get("/api/api-details")
async def get_api_details():
    """Returns list of 15 placeholder API objects."""
    try:
        return PLACEHOLDER_APIS
    except Exception as e:
        return {"error": str(e), "status": "error"}


# =============================================================================
# Endpoint 4: POST /api/compatibility
# =============================================================================

@app.post("/api/compatibility")
async def check_compatibility(request: CompatibilityRequest):
    """Check compatibility between two APIs."""
    try:
        return {
            "score": 0,
            "path": [],
            "reason": ""
        }
    except Exception as e:
        return {"error": str(e), "status": "error"}


# =============================================================================
# Endpoint 5: POST /api/generate
# =============================================================================

@app.post("/api/generate")
async def generate_code(request: GenerateRequest):
    """Generate code for a use case."""
    try:
        return {
            "code": "",
            "apis_used": [],
            "status": "success"
        }
    except Exception as e:
        return {"error": str(e), "status": "error"}


# =============================================================================
# Endpoint 6: POST /api/docs
# =============================================================================

@app.post("/api/docs")
async def search_docs(request: DocsRequest):
    """Search documentation and answer questions."""
    try:
        return {
            "summary": "",
            "sources": [],
            "status": "success"
        }
    except Exception as e:
        return {"error": str(e), "status": "error"}


# =============================================================================
# Root endpoint
# =============================================================================

@app.get("/")
async def root():
    """Root endpoint with API info."""
    try:
        return {
            "name": "DevPulse API",
            "version": "1.0.0",
            "status": "ok"
        }
    except Exception as e:
        return {"error": str(e), "status": "error"}


# =============================================================================
# Run with: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
# =============================================================================
