"""Shared upstream change events, workspace API subscriptions, fan-out dedupe (additive).

UP:
  - create upstream_change_events (provider-level, shared; never served by alert APIs)
  - create workspace_api_subscriptions (UNIQUE workspace_id, api_name)
  - change_alerts: add NULLABLE event_id (FK upstream_change_events ON DELETE SET NULL, indexed)
    + UNIQUE (event_id, workspace_id) so fan-out can't duplicate. NULLs are distinct in
    both PostgreSQL and SQLite, so existing rows (event_id NULL) never conflict.
  No existing row is modified. Legacy alerts keep workspace_id NULL (quarantined).
  Optional, separate step (NOT run by this migration): services.database.backfill_legacy_alerts_to_events_db()
  copies quarantined legacy alerts into upstream events WITHOUT assigning any workspace.

DOWN:
  - drops the unique constraint, index, FK and event_id column, then both new tables.
    Discards subscriptions and upstream events created after UP. Export first if needed.
"""
from alembic import op
import sqlalchemy as sa

revision = "004_upstream_events"
down_revision = "003_change_alert_scoping"
branch_labels = None
depends_on = None

BIGPK = sa.BigInteger().with_variant(sa.Integer, "sqlite")


def upgrade():
    op.create_table(
        "upstream_change_events",
        sa.Column("id", BIGPK, primary_key=True, autoincrement=True),
        sa.Column("api_name", sa.String(255), nullable=False, index=True),
        sa.Column("severity", sa.String(20), nullable=False, server_default="warning"),
        sa.Column("change_type", sa.String(50), nullable=False, server_default="schema_change"),
        sa.Column("summary", sa.Text),
        sa.Column("diff_json", sa.Text),
        sa.Column("old_hash", sa.String(128)),
        sa.Column("new_hash", sa.String(128)),
        sa.Column("source", sa.String(30), nullable=False, server_default="detector"),
        sa.Column("legacy_alert_id", sa.BigInteger, nullable=True, unique=True),
        sa.Column("detected_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "workspace_api_subscriptions",
        sa.Column("id", BIGPK, primary_key=True, autoincrement=True),
        sa.Column("workspace_id", sa.String(64), sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("api_name", sa.String(255), nullable=False, index=True),
        sa.Column("source", sa.String(30), nullable=False, server_default="manual"),
        sa.Column("created_by", sa.BigInteger, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("workspace_id", "api_name", name="uq_workspace_api"),
    )
    with op.batch_alter_table("change_alerts") as b:
        b.add_column(sa.Column("event_id", sa.BigInteger, nullable=True))
        b.create_foreign_key("fk_change_alerts_event", "upstream_change_events", ["event_id"], ["id"], ondelete="SET NULL")
        b.create_index("ix_change_alerts_event_id", ["event_id"])
        b.create_unique_constraint("uq_change_alerts_event_workspace", ["event_id", "workspace_id"])


def downgrade():
    with op.batch_alter_table("change_alerts") as b:
        b.drop_constraint("uq_change_alerts_event_workspace", type_="unique")
        b.drop_index("ix_change_alerts_event_id")
        b.drop_constraint("fk_change_alerts_event", type_="foreignkey")
        b.drop_column("event_id")
    op.drop_table("workspace_api_subscriptions")
    op.drop_table("upstream_change_events")
