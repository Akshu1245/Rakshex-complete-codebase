"""
DevPulse Backend v4.0 — The API Security & Cost Intelligence Platform

Three pillars:
 1. AI API Security Scanner (token leaks, agent attacks, OWASP)
 2. API Cost Intelligence (tracking, forecasting, optimization)
 3. Developer-first UX (VS Code extension, kill-switch, budgets)

Stack: FastAPI · PostgreSQL (asyncpg/SQLAlchemy) · Redis · Groq LLM
"""
import os
import sys
import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

# Import routes — Core
from routes.dashboard import router as dashboard_router
from routes.compatibility import router as compatibility_router
from routes.generate import router as generate_router
from routes.docs import router as docs_router
from routes.websocket import router as websocket_router
from routes.auth import router as auth_router
from routes.history import router as history_router
from routes.budget import router as budget_router
from routes.changes import router as changes_router
from routes.security import router as security_router
from routes.mock import router as mock_router
from routes.incidents import router as incidents_router
from routes.cicd import router as cicd_router
from routes.analytics import router as analytics_router
from routes.alerts import router as alerts_router
from routes.teams import router as teams_router
from routes.marketplace_routes import router as marketplace_router
from routes.billing import router as billing_router
from routes.custom_apis import router as custom_apis_router
from routes.reports import router as reports_router
from routes.onboarding import router as onboarding_router

# Import routes — v4.0 Pillars
from routes.ai_security import router as ai_security_router
from routes.cost_intelligence import router as cost_intelligence_router

from middleware.security import SecurityHeadersMiddleware, InputSanitizationMiddleware
from middleware.rate_limit import RateLimitMiddleware

# Import services
from services.health_monitor import start_monitor, stop_monitor
from services.database import init_db, close_db
from services.cache import close_cache
from services.change_detector import start_detector, stop_detector
from services.posthog_analytics import init_analytics

# Rate limiter instance
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])


# =============================================================================
# STARTUP VALIDATION
# =============================================================================

def validate_environment() -> None:
    """
    Validate required environment variables on startup.
    Raises RuntimeError with clear message if missing.
    """
    groq_key = os.getenv("GROQ_API_KEY", "")
    
    if not groq_key or groq_key == "your_groq_key_here" or len(groq_key) < 10:
        logger.warning(
            "GROQ_API_KEY is not configured. AI endpoints (/api/generate, /api/docs) may return fallback responses, "
            "but health and compatibility endpoints will remain available."
        )


def print_startup_banner(port: str) -> None:
    """Print the startup banner with all endpoints."""
    banner = f"""
╔═══════════════════════════════════════════════════════╗
║  ⚡ DEVPULSE v4.0 — API Security & Cost Intelligence  ║
║  The platform built for the AI Agent Era              ║
║  Running on port {port:<5}                               ║
╠═══════════════════════════════════════════════════════╣
║  Pillar 1: AI Security Scanner                        ║
║   POST /api/v1/security/scan/full   Full Scan         ║
║   POST /api/v1/security/scan/tokens Token Leaks       ║
║   POST /api/v1/security/scan/agents Agent Attacks     ║
║   GET  /api/v1/security/threat-feed Threat Intel      ║
║  Pillar 2: Cost Intelligence                          ║
║   GET  /api/v1/costs/dashboard      Cost Dashboard    ║
║   GET  /api/v1/costs/forecast       30-Day Forecast   ║
║   GET  /api/v1/costs/optimization   Savings Tips      ║
║   POST /api/v1/costs/roi            ROI Calculator    ║
║  Core: Auth · Budget · Generate · CI/CD · Billing     ║
╚═══════════════════════════════════════════════════════╝
"""
    print(banner)


