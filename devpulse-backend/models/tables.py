"""
DevPulse SQLAlchemy ORM Models â€” PostgreSQL-backed data layer.

All tables mirror the original SQLite schema plus new AI Security
and Cost Intelligence tables for the v4.0 pivot.

Uses BigInteger on PostgreSQL (8-byte) with Integer fallback on SQLite
so that autoincrement PKs work correctly on both drivers.
"""
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, BigInteger, String, Text, Float, Boolean, DateTime,
    ForeignKey, Index, UniqueConstraint, CheckConstraint, JSON,
    func,
)
from sqlalchemy.orm import DeclarativeBase, relationship

# BigInteger on PG, plain Integer on SQLite (autoincrement compat)
BigInt = BigInteger().with_variant(Integer, "sqlite")


class Base(DeclarativeBase):
    pass


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# CORE
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class User(Base):
    __tablename__ = "users"

    id = Column(BigInt, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=False)
    plan = Column(String(20), default="free")
    stripe_customer_id = Column(String(255))
    stripe_subscription_id = Column(String(255))
    trial_ends_at = Column(DateTime(timezone=True))
    api_calls_today = Column(Integer, default=0)
    api_calls_reset_date = Column(String(20))
    overall_budget_limit = Column(Float, default=0)
    overall_budget_used = Column(Float, default=0)
    budget_alert_threshold = Column(Float, default=80)
    budget_period = Column(String(20), default="monthly")
    budget_reset_date = Column(String(30))
    kill_switch_active = Column(Boolean, default=False)
    onboarding_completed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    api_keys = relationship("ApiKey", back_populates="user", cascade="all, delete-orphan")
    security_scans = relationship("SecurityScan", back_populates="user")


class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(BigInt, primary_key=True, autoincrement=True)
    user_id = Column(BigInt, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    key_name = Column(String(255), nullable=False)
    api_provider = Column(String(100), nullable=False)
    encrypted_key = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True)
    budget_limit = Column(Float, default=0)
    budget_used = Column(Float, default=0)
    budget_period = Column(String(20), default="monthly")
    budget_reset_date = Column(String(30))
    call_count = Column(Integer, default=0)
    call_limit = Column(Integer, default=0)
    last_used_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="api_keys")


