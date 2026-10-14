"""Enable the PostgreSQL bcrypt implementation for the free Worker runtime."""
from alembic import op

revision = '003_worker_password_crypto'
down_revision = '002_onboarding_progress'
branch_labels = None
depends_on = None


def upgrade():
    op.execute('CREATE EXTENSION IF NOT EXISTS pgcrypto')


def downgrade():
    # pgcrypto may be shared by other application data. Never drop it on rollback.
    pass
