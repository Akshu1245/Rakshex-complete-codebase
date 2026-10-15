"""Scope change alerts to workspaces + audit trail (additive, non-destructive).

UP (safe, online):
  - change_alerts: add NULLABLE workspace_id (FK teams.id ON DELETE SET NULL, indexed),
    acknowledged_by, acknowledged_at, resolved_by, resolved_at (all nullable).
  - create change_alert_audit.
  Existing rows keep workspace_id = NULL and are therefore INACCESSIBLE via the API
  until an operator assigns a verified workspace, e.g.:
      UPDATE change_alerts SET workspace_id = '<verified team id>' WHERE id IN (...);
  No data is deleted or rewritten.

DOWN:
  - drops change_alert_audit and the five added columns. This discards audit rows and
    workspace assignments written after UP. Export them first if needed:
      COPY change_alert_audit TO '/tmp/change_alert_audit.csv' CSV HEADER;

NOTE: production startup uses Base.metadata.create_all(), which creates NEW tables
(change_alert_audit) but does NOT add columns to the existing change_alerts table.
Run `alembic upgrade 003_change_alert_scoping` BEFORE deploying the code, or the alert
queries will fail with 500 (missing column).
"""
from alembic import op
import sqlalchemy as sa

revision = "003_change_alert_scoping"
down_revision = "002_onboarding_progress"
branch_labels = None
depends_on = None


def _has_table(name):
    # Production startup runs create_all(), which may already have created NEW tables
    # (empty) before this migration runs. Skip creating them instead of failing.
    return sa.inspect(op.get_bind()).has_table(name)


def upgrade():
    with op.batch_alter_table("change_alerts") as b:
        b.add_column(sa.Column("workspace_id", sa.String(64), nullable=True))
        b.add_column(sa.Column("acknowledged_by", sa.BigInteger, nullable=True))
        b.add_column(sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True))
        b.add_column(sa.Column("resolved_by", sa.BigInteger, nullable=True))
        b.add_column(sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True))
        b.create_foreign_key("fk_change_alerts_workspace", "teams", ["workspace_id"], ["id"], ondelete="SET NULL")
        b.create_index("ix_change_alerts_workspace_id", ["workspace_id"])
    if not _has_table("change_alert_audit"):
      op.create_table(
        "change_alert_audit",
        sa.Column("id", sa.BigInteger().with_variant(sa.Integer, "sqlite"), primary_key=True, autoincrement=True),
        sa.Column("alert_id", sa.BigInteger, nullable=False, index=True),
        sa.Column("workspace_id", sa.String(64), nullable=False, index=True),
        sa.Column("actor_user_id", sa.BigInteger, nullable=False),
        sa.Column("action", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade():
    op.drop_table("change_alert_audit")
    with op.batch_alter_table("change_alerts") as b:
        b.drop_index("ix_change_alerts_workspace_id")
        b.drop_constraint("fk_change_alerts_workspace", type_="foreignkey")
        for c in ("resolved_at", "resolved_by", "acknowledged_at", "acknowledged_by", "workspace_id"):
            b.drop_column(c)