class BudgetLog(Base):
    __tablename__ = "budget_logs"

    id = Column(BigInt, primary_key=True, autoincrement=True)
    user_id = Column(BigInt, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    api_key_id = Column(BigInt, ForeignKey("api_keys.id", ondelete="SET NULL"))
    amount = Column(Float, nullable=False)
    description = Column(Text)
    endpoint = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CodeHistory(Base):
    __tablename__ = "code_history"

    id = Column(BigInt, primary_key=True, autoincrement=True)
    user_id = Column(BigInt, ForeignKey("users.id", ondelete="SET NULL"), index=True)
    use_case = Column(Text, nullable=False)
    language = Column(String(50), default="python")
    generated_code = Column(Text)
    apis_used = Column(JSON, default=list)
    validation_score = Column(Integer)
    validation_grade = Column(String(5))
    status = Column(String(30))
    tokens_used = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class UsageStat(Base):
    __tablename__ = "usage_stats"

    id = Column(BigInt, primary_key=True, autoincrement=True)
    user_id = Column(BigInt, ForeignKey("users.id", ondelete="SET NULL"), index=True)
    endpoint = Column(String(500), nullable=False)
    response_time_ms = Column(Float)
    status_code = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# CHANGE DETECTION
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class ApiResponse(Base):
    __tablename__ = "api_responses"

    id = Column(BigInt, primary_key=True, autoincrement=True)
    api_name = Column(String(255), nullable=False, index=True)
    response_hash = Column(String(128), nullable=False)
    schema_json = Column(Text)
    response_keys = Column(Text)
    field_count = Column(Integer, default=0)
    status_code = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ChangeAlert(Base):
    __tablename__ = "change_alerts"

    id = Column(BigInt, primary_key=True, autoincrement=True)
    api_name = Column(String(255), nullable=False, index=True)
    severity = Column(String(20), default="warning")
    change_type = Column(String(50), default="schema_change")
    summary = Column(Text)
    diff_json = Column(Text)
    old_hash = Column(String(128))
    new_hash = Column(String(128))
    acknowledged = Column(Boolean, default=False)
    detected_at = Column(DateTime(timezone=True), server_default=func.now())


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SECURITY
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class SecurityScan(Base):
    __tablename__ = "security_scans"

    id = Column(BigInt, primary_key=True, autoincrement=True)
    user_id = Column(BigInt, ForeignKey("users.id", ondelete="SET NULL"), index=True)
    scan_type = Column(String(50), default="code")
    target = Column(Text)
    language = Column(String(50))
    score = Column(Integer, default=100)
    grade = Column(String(5), default="A")
    total_issues = Column(Integer, default=0)
    results_json = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="security_scans")


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# AI SECURITY (NEW â€” Pillar 1)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class AiSecurityScan(Base):
    __tablename__ = "ai_security_scans"

    id = Column(BigInt, primary_key=True, autoincrement=True)
    user_id = Column(BigInt, ForeignKey("users.id", ondelete="SET NULL"), index=True)
    scan_type = Column(String(50), nullable=False)  # token_leak | agent_attack | owasp | full
    target = Column(Text)
    score = Column(Integer, default=100)
    grade = Column(String(5), default="A")
    threats_found = Column(Integer, default=0)
    critical_count = Column(Integer, default=0)
    high_count = Column(Integer, default=0)
    medium_count = Column(Integer, default=0)
    low_count = Column(Integer, default=0)
    results_json = Column(JSON, default=dict)
    fix_suggestions_json = Column(JSON, default=list)
    owasp_results_json = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ThreatEvent(Base):
    __tablename__ = "threat_events"

    id = Column(BigInt, primary_key=True, autoincrement=True)
    user_id = Column(BigInt, ForeignKey("users.id", ondelete="SET NULL"), index=True)
    threat_type = Column(String(100), nullable=False)
    severity = Column(String(20), default="medium")
    source = Column(String(255))
    description = Column(Text)
    api_endpoint = Column(String(500))
    resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# COST INTELLIGENCE (NEW â€” Pillar 2)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class ApiCallLog(Base):
    __tablename__ = "api_call_logs"

    id = Column(BigInt, primary_key=True, autoincrement=True)
    user_id = Column(BigInt, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    api_key_id = Column(BigInt, ForeignKey("api_keys.id", ondelete="SET NULL"))
    provider = Column(String(100), nullable=False)
    model = Column(String(100))
    endpoint = Column(String(500))
    tokens_input = Column(Integer, default=0)
    tokens_output = Column(Integer, default=0)
    cost_usd = Column(Float, default=0)
    latency_ms = Column(Float, default=0)
    status_code = Column(Integer)
    cached = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class CostBudget(Base):
    __tablename__ = "cost_budgets"

    id = Column(BigInt, primary_key=True, autoincrement=True)
    user_id = Column(BigInt, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    provider = Column(String(100))
    monthly_limit_usd = Column(Float, nullable=False)
    current_spend_usd = Column(Float, default=0)
    alert_threshold_pct = Column(Float, default=80)
    auto_kill = Column(Boolean, default=False)
    period_start = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CostForecast(Base):
    __tablename__ = "cost_forecasts"

    id = Column(BigInt, primary_key=True, autoincrement=True)
    user_id = Column(BigInt, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    forecast_date = Column(DateTime(timezone=True), nullable=False)
    predicted_spend_usd = Column(Float, nullable=False)
    confidence = Column(Float, default=0.8)
    method = Column(String(50), default="linear")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# INCIDENTS
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String(64), primary_key=True)
    title = Column(Text, nullable=False)
    description = Column(Text, default="")
    severity = Column(String(20), default="medium")
    status = Column(String(30), default="detected", index=True)
    affected_apis = Column(JSON, default=list)
    detected_by = Column(String(50), default="manual")
    root_cause = Column(Text)
    resolution = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    resolved_at = Column(DateTime(timezone=True))


class IncidentEvent(Base):
    __tablename__ = "incident_events"

    id = Column(String(64), primary_key=True)
    incident_id = Column(String(64), ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(50), nullable=False)
    message = Column(Text, default="")
    author = Column(String(100), default="system")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# ALERTS & KILL-SWITCH
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class AlertConfig(Base):
    __tablename__ = "alert_configs"

    id = Column(String(64), primary_key=True)
    user_id = Column(BigInt, ForeignKey("users.id", ondelete="CASCADE"))
    name = Column(String(255), nullable=False)
    channel = Column(String(50), default="in_app")
    target = Column(String(500), default="")
    conditions_json = Column(JSON, default=dict)
    priority = Column(String(20), default="medium")
    enabled = Column(Boolean, default=True)
    trigger_count = Column(Integer, default=0)
    last_triggered_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AlertHistory(Base):
    __tablename__ = "alert_history"

    id = Column(BigInt, primary_key=True, autoincrement=True)
    config_id = Column(String(64), ForeignKey("alert_configs.id", ondelete="SET NULL"))
    channel = Column(String(50))
    event_type = Column(String(100))
    message = Column(Text)
    delivered = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class KillSwitch(Base):
    __tablename__ = "kill_switches"

    id = Column(BigInt, primary_key=True, autoincrement=True)
    api_name = Column(String(255), nullable=False, unique=True)
    reason = Column(Text, default="")
    activated_by = Column(String(100), default="system")
    activated_at = Column(DateTime(timezone=True), server_default=func.now())
    deactivated_at = Column(DateTime(timezone=True))


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# TEAMS & RBAC
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class Team(Base):
    __tablename__ = "teams"

    id = Column(String(64), primary_key=True)
    name = Column(String(255), nullable=False)
    owner_id = Column(BigInt, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TeamMember(Base):
    __tablename__ = "team_members"

    id = Column(BigInt, primary_key=True, autoincrement=True)
    team_id = Column(String(64), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(BigInt, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(30), default="viewer")
    invited_by = Column(BigInt)
    accepted = Column(Boolean, default=False)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint("team_id", "user_id"),)


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# MARKETPLACE
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class MarketplaceTemplate(Base):
    __tablename__ = "marketplace_templates"

    id = Column(String(64), primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    author = Column(String(100), default="anonymous")
    author_id = Column(BigInt, ForeignKey("users.id", ondelete="SET NULL"))
    category = Column(String(50), default="general", index=True)
    tags = Column(JSON, default=list)
    language = Column(String(50), default="python")
    apis_used = Column(JSON, default=list)
    code = Column(Text, default="")
    downloads = Column(Integer, default=0)
    rating_sum = Column(Float, default=0)
    rating_count = Column(Integer, default=0)
    version = Column(String(20), default="1.0.0")
    verified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class MarketplaceReview(Base):
    __tablename__ = "marketplace_reviews"

    id = Column(BigInt, primary_key=True, autoincrement=True)
    template_id = Column(String(64), ForeignKey("marketplace_templates.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(BigInt, ForeignKey("users.id", ondelete="SET NULL"))
    rating = Column(Integer, nullable=False)
    comment = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (CheckConstraint("rating >= 1 AND rating <= 5"),)


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# CI/CD
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class CicdRun(Base):
    __tablename__ = "cicd_runs"

    id = Column(String(64), primary_key=True)
    pipeline_id = Column(String(100), index=True)
    repo = Column(String(255))
    branch = Column(String(100), default="main")
    gate_result = Column(String(30), default="PENDING")
    security_score = Column(Integer)
    compatibility_score = Column(Integer)
    budget_ok = Column(Boolean, default=True)
    details_json = Column(JSON, default=dict)
    triggered_by = Column(String(100), default="api")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# BILLING
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class BillingEvent(Base):
    __tablename__ = "billing_events"

    id = Column(BigInt, primary_key=True, autoincrement=True)
    user_id = Column(BigInt, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(50), nullable=False)
    amount_cents = Column(Integer, default=0)
    currency = Column(String(10), default="usd")
    stripe_event_id = Column(String(255))
    description = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# CUSTOM APIS (OpenAPI Import)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class CustomApi(Base):
    __tablename__ = "custom_apis"

    id = Column(BigInt, primary_key=True, autoincrement=True)
    user_id = Column(BigInt, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name = Column(String(255), nullable=False)
    protocol = Column(String(20), default="rest")
    base_url = Column(String(1000), nullable=False)
    spec_json = Column(JSON)
    metadata_json = Column(JSON, default=dict)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
