"""Workspace role CHECK constraint + shared rate-limit counter table (additive).

UP:
  1. Normalise team_members.role by lower(trim(role)) only (case/whitespace; no guessing).
  2. If any row still has a role outside owner/admin/member/viewer, ABORT with the row ids
     so an operator fixes them deliberately. Nothing is guessed or deleted.
  3. Add CHECK ck_team_members_role (NULL roles are allowed by SQL CHECK semantics and are
     treated as "no permissions" by the app).
  4. Create rate_limit_counters (key, window_start) PK, expires_at index.

DOWN: drop the CHECK and the counter table (counters are disposable). Role normalisation is
not reverted (original casing is not recoverable and is not meaningful).
"""
from alembic import op
import sqlalchemy as sa

revision = "005_role_check_rl"
down_revision = "004_upstream_events"
branch_labels = None
depends_on = None

ROLES = ("owner", "admin", "member", "viewer")


def upgrade():
    bind = op.get_bind()
    bind.execute(sa.text("UPDATE team_members SET role = lower(trim(role)) WHERE role IS NOT NULL AND role <> lower(trim(role))"))
    bad = bind.execute(sa.text(
        "SELECT id, role FROM team_members WHERE role IS NOT NULL AND role NOT IN ('owner','admin','member','viewer')"
    )).fetchall()
    if bad:
        raise RuntimeError(f"team_members has roles outside {ROLES}: {[(r[0], r[1]) for r in bad][:50]}. "
                           "Fix them explicitly, then re-run the migration.")
    with op.batch_alter_table("team_members") as b:
        b.create_check_constraint("ck_team_members_role", "role IN ('owner','admin','member','viewer')")
    if not sa.inspect(bind).has_table("rate_limit_counters"):
        op.create_table(
            "rate_limit_counters",
            sa.Column("key", sa.String(200), primary_key=True),
            sa.Column("window_start", sa.BigInteger, primary_key=True),
            sa.Column("count", sa.Integer, nullable=False, server_default="0"),
            sa.Column("expires_at", sa.BigInteger, nullable=False),
        )
        op.create_index("ix_rate_limit_counters_expires_at", "rate_limit_counters", ["expires_at"])


def downgrade():
    op.drop_table("rate_limit_counters")
    with op.batch_alter_table("team_members") as b:
        b.drop_constraint("ck_team_members_role", type_="check")
