"""Exercise configuration in fresh processes so production env validation is real."""
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = str(Path(__file__).resolve().parents[1])


def read_config(**overrides):
    env = {k: v for k, v in os.environ.items() if k not in {
        'RESOURCE_PROFILE', 'HEALTH_PROBE_INTERVAL_SECONDS',
        'CHANGE_PROBE_INTERVAL_SECONDS', 'DB_POOL_MIN', 'DB_POOL_MAX',
        'HEALTH_WEBSOCKET_INTERVAL_SECONDS',
    }}
    env.update(overrides)
    return subprocess.run([
        sys.executable, '-c',
        'import json; from services.resource_config import *; '
        'print(json.dumps([FREE_PROFILE, HEALTH_INTERVAL, CHANGE_INTERVAL, POOL_MIN, POOL_MAX, WEBSOCKET_INTERVAL]))',
    ], env=env, cwd=ROOT, capture_output=True, text=True)


def test_free_defaults_reduce_background_and_connection_usage():
    result = read_config()
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == [True, 300, 900, 1, 3, 60]


def test_standard_profile_and_explicit_overrides():
    assert json.loads(read_config(RESOURCE_PROFILE='standard').stdout) == [False, 60, 300, 5, 20, 10]
    assert json.loads(read_config(HEALTH_PROBE_INTERVAL_SECONDS='600', DB_POOL_MAX='4').stdout) == [True, 600, 900, 1, 4, 60]


def test_rejects_busy_loops_and_invalid_pool_sizes():
    for config in [
        {'HEALTH_PROBE_INTERVAL_SECONDS': '0'},
        {'CHANGE_PROBE_INTERVAL_SECONDS': '-1'},
        {'DB_POOL_MIN': '5', 'DB_POOL_MAX': '2'},
        {'DB_POOL_MAX': 'invalid'},
        {'HEALTH_WEBSOCKET_INTERVAL_SECONDS': '0'},
    ]:
        assert read_config(**config).returncode != 0
