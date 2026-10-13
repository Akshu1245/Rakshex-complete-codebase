"""
Team Manager Service - Workspace and RBAC for team collaboration.

Supports owner/admin/member/viewer roles with permission enforcement.
All data persisted to DB.
"""
import uuid
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

ROLES = {
    "owner": ["read", "write", "admin", "delete", "invite", "billing", "settings"],
    "admin": ["read", "write", "admin", "invite", "settings"],
    "member": ["read", "write"],
    "viewer": ["read"],
}


async def create_workspace(name: str, owner_id: int) -> Dict[str, Any]:
    """Create a new workspace/team."""
    from services.database import save_team
    team_id = str(uuid.uuid4())[:12]
    await save_team(team_id, name, owner_id)
    return {"id": team_id, "name": name, "owner_id": owner_id}


async def get_workspace(workspace_id: str) -> Optional[Dict[str, Any]]:
    """Get workspace with members."""
    from services.database import get_team_db
    return await get_team_db(workspace_id)


async def get_user_workspaces(user_id: int) -> List[Dict[str, Any]]:
    """Get all workspaces a user belongs to."""
    from services.database import get_user_teams
    return await get_user_teams(user_id)


async def invite_member(workspace_id: str, user_id: int,
                        role: str = "viewer", invited_by: int = 0) -> Dict[str, Any]:
    """Invite a member to a workspace."""
    from services.database import add_team_member
    if role not in ROLES:
        return {"status": "error", "message": f"Invalid role: {role}"}
    success = await add_team_member(workspace_id, user_id, role, invited_by)
    if not success:
        return {"status": "error", "message": "User already a member or invite failed"}
    return {"status": "success", "message": f"Invited user {user_id} as {role}"}


async def change_member_role(workspace_id: str, user_id: int, new_role: str) -> Dict[str, Any]:
    """Change a member's role."""
    from services.database import update_team_member_role
    if new_role not in ROLES:
        return {"status": "error", "message": f"Invalid role: {new_role}"}
    success = await update_team_member_role(workspace_id, user_id, new_role)
    if not success:
        return {"status": "error", "message": "Member not found"}
    return {"status": "success", "message": f"Role changed to {new_role}"}


async def remove_member(workspace_id: str, user_id: int) -> Dict[str, Any]:
    """Remove a member from a workspace."""
    from services.database import remove_team_member
    success = await remove_team_member(workspace_id, user_id)
    if not success:
        return {"status": "error", "message": "Cannot remove owner or member not found"}
    return {"status": "success", "message": "Member removed"}


def check_permission(role: str, permission: str) -> bool:
    """Check if a role has a specific permission."""
    return permission in ROLES.get(role, [])


def get_roles_info() -> Dict[str, List[str]]:
    """Get all roles with their permissions."""
    return ROLES
