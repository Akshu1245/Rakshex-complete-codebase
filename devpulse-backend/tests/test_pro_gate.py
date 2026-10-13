"""Tests for pro_gate middleware and plan limits."""
import pytest
from middleware.pro_gate import (
    get_plan_limits,
    check_feature_access,
    check_api_limit,
    check_alert_limit,
)


def test_free_plan_limits():
    limits = get_plan_limits("free")
    assert limits["apis"] == 3
    assert limits["alerts_per_month"] == 5
    assert limits["history_days"] == 7


def test_pro_plan_limits():
    limits = get_plan_limits("pro")
    assert limits["apis"] == 999
    assert limits["alerts_per_month"] == 999


def test_feature_access_free():
    assert check_feature_access("free", "security_scan") is False
    assert check_feature_access("free", "cicd_gates") is False
    assert check_feature_access("free", "kill_switch") is False


def test_feature_access_pro():
    assert check_feature_access("pro", "security_scan") is True
    assert check_feature_access("pro", "cicd_gates") is True
    assert check_feature_access("pro", "kill_switch") is True


def test_api_limit_free():
    assert check_api_limit("free", 2) is True
    assert check_api_limit("free", 3) is False
    assert check_api_limit("free", 10) is False


def test_alert_limit_free():
    assert check_alert_limit("free", 4) is True
    assert check_alert_limit("free", 5) is False


def test_unknown_plan_defaults_to_free():
    limits = get_plan_limits("nonexistent")
    assert limits["apis"] == 3
