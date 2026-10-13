"""
Teams & RBAC Routes - Workspace and role-based access control.

Endpoints:
- POST /api/teams/workspaces           - Create workspace
- GET  /api/teams/workspaces           - List user's workspaces
- GET  /api/teams/workspaces/{id}      - Get workspace details
- POST /api/teams/workspaces/{id}/invite  - Invite a member
- PUT  /api/teams/workspaces/{id}/members/{uid}/role - Change member role
- DELETE /api/teams/workspaces/{id}/members/{uid}    - Remove member
- GET  /api/teams/roles                - Get available roles and permissions
"""
import logging
from typing import Dict, Any, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from routes.auth import require_auth
from services.team_manager import (
    create_workspace, get_workspace, get_user_workspaces,
    invite_member, change_member_role, remove_member, get_roles_info,
)

logger = logging.getLogger(__name__)
router = APIRouter()


class CreateWorkspaceRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class InviteMemberRequest(BaseModel):
    user_id: int = Field(..., description="User ID to invite")
    role: str = Field(default="member", description="owner, admin, member, viewer")


class ChangeRoleRequest(BaseModel):
    role: str = Field(..., description="owner, admin, member, viewer")


@router.post("/api/teams/workspaces")
async def create_team_workspace(
    req: CreateWorkspaceRequest,
    user: Dict = Depends(require_auth),
) -> Dict[str, Any]:
    """Create a new team workspace."""
    try:
        result = await create_workspace(name=req.name, owner_id=user["id"])
        return {"status": "success", **result}
    except Exception as e:
        logger.error(f"Error creating workspace: {e}")
        return {"status": "error", "error": "Failed to create workspace"}


@router.get("/api/teams/workspaces")
async def list_workspaces(user: Dict = Depends(require_auth)) -> Dict[str, Any]:
    """List workspaces the current user belongs to."""
    try:
        workspaces = await get_user_workspaces(user["id"])
        return {"status": "success", "workspaces": workspaces, "count": len(workspaces)}
    except Exception as e:
        logger.error(f"Error listing workspaces: {e}")
        return {"status": "error", "error": "Failed to list workspaces"}


@router.get("/api/teams/workspaces/{workspace_id}")
async def get_team_workspace(workspace_id: str) -> Dict[str, Any]:
    """Get workspace details with members."""
    try:
        ws = await get_workspace(workspace_id)
        if not ws:
            return {"status": "error", "error": "Workspace not found"}
        return {"status": "success", "workspace": ws}
    except Exception as e:
        logger.error(f"Error getting workspace: {e}")
        return {"status": "error", "error": "Failed to get workspace"}


@router.post("/api/teams/workspaces/{workspace_id}/invite")
async def invite_to_workspace(
    workspace_id: str,
    req: InviteMemberRequest,
    user: Dict = Depends(require_auth),
) -> Dict[str, Any]:
    """Invite a user to a workspace."""
    try:
        result = await invite_member(
            workspace_id=workspace_id, user_id=req.user_id,
            role=req.role, invited_by=user["id"],
        )
        return {"status": "success", **result}
    except Exception as e:
        logger.error(f"Error inviting member: {e}")
        return {"status": "error", "error": "Failed to invite member"}


@router.put("/api/teams/workspaces/{workspace_id}/members/{user_id}/role")
async def update_member_role(
    workspace_id: str,
    user_id: int,
    req: ChangeRoleRequest,
) -> Dict[str, Any]:
    """Change a member's role in a workspace."""
    try:
        result = await change_member_role(workspace_id, user_id, req.role)
        return {"status": "success", **result}
    except Exception as e:
        logger.error(f"Error changing member role: {e}")
        return {"status": "error", "error": "Failed to change role"}


@router.delete("/api/teams/workspaces/{workspace_id}/members/{user_id}")
async def delete_member(workspace_id: str, user_id: int) -> Dict[str, Any]:
    """Remove a member from a workspace."""
    try:
        result = await remove_member(workspace_id, user_id)
        return {"status": "success", **result}
    except Exception as e:
        logger.error(f"Error removing member: {e}")
        return {"status": "error", "error": "Failed to remove member"}


@router.get("/api/teams/roles")
async def list_roles() -> Dict[str, Any]:
    """Get available roles and their permissions."""
    return {"status": "success", "roles": get_roles_info()}
