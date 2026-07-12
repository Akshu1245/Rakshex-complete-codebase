from rakshex_agentguard import (
    create_client,
    apply_privacy,
    looks_like_provider_key,
    redact_secrets,
)
from rakshex_agentguard.types import UsageEvent, ToolCallRecord
from datetime import datetime, timezone


def _event(**kw):
    base = dict(
        event_id="e1",
        correlation_id="c1",
        provider="openai",
        model="gpt-4o",
        request_timestamp=datetime.now(timezone.utc).isoformat(),
        latency_ms=1,
        input_tokens=1,
        output_tokens=1,
        cached_tokens=0,
        cost_usd=0,
        cost_kind="estimate",
        status="ok",
        retry_count=0,
        tool_calls=[ToolCallRecord(name="t")],
        agent_steps=[],
        redaction_count=0,
        metadata={"api_key": "secret", "ok": True},
        sdk_version="0.1.0",
        prompt_content="hello sk-abcdefghijklmnopqrstuvwxyz123456",
        response_content="world",
    )
    base.update(kw)
    return UsageEvent(**base)


def test_metadata_only_strips_content():
    e = apply_privacy(_event(), "metadata_only")
    assert e.prompt_content is None
    assert e.response_content is None
    assert e.metadata["api_key"] == "[REDACTED]"
    assert e.metadata["ok"] is True


def test_redacted_content():
    e = apply_privacy(_event(), "redacted_content")
    assert e.prompt_content is not None
    assert "sk-abcdefghijklmnop" not in e.prompt_content
    assert e.redaction_count > 0


def test_provider_key_detection():
    assert looks_like_provider_key("sk-abcdefghijklmnopqrstuvwxyz123456")
    assert not looks_like_provider_key("rx_workspace_key")


def test_capture_no_prompt_default():
    client = create_client("rx_test", privacy_mode="metadata_only", batch_size=100)
    ev = client.capture(
        provider="openai",
        model="gpt-4o",
        prompt="secret user text",
        input_tokens=10,
        output_tokens=5,
    )
    assert ev.prompt_content is None
    assert ev.prompt_hash is not None
    assert len(ev.prompt_hash) == 64


def test_fail_open_offline_queue():
    client = create_client(
        "rx_test",
        gateway_url="http://127.0.0.1:1",
        fail_open=True,
        batch_size=100,
        max_retries=0,
    )
    client.capture(provider="anthropic", model="claude", input_tokens=1)
    result = client.flush()
    assert result["ok"] is False
    assert result.get("queuedOffline") is True
    assert client.get_offline_queue_size() > 0


def test_redact_secrets():
    text, n = redact_secrets("token sk-abcdefghijklmnopqrstuvwxyz123456")
    assert n >= 1
    assert "sk-abcd" not in text