# =============================================================================
# LIFESPAN CONTEXT MANAGER (replaces deprecated @app.on_event)
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — startup / shutdown."""
    # STARTUP
    validate_environment()
    port = os.getenv("PORT", "8000")

    # Database (PostgreSQL via SQLAlchemy / SQLite fallback)
    try:
        await init_db()
        logger.info("Database initialized")
    except Exception as e:
        logger.error(f"Database init failed: {type(e).__name__}: {e}")

    print_startup_banner(port)

    try:
        init_analytics()
    except Exception:
        pass

    try:
        await start_monitor()
    except Exception:
        pass

    try:
        await start_detector()
    except Exception:
        pass

    yield  # ── app running ──

    # SHUTDOWN
    print("\nDevPulse v4.0 shutting down...")
    for fn, name in [
        (stop_detector, "change detector"),
        (stop_monitor, "health monitor"),
        (close_db, "database"),
        (close_cache, "Redis cache"),
    ]:
        try:
            await fn()
            logger.info(f"{name} stopped")
        except Exception as e:
            logger.error(f"Error stopping {name}: {type(e).__name__}")
    print("Shutdown complete")


# Create FastAPI application with lifespan
app = FastAPI(
    title="DevPulse API",
    description="AI API Security & Cost Intelligence Platform",
    version="4.0.0",
    lifespan=lifespan,
)

# Attach rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# Security middleware
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(InputSanitizationMiddleware)

# Rate limiting middleware (per-user sliding window)
app.add_middleware(RateLimitMiddleware)

# Build the list of allowed origins
allowed_origins = [
    "http://localhost:3000",
    "http://localhost:5000",
    os.getenv("FRONTEND_URL", "http://localhost:5000"),
]

# Add Vercel deployment URLs (auto-set by Vercel)
vercel_url = os.getenv("VERCEL_URL")
vercel_prod_url = os.getenv("VERCEL_PROJECT_PRODUCTION_URL")
if vercel_url:
    allowed_origins.append(f"https://{vercel_url}")
if vercel_prod_url:
    allowed_origins.append(f"https://{vercel_prod_url}")

# Add Replit domain when running on Replit
replit_domains = os.getenv("REPLIT_DOMAINS", "")
for domain in replit_domains.split(","):
    domain = domain.strip()
    if domain:
        allowed_origins.append(f"https://{domain}")
        allowed_origins.append(f"http://{domain}")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if os.getenv("ENV") == "production" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handlers - return proper HTTP status codes
# Note: Error messages are sanitized to not expose internal details

@app.exception_handler(ValidationError)
async def validation_exception_handler(request: Request, exc: ValidationError):
    """Handle Pydantic validation errors - return 422."""
    logger.warning(f"Validation error on {request.url.path}")
    try:
        errors = exc.errors()
        if errors:
            first_error = errors[0]
            field = first_error.get("loc", ["input"])[-1]
            msg = first_error.get("msg", "Invalid input")
            error_msg = f"Validation failed for '{field}': {msg}"
        else:
            error_msg = "Validation failed"
    except Exception:
        error_msg = "Validation failed"
    
    return JSONResponse(
        status_code=422,
        content={
            "status": "error",
            "error": error_msg
        }
    )


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    """Handle ValueError exceptions - return 400."""
    logger.warning(f"Value error on {request.url.path}")
    msg = str(exc)
    if len(msg) > 100 or "/" in msg or "\\" in msg:
        msg = "Invalid value provided"
    return JSONResponse(
        status_code=400,
        content={
            "status": "error",
            "error": f"Invalid value: {msg}"
        }
    )


@app.exception_handler(KeyError)
async def key_error_handler(request: Request, exc: KeyError):
    """Handle KeyError exceptions - return 400."""
    logger.warning(f"Key error on {request.url.path}")
    return JSONResponse(
        status_code=400,
        content={
            "status": "error",
            "error": "Required data is missing"
        }
    )


@app.exception_handler(TypeError)
async def type_error_handler(request: Request, exc: TypeError):
    """Handle TypeError exceptions - return 400."""
    logger.warning(f"Type error on {request.url.path}")
    return JSONResponse(
        status_code=400,
        content={
            "status": "error",
            "error": "Invalid data type provided"
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Catch-all exception handler - return 500."""
    logger.error(f"Unhandled exception on {request.url.path}: {type(exc).__name__}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "error": "An unexpected error occurred. Please try again."
        }
    )


# Register routers - Core
app.include_router(auth_router, tags=["Auth"])
app.include_router(history_router, tags=["History"])
app.include_router(dashboard_router, tags=["Dashboard"])
app.include_router(compatibility_router, tags=["Compatibility"])
app.include_router(generate_router, tags=["Generate"])
app.include_router(docs_router, tags=["Documentation"])
app.include_router(websocket_router, tags=["WebSocket"])
app.include_router(budget_router, tags=["Budget"])
# Register routers - Phase 1 (MVP Polish)
app.include_router(changes_router, tags=["Changes"])
app.include_router(security_router, tags=["Security"])
app.include_router(mock_router, tags=["Mock"])
app.include_router(incidents_router, tags=["Incidents"])
# Register routers - Phase 2 (Differentiation)
app.include_router(cicd_router, tags=["CI/CD"])
app.include_router(analytics_router, tags=["Analytics"])
app.include_router(alerts_router, tags=["Alerts"])
# Register routers - Phase 3 (Scale)
app.include_router(teams_router, tags=["Teams"])
app.include_router(marketplace_router, tags=["Marketplace"])
app.include_router(billing_router, tags=["Billing"])
app.include_router(custom_apis_router, tags=["Custom APIs"])
app.include_router(reports_router, tags=["Reports"])
app.include_router(onboarding_router, tags=["Onboarding"])
# Register routers — v4.0 Pillars
app.include_router(ai_security_router, tags=["AI Security"])
app.include_router(cost_intelligence_router, tags=["Cost Intelligence"])


# Root endpoint
@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with API information."""
    return {
        "name": "DevPulse API",
        "version": "4.0.0",
        "tagline": "API Security & Cost Intelligence for the AI Agent Era",
        "status": "ok",
        "pillars": {
            "ai_security": "/api/v1/security/scan/full",
            "cost_intelligence": "/api/v1/costs/dashboard",
            "threat_feed": "/api/v1/security/threat-feed",
        },
        "core": {
            "health": "/health",
            "dashboard": "/api/dashboard",
            "auth": "/api/auth/login",
            "billing": "/api/billing/plans",
        },
    }


# Entry point for running with python main.py
if __name__ == "__main__":
    import uvicorn
    
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    env = os.getenv("ENV", "development")
    log_level = os.getenv("LOG_LEVEL", "info").lower()
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=(env == "development"),
        log_level=log_level
    )
