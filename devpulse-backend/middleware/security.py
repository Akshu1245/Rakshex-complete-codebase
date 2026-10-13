"""
Security Middleware - Production-grade security hardening for DevPulse.

Provides:
- Security headers (HSTS, CSP, X-Frame-Options, etc.)
- Request ID tracking
- Input size limiting
- IP-based suspicious activity detection
- CORS hardening in production
"""
import os
import time
import uuid
import logging
from collections import defaultdict
from typing import Dict

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# Environment
ENV = os.getenv("ENV", "development")
IS_PRODUCTION = ENV == "production"

# Rate tracking for suspicious activity detection
_request_counts: Dict[str, list] = defaultdict(list)
SUSPICIOUS_THRESHOLD = 200  # requests per minute from single IP
MAX_BODY_SIZE = 1_048_576  # 1MB max request body


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""
    
    async def dispatch(self, request: Request, call_next):
        # Generate request ID for tracing
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id
        
        # Start timing
        start_time = time.time()
        
        # Check request body size
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_BODY_SIZE:
            return Response(
                content='{"status":"error","error":"Request body too large (max 1MB)"}',
                status_code=413,
                media_type="application/json",
            )
        
        # Suspicious activity check
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        _request_counts[client_ip] = [
            t for t in _request_counts[client_ip] if now - t < 60
        ]
        _request_counts[client_ip].append(now)
        
        if len(_request_counts[client_ip]) > SUSPICIOUS_THRESHOLD:
            logger.warning(f"Suspicious activity from {client_ip}: {len(_request_counts[client_ip])} req/min")
            return Response(
                content='{"status":"error","error":"Too many requests. Please slow down."}',
                status_code=429,
                media_type="application/json",
            )
        
        # Process request
        response = await call_next(request)
        
        # Calculate response time
        process_time = time.time() - start_time
        
        # =================================================================
        # SECURITY HEADERS (aligned with OWASP recommendations)
        # =================================================================
        
        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"
        
        # Prevent MIME sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # XSS protection (legacy browsers)
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # Referrer policy - don't leak URLs
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Permissions Policy - restrict browser features
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), "
            "payment=(), usb=(), magnetometer=()"
        )
        
        # Content Security Policy
        if IS_PRODUCTION:
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: https:; "
                "connect-src 'self' wss: https:; "
                "frame-ancestors 'none';"
            )
            # HSTS - force HTTPS in production (2 years)
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains; preload"
            )
        
        # Cache control for API responses
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"
        
        # Request tracking headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = f"{process_time:.3f}"
        
        # Remove server information header
        response.headers["Server"] = "DevPulse"
        
        return response


class InputSanitizationMiddleware(BaseHTTPMiddleware):
    """Sanitize and validate incoming request data."""
    
    # Dangerous patterns to check in query strings
    BLOCKED_PATTERNS = [
        "<script",
        "javascript:",
        "onerror=",
        "onclick=",
        "onload=",
        "eval(",
        "document.cookie",
        "window.location",
        "'; DROP TABLE",
        "1=1",
        "UNION SELECT",
        "../../../",
        "%00",  # Null byte
        "\x00",  # Null byte
    ]
    
    async def dispatch(self, request: Request, call_next):
        # Check query parameters for suspicious patterns
        query_string = str(request.url.query).lower()
        path = str(request.url.path).lower()
        
        for pattern in self.BLOCKED_PATTERNS:
            if pattern.lower() in query_string or pattern.lower() in path:
                logger.warning(
                    f"Blocked suspicious request: {pattern} in "
                    f"{request.url.path} from {request.client.host if request.client else 'unknown'}"
                )
                return Response(
                    content='{"status":"error","error":"Request blocked: suspicious content detected"}',
                    status_code=400,
                    media_type="application/json",
                )
        
        # Check path traversal attempts
        if ".." in request.url.path:
            return Response(
                content='{"status":"error","error":"Invalid request path"}',
                status_code=400,
                media_type="application/json",
            )
        
        return await call_next(request)
