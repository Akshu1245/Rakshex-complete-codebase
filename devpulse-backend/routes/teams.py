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


@router.post("/api/teams/workspaces/{workspace_id}/invite")
async def invite_to_workspace(
    workspace_id: str,
    req: InviteMemberRequest,
    user: Dict = Depends(require_auth),
) -> Dict[str, Any]:
    """Invite a user to a workspace."""
    await workspace_access(workspace_id, user, admin=True)
    if req.role == "owner":
        raise HTTPException(400, "Ownership cannot be assigned by invitation")
    try:
        result = await invite_member(
            workspace_id=workspace_id, user_id=req.user_id,
            role=req.role, invited_by=user["id"],
        )
        return {"status": "success", **result}
    except Exception as e:
        logger.error(f"Error inviting member: {e}")
        return {"status": "error", "error": "Failed to invite member"}


async def _target_member(workspace_id: str, user_id: int) -> Dict[str, Any]:
    workspace = await get_workspace(workspace_id)
    member = next((m for m in (workspace or {}).get("members", []) if int(m["user_id"]) == int(user_id)), None)
    if not workspace or not member:
        raise HTTPException(404, "Member not found")
    return {"workspace": workspace, "member": member}


def _authorize_member_change(actor_role: str, actor_id: int, target_role: str, target_id: int,
                             primary_owner_id: int, new_role: Optional[str]) -> None:
    """Role-management rules (raise 403 on violation):
    - nobody can grant "owner" here (no ownership-transfer flow);
    - the primary owner (teams.owner_id) can never be removed or demoted;
    - only owners can change or remove owners and admins, or grant "admin";
    - admins can change/remove members and viewers only.
    The last-owner rule is enforced atomically in the DB layer."""
    if new_role == "owner":
        raise HTTPException(403, "Ownership cannot be granted here")
    if int(target_id) == int(primary_owner_id):
        raise HTTPException(403, "The workspace owner cannot be removed or demoted")
    if actor_role != "owner" and (target_role in ("owner", "admin") or new_role == "admin"):
        raise HTTPException(403, "Only an owner can change owners or admins")


@router.put("/api/teams/workspaces/{workspace_id}/members/{user_id}/role")
async def update_member_role(
    workspace_id: str,
    user_id: int,
    req: ChangeRoleRequest,
    user: Dict = Depends(require_auth),
) -> Dict[str, Any]:
    """Change a member's role in a workspace."""
    from services.database import update_team_member_role_guarded
    access = await workspace_access(workspace_id, user, admin=True)
    t = await _target_member(workspace_id, user_id)
    _authorize_member_change(access["role"], user["id"], t["member"]["role"], user_id, t["workspace"]["owner_id"], req.role)
    try:
        outcome = await update_team_member_role_guarded(workspace_id, user_id, req.role)
    except Exception as e:
        logger.error(f"Error changing member role: {e}")
        raise HTTPException(500, "Failed to change role")
    if outcome == "not_found":
        raise HTTPException(404, "Member not found")
    if outcome == "last_owner":
        raise HTTPException(409, "A workspace must keep at least one owner")
    return {"status": "success", "message": f"Role changed to {req.role}"}


@router.delete("/api/teams/workspaces/{workspace_id}/members/{user_id}")
async def delete_member(workspace_id: str, user_id: int, user: Dict = Depends(require_auth)) -> Dict[str, Any]:
    """Remove a member from a workspace."""
    from services.database import remove_team_member_guarded
    access = await workspace_access(workspace_id, user, admin=True)
    t = await _target_member(workspace_id, user_id)
    _authorize_member_change(access["role"], user["id"], t["member"]["role"], user_id, t["workspace"]["owner_id"], None)
    try:
        outcome = await remove_team_member_guarded(workspace_id, user_id)
    except Exception as e:
        logger.error(f"Error removing member: {e}")
        raise HTTPException(500, "Failed to remove member")
    if outcome == "not_found":
        raise HTTPException(404, "Member not found")
    if outcome == "last_owner":
        raise HTTPException(409, "A workspace must keep at least one owner")
    return {"status": "success", "message": "Member removed"}


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
