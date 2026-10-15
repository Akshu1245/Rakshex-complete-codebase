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

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from routes.auth import require_auth
from services.team_manager import (
    create_workspace, get_workspace, get_user_workspaces,
    invite_member, change_member_role, remove_member, get_roles_info,
)

logger = logging.getLogger(__name__)
router = APIRouter()


async def workspace_access(workspace_id, user, admin=False):
    workspaces = await get_user_workspaces(user["id"])
    workspace = next((item for item in workspaces if item["id"] == workspace_id), None)
    if not workspace or (admin and workspace.get("role") not in ("owner", "admin")):
        raise HTTPException(403, "Workspace access denied")
    return workspace


class CreateWorkspaceRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class InviteMemberRequest(BaseModel):
    user_id: int = Field(..., description="User ID to invite")
    role: str = Field(default="member", pattern="^(owner|admin|member|viewer)$", description="owner, admin, member, viewer")


class ChangeRoleRequest(BaseModel):
    role: str = Field(..., pattern="^(owner|admin|member|viewer)$", description="owner, admin, member, viewer")


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
async def get_team_workspace(workspace_id: str, user: Dict = Depends(require_auth)) -> Dict[str, Any]:
    """Get workspace details with members."""
    await workspace_access(workspace_id, user)
    try:
        ws = await get_workspace(workspace_id)
        if not ws:
            return {"status": "error", "error": "Workspace not found"}
        return {"status": "success", "workspace": ws}
    except Exception as e:
        logger.error(f"Error getting workspace: {e}")
        return {"status": "error", "error": "Failed to get workspace"}


_HTTP = {"forbidden": 403, "not_found": 404, "last_owner": 409, "conflict": 409}


def _respond(result: Dict[str, Any]) -> Dict[str, Any]:
    if result["outcome"] != "ok":
        raise HTTPException(_HTTP.get(result["outcome"], 400), result["message"])
    return {"status": "success", "message": result["message"]}


# The API-level workspace_access() check only avoids leaking workspace existence. The authoritative
# decision (actor role, target role, primary owner, last owner) is re-made inside the locked
# transaction in services.database.apply_team_member_change, so it cannot go stale.

@router.post("/api/teams/workspaces/{workspace_id}/invite")
async def invite_to_workspace(workspace_id: str, req: InviteMemberRequest,
                              user: Dict = Depends(require_auth)) -> Dict[str, Any]:
    """Invite a user to a workspace."""
    await workspace_access(workspace_id, user, admin=True)
    return _respond(await invite_member(workspace_id, req.user_id, req.role, actor_id=user["id"]))


@router.put("/api/teams/workspaces/{workspace_id}/members/{user_id}/role")
async def update_member_role(workspace_id: str, user_id: int, req: ChangeRoleRequest,
                             user: Dict = Depends(require_auth)) -> Dict[str, Any]:
    """Change a member's role in a workspace."""
    await workspace_access(workspace_id, user, admin=True)
    return _respond(await change_member_role(workspace_id, user_id, req.role, actor_id=user["id"]))


@router.delete("/api/teams/workspaces/{workspace_id}/members/{user_id}")
async def delete_member(workspace_id: str, user_id: int, user: Dict = Depends(require_auth)) -> Dict[str, Any]:
    """Remove a member from a workspace."""
    await workspace_access(workspace_id, user, admin=True)
    return _respond(await remove_member(workspace_id, user_id, actor_id=user["id"]))


@router.get("/api/teams/roles")
async def list_roles() -> Dict[str, Any]:
    """Get available roles and their permissions."""
    return {"status": "success", "roles": get_roles_info()}


@router.get("/api/teams/workspaces/{workspace_id}/members")
async def workspace_members(workspace_id: str, user: Dict = Depends(require_auth)):
    await workspace_access(workspace_id, user)
    workspace = await get_workspace(workspace_id)
    members = workspace.get("members", []) if workspace else []
    return {"status": "success", "members": members, "count": len(members)}
