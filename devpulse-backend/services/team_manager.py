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


async def invite_member(workspace_id: str, user_id: int, role: str = "viewer", *,
                        actor_id: int) -> Dict[str, Any]:
    """Invite a member. Authorization is enforced centrally (see apply_team_member_change)."""
    from services.database import apply_team_member_change
    outcome, message = await apply_team_member_change(workspace_id, actor_id, user_id, "add", role, invited_by=actor_id)
    return {"outcome": outcome, "message": f"Invited user {user_id} as {role}" if outcome == "ok" else message}


async def change_member_role(workspace_id: str, user_id: int, new_role: str, *, actor_id: int) -> Dict[str, Any]:
    """Change a member's role. Authorization is enforced centrally."""
    from services.database import apply_team_member_change
    outcome, message = await apply_team_member_change(workspace_id, actor_id, user_id, "set_role", new_role)
    return {"outcome": outcome, "message": f"Role changed to {new_role}" if outcome == "ok" else message}


async def remove_member(workspace_id: str, user_id: int, *, actor_id: int) -> Dict[str, Any]:
    """Remove a member. Authorization is enforced centrally."""
    from services.database import apply_team_member_change
    outcome, message = await apply_team_member_change(workspace_id, actor_id, user_id, "remove")
    return {"outcome": outcome, "message": "Member removed" if outcome == "ok" else message}


def check_permission(role: str, permission: str) -> bool:
    """Check if a role has a specific permission."""
    return permission in ROLES.get(role, [])


def get_roles_info() -> Dict[str, List[str]]:
    """Get all roles with their permissions."""
    return ROLES
