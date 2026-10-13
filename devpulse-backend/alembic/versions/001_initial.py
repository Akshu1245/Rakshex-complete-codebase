"""Initial migration — all tables for DevPulse v4.0

Revision ID: 001_initial
Revises: None
Create Date: 2025-01-01 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Core ─────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("username", sa.String(100), unique=True, nullable=False),
        sa.Column("password_hash", sa.Text, nullable=False),
        sa.Column("plan", sa.String(20), server_default="free"),
        sa.Column("stripe_customer_id", sa.String(255)),
        sa.Column("stripe_subscription_id", sa.String(255)),
        sa.Column("trial_ends_at", sa.DateTime(timezone=True)),
        sa.Column("api_calls_today", sa.Integer, server_default="0"),
        sa.Column("api_calls_reset_date", sa.String(20)),
        sa.Column("overall_budget_limit", sa.Float, server_default="0"),
        sa.Column("overall_budget_used", sa.Float, server_default="0"),
        sa.Column("budget_alert_threshold", sa.Float, server_default="80"),
        sa.Column("budget_period", sa.String(20), server_default="monthly"),
        sa.Column("budget_reset_date", sa.String(30)),
        sa.Column("kill_switch_active", sa.Boolean, server_default="false"),
        sa.Column("onboarding_completed", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_users_email", "users", ["email"])
    op.create_index("idx_users_username", "users", ["username"])

    op.create_table(
        "api_keys",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("key_name", sa.String(255), nullable=False),
        sa.Column("api_provider", sa.String(100), nullable=False),
        sa.Column("encrypted_key", sa.Text, nullable=False),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("budget_limit", sa.Float, server_default="0"),
        sa.Column("budget_used", sa.Float, server_default="0"),
        sa.Column("budget_period", sa.String(20), server_default="monthly"),
        sa.Column("budget_reset_date", sa.String(30)),
        sa.Column("call_count", sa.Integer, server_default="0"),
        sa.Column("call_limit", sa.Integer, server_default="0"),
        sa.Column("last_used_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_api_keys_user", "api_keys", ["user_id"])

    op.create_table(
        "budget_logs",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("api_key_id", sa.BigInteger, sa.ForeignKey("api_keys.id", ondelete="SET NULL")),
        sa.Column("amount", sa.Float, nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("endpoint", sa.String(500)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_budget_logs_user", "budget_logs", ["user_id"])

    op.create_table(
        "code_history",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("use_case", sa.Text, nullable=False),
        sa.Column("language", sa.String(50), server_default="python"),
        sa.Column("generated_code", sa.Text),
        sa.Column("apis_used", sa.JSON),
        sa.Column("validation_score", sa.Integer),
        sa.Column("validation_grade", sa.String(5)),
        sa.Column("status", sa.String(30)),
        sa.Column("tokens_used", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_code_history_user", "code_history", ["user_id"])

    op.create_table(
        "usage_stats",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("endpoint", sa.String(500), nullable=False),
        sa.Column("response_time_ms", sa.Float),
        sa.Column("status_code", sa.Integer),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_usage_stats_user", "usage_stats", ["user_id"])
    op.create_index("idx_usage_stats_created", "usage_stats", ["created_at"])

    # ── Change Detection ─────────────────────────────────────────────────
    op.create_table(
        "api_responses",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("api_name", sa.String(255), nullable=False),
        sa.Column("response_hash", sa.String(128), nullable=False),
        sa.Column("schema_json", sa.Text),
        sa.Column("response_keys", sa.Text),
        sa.Column("field_count", sa.Integer, server_default="0"),
        sa.Column("status_code", sa.Integer),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_api_responses_name", "api_responses", ["api_name"])

    op.create_table(
        "change_alerts",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("api_name", sa.String(255), nullable=False),
        sa.Column("severity", sa.String(20), server_default="warning"),
        sa.Column("change_type", sa.String(50), server_default="schema_change"),
        sa.Column("summary", sa.Text),
        sa.Column("diff_json", sa.Text),
        sa.Column("old_hash", sa.String(128)),
        sa.Column("new_hash", sa.String(128)),
        sa.Column("acknowledged", sa.Boolean, server_default="false"),
        sa.Column("detected_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_change_alerts_api", "change_alerts", ["api_name"])

    # ── Security ─────────────────────────────────────────────────────────
    op.create_table(
        "security_scans",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("scan_type", sa.String(50), server_default="code"),
        sa.Column("target", sa.Text),
        sa.Column("language", sa.String(50)),
        sa.Column("score", sa.Integer, server_default="100"),
        sa.Column("grade", sa.String(5), server_default="A"),
        sa.Column("total_issues", sa.Integer, server_default="0"),
        sa.Column("results_json", sa.JSON),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_security_scans_user", "security_scans", ["user_id"])

    # ── AI Security (Pillar 1) ───────────────────────────────────────────
    op.create_table(
        "ai_security_scans",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("scan_type", sa.String(50), nullable=False),
        sa.Column("target", sa.Text),
        sa.Column("score", sa.Integer, server_default="100"),
        sa.Column("grade", sa.String(5), server_default="A"),
        sa.Column("threats_found", sa.Integer, server_default="0"),
        sa.Column("critical_count", sa.Integer, server_default="0"),
        sa.Column("high_count", sa.Integer, server_default="0"),
        sa.Column("medium_count", sa.Integer, server_default="0"),
        sa.Column("low_count", sa.Integer, server_default="0"),
        sa.Column("results_json", sa.JSON),
        sa.Column("fix_suggestions_json", sa.JSON),
        sa.Column("owasp_results_json", sa.JSON),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_ai_security_scans_user", "ai_security_scans", ["user_id"])

    op.create_table(
        "threat_events",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("threat_type", sa.String(100), nullable=False),
        sa.Column("severity", sa.String(20), server_default="medium"),
        sa.Column("source", sa.String(255)),
        sa.Column("description", sa.Text),
        sa.Column("api_endpoint", sa.String(500)),
        sa.Column("resolved", sa.Boolean, server_default="false"),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_threat_events_user", "threat_events", ["user_id"])

    # ── Cost Intelligence (Pillar 2) ─────────────────────────────────────
    op.create_table(
        "api_call_logs",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("api_key_id", sa.BigInteger, sa.ForeignKey("api_keys.id", ondelete="SET NULL")),
        sa.Column("provider", sa.String(100), nullable=False),
        sa.Column("model", sa.String(100)),
        sa.Column("endpoint", sa.String(500)),
        sa.Column("tokens_input", sa.Integer, server_default="0"),
        sa.Column("tokens_output", sa.Integer, server_default="0"),
        sa.Column("cost_usd", sa.Float, server_default="0"),
        sa.Column("latency_ms", sa.Float, server_default="0"),
        sa.Column("status_code", sa.Integer),
        sa.Column("cached", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_api_call_logs_user", "api_call_logs", ["user_id"])
    op.create_index("idx_api_call_logs_created", "api_call_logs", ["created_at"])

    op.create_table(
        "cost_budgets",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("provider", sa.String(100)),
        sa.Column("monthly_limit_usd", sa.Float, nullable=False),
        sa.Column("current_spend_usd", sa.Float, server_default="0"),
        sa.Column("alert_threshold_pct", sa.Float, server_default="80"),
        sa.Column("auto_kill", sa.Boolean, server_default="false"),
        sa.Column("period_start", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_cost_budgets_user", "cost_budgets", ["user_id"])

    op.create_table(
        "cost_forecasts",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("forecast_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("predicted_spend_usd", sa.Float, nullable=False),
        sa.Column("confidence", sa.Float, server_default="0.8"),
        sa.Column("method", sa.String(50), server_default="linear"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_cost_forecasts_user", "cost_forecasts", ["user_id"])

    # ── Incidents ────────────────────────────────────────────────────────
    op.create_table(
        "incidents",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("description", sa.Text, server_default=""),
        sa.Column("severity", sa.String(20), server_default="medium"),
        sa.Column("status", sa.String(30), server_default="detected"),
        sa.Column("affected_apis", sa.JSON),
        sa.Column("detected_by", sa.String(50), server_default="manual"),
        sa.Column("root_cause", sa.Text),
        sa.Column("resolution", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
    )
    op.create_index("idx_incidents_status", "incidents", ["status"])

    op.create_table(
        "incident_events",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("incident_id", sa.String(64), sa.ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("message", sa.Text, server_default=""),
        sa.Column("author", sa.String(100), server_default="system"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_incident_events_inc", "incident_events", ["incident_id"])

    # ── Alerts & Kill-Switch ─────────────────────────────────────────────
    op.create_table(
        "alert_configs",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("channel", sa.String(50), server_default="in_app"),
        sa.Column("target", sa.String(500), server_default=""),
        sa.Column("conditions_json", sa.JSON),
        sa.Column("priority", sa.String(20), server_default="medium"),
        sa.Column("enabled", sa.Boolean, server_default="true"),
        sa.Column("trigger_count", sa.Integer, server_default="0"),
        sa.Column("last_triggered_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "alert_history",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("config_id", sa.String(64), sa.ForeignKey("alert_configs.id", ondelete="SET NULL")),
        sa.Column("channel", sa.String(50)),
        sa.Column("event_type", sa.String(100)),
        sa.Column("message", sa.Text),
        sa.Column("delivered", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_alert_history_config", "alert_history", ["config_id"])

    op.create_table(
        "kill_switches",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("api_name", sa.String(255), nullable=False, unique=True),
        sa.Column("reason", sa.Text, server_default=""),
        sa.Column("activated_by", sa.String(100), server_default="system"),
        sa.Column("activated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deactivated_at", sa.DateTime(timezone=True)),
    )

    # ── Teams ────────────────────────────────────────────────────────────
    op.create_table(
        "teams",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("owner_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "team_members",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("team_id", sa.String(64), sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(30), server_default="viewer"),
        sa.Column("invited_by", sa.BigInteger),
        sa.Column("accepted", sa.Boolean, server_default="false"),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("team_id", "user_id"),
    )
    op.create_index("idx_team_members_team", "team_members", ["team_id"])
    op.create_index("idx_team_members_user", "team_members", ["user_id"])

    # ── Marketplace ──────────────────────────────────────────────────────
    op.create_table(
        "marketplace_templates",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, server_default=""),
        sa.Column("author", sa.String(100), server_default="anonymous"),
        sa.Column("author_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("category", sa.String(50), server_default="general"),
        sa.Column("tags", sa.JSON),
        sa.Column("language", sa.String(50), server_default="python"),
        sa.Column("apis_used", sa.JSON),
        sa.Column("code", sa.Text, server_default=""),
        sa.Column("downloads", sa.Integer, server_default="0"),
        sa.Column("rating_sum", sa.Float, server_default="0"),
        sa.Column("rating_count", sa.Integer, server_default="0"),
        sa.Column("version", sa.String(20), server_default="1.0.0"),
        sa.Column("verified", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_marketplace_cat", "marketplace_templates", ["category"])

    op.create_table(
        "marketplace_reviews",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("template_id", sa.String(64), sa.ForeignKey("marketplace_templates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("rating", sa.Integer, nullable=False),
        sa.Column("comment", sa.Text, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("rating >= 1 AND rating <= 5"),
    )

    # ── CI/CD ────────────────────────────────────────────────────────────
    op.create_table(
        "cicd_runs",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("pipeline_id", sa.String(100)),
        sa.Column("repo", sa.String(255)),
        sa.Column("branch", sa.String(100), server_default="main"),
        sa.Column("gate_result", sa.String(30), server_default="PENDING"),
        sa.Column("security_score", sa.Integer),
        sa.Column("compatibility_score", sa.Integer),
        sa.Column("budget_ok", sa.Boolean, server_default="true"),
        sa.Column("details_json", sa.JSON),
        sa.Column("triggered_by", sa.String(100), server_default="api"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_cicd_runs_pipeline", "cicd_runs", ["pipeline_id"])

    # ── Billing ──────────────────────────────────────────────────────────
    op.create_table(
        "billing_events",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("amount_cents", sa.Integer, server_default="0"),
        sa.Column("currency", sa.String(10), server_default="usd"),
        sa.Column("stripe_event_id", sa.String(255)),
        sa.Column("description", sa.Text, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_billing_user", "billing_events", ["user_id"])

    # ── Custom APIs ──────────────────────────────────────────────────────
    op.create_table(
        "custom_apis",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("protocol", sa.String(20), server_default="rest"),
        sa.Column("base_url", sa.String(1000), nullable=False),
        sa.Column("spec_json", sa.JSON),
        sa.Column("metadata_json", sa.JSON),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_custom_apis_user", "custom_apis", ["user_id"])


def downgrade() -> None:
    tables = [
        "custom_apis", "billing_events", "cicd_runs",
        "marketplace_reviews", "marketplace_templates",
        "team_members", "teams",
        "kill_switches", "alert_history", "alert_configs",
        "incident_events", "incidents",
        "cost_forecasts", "cost_budgets", "api_call_logs",
        "threat_events", "ai_security_scans",
        "security_scans",
        "change_alerts", "api_responses",
        "usage_stats", "code_history",
        "budget_logs", "api_keys", "users",
    ]
    for t in tables:
        op.drop_table(t)
