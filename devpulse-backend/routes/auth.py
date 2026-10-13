"""
Auth Routes - JWT-based authentication for DevPulse.

Endpoints:
- POST /api/auth/register - Create account
- POST /api/auth/login - Get JWT token
- GET  /api/auth/me - Get current user info
"""
import os
import re
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional

import jwt
import bcrypt
from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, field_validator

from services.database import create_user, get_user_by_email, get_user_by_id

logger = logging.getLogger(__name__)

router = APIRouter()

# JWT configuration
JWT_SECRET = os.getenv("JWT_SECRET", "devpulse-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", "24"))

security = HTTPBearer(auto_error=False)

# Plan limits (API calls per day)
PLAN_LIMITS = {
    "free": 50,
    "pro": 500,
    "enterprise": 10000,
}


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=100)
    username: str = Field(..., min_length=3, max_length=30)
    password: str = Field(..., min_length=8, max_length=100)
    
    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', v):
            raise ValueError("Invalid email format")
        return v
    
    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        v = v.strip()
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError("Username can only contain letters, numbers, underscores, and hyphens")
        return v


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=100)
    password: str = Field(..., min_length=1, max_length=100)
    
    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return v.strip().lower()


# =============================================================================
# JWT HELPERS
# =============================================================================

def create_token(user_id: int, email: str) -> str:
    """Create a JWT token for a user."""
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify and decode a JWT token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Optional[Dict[str, Any]]:
    """
    Dependency to get current authenticated user.
    Returns None if not authenticated (allows optional auth).
    """
    if not credentials:
        return None
    
    payload = verify_token(credentials.credentials)
    if not payload:
        return None
    
    user = await get_user_by_id(int(payload["sub"]))
    return user


async def require_auth(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """
    Dependency that requires authentication.
    Raises 401 if not authenticated.
    """
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    payload = verify_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user = await get_user_by_id(int(payload["sub"]))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.post("/api/auth/register")
async def register(req: RegisterRequest) -> Dict[str, Any]:
    """Register a new user account."""
    try:
        # Hash password
        password_hash = bcrypt.hashpw(
            req.password.encode("utf-8"),
            bcrypt.gensalt()
        ).decode("utf-8")
        
        user_id = await create_user(req.email, req.username, password_hash)
        
        if user_id is None:
            return {
                "status": "error",
                "message": "Email or username already exists"
            }
        
        # Create token
        token = create_token(user_id, req.email)
        
        return {
            "status": "success",
            "token": token,
            "user": {
                "id": user_id,
                "email": req.email,
                "username": req.username,
                "plan": "free",
            }
        }
    except Exception as e:
        logger.error(f"Registration error: {e}")
        return {
            "status": "error",
            "message": "Failed to create account"
        }


@router.post("/api/auth/login")
async def login(req: LoginRequest) -> Dict[str, Any]:
    """Login and get a JWT token."""
    try:
        user = await get_user_by_email(req.email)
        
        if not user:
            return {
                "status": "error",
                "message": "Invalid email or password"
            }
        
        # Verify password
        if not bcrypt.checkpw(
            req.password.encode("utf-8"),
            user["password_hash"].encode("utf-8")
        ):
            return {
                "status": "error",
                "message": "Invalid email or password"
            }
        
        # Create token
        token = create_token(user["id"], user["email"])
        
        return {
            "status": "success",
            "token": token,
            "user": {
                "id": user["id"],
                "email": user["email"],
                "username": user["username"],
                "plan": user["plan"],
            }
        }
    except Exception as e:
        logger.error(f"Login error: {e}")
        return {
            "status": "error",
            "message": "Login failed"
        }


@router.get("/api/auth/me")
async def get_me(user: Dict = Depends(require_auth)) -> Dict[str, Any]:
    """Get current authenticated user info."""
    plan = user.get("plan", "free")
    return {
        "status": "success",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "username": user["username"],
            "plan": plan,
            "api_calls_today": user.get("api_calls_today", 0),
            "api_limit": PLAN_LIMITS.get(plan, 50),
        }
    }
