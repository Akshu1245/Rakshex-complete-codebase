from rakshex_agentguard import (
    create_client,
    apply_privacy,
    looks_like_provider_key,
    redact_secrets,
)
from rakshex_agentguard.types import UsageEvent, ToolCallRecord
from datetime import datetime, timezone
from io import BytesIO
import json
import urllib.error


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


def test_gateway_chat_completions_routes_workspace_key(monkeypatch):
    observed = {}

    class FakeResponse:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def read(self):
            return json.dumps(
                {
                    "id": "chatcmpl_1",
                    "choices": [
                        {"message": {"role": "assistant", "content": "approved"}}
                    ],
                }
            ).encode()

    def fake_urlopen(request, timeout):
        observed["url"] = request.full_url
        observed["authorization"] = request.get_header("Authorization")
        observed["project"] = request.get_header("X-rakshex-project-id")
        observed["identity"] = request.get_header("X-rakshex-identity-id")
        observed["timeout"] = timeout
        return FakeResponse()

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    client = create_client(
        "rk_live_workspace",
        gateway_url="https://api.rakshex.test",
        project_id="payments",
    )
    result = client.gateway_chat_completions(
        {
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": "approve invoice"}],
        },
        identity_id=12,
    )

    assert result["id"] == "chatcmpl_1"
    assert observed["url"] == "https://api.rakshex.test/v1/chat/completions"
    assert observed["authorization"] == "Bearer rk_live_workspace"
    assert observed["project"] == "payments"
    assert observed["identity"] == "12"


def test_gateway_chat_completions_never_fails_open(monkeypatch):
    def blocked(*_args, **_kwargs):
        raise urllib.error.HTTPError(
            "https://api.rakshex.test/v1/chat/completions",
            403,
            "Forbidden",
            {},
            BytesIO(
                json.dumps(
                    {
                        "error": {
                            "message": "A scoped kill switch is active",
                            "code": "rakshex_policy_blocked",
                        }
                    }
                ).encode()
            ),
        )

    monkeypatch.setattr("urllib.request.urlopen", blocked)
    client = create_client("rk_live_workspace", fail_open=True)

    try:
        client.gateway_chat_completions(
            {
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": "hello"}],
            }
        )
        assert False, "blocked gateway call must raise"
    except RuntimeError as exc:
        assert str(exc) == "A scoped kill switch is active"
        assert getattr(exc, "status") == 403
        assert getattr(exc, "code") == "rakshex_policy_blocked"
