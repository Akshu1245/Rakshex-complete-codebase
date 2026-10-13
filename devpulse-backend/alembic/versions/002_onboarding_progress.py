"""Persist per-account onboarding progress across container restarts."""
from alembic import op
import sqlalchemy as sa

revision = "002_onboarding_progress"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("onboarding_progress",
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("completed_steps", sa.Text, nullable=False, server_default="[]"))
    op.create_table("billing_webhooks",
        sa.Column("event_id", sa.String(255), primary_key=True),
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()))


def downgrade():
    op.drop_table("billing_webhooks")
    op.drop_table("onboarding_progress")
