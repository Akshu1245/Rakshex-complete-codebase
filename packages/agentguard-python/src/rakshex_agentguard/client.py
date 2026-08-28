from __future__ import annotations

import hashlib
import json
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from typing import Any, Callable

from .privacy import apply_privacy
from .types import (
    AgentStepRecord,
    EventStatus,
    PrivacyMode,
    ToolCallRecord,
    UsageEvent,
)

SDK_VERSION = "0.2.0"
DEFAULT_GATEWAY = "https://api.rakshex.com"


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class OfflineQueue:
    def __init__(self, max_size: int = 1000) -> None:
        self._items: list[UsageEvent] = []
        self._max = max_size

    @property
    def size(self) -> int:
        return len(self._items)

    def enqueue(self, event: UsageEvent) -> None:
        self._items.append(event)
        while len(self._items) > self._max:
            self._items.pop(0)

    def peek(self, n: int) -> list[UsageEvent]:
        return self._items[:n]

    def mark_flushed(self, count: int) -> None:
        self._items = self._items[count:]


class AgentGuardClient:
    """Python AgentGuard client — fail-open telemetry with privacy modes."""

    def __init__(
        self,
        api_key: str,
        *,
        gateway_url: str = DEFAULT_GATEWAY,
        privacy_mode: PrivacyMode = "metadata_only",
        workspace_id: str | None = None,
        project_id: str | None = None,
        agent_id: str | None = None,
        fail_open: bool = True,
        batch_size: int = 20,
        max_retries: int = 3,
        offline_queue_max: int = 1000,
    ) -> None:
        if not api_key:
            raise ValueError("api_key is required (Rakshex workspace key)")
        self.api_key = api_key
        self.gateway_url = gateway_url.rstrip("/")
        self.privacy_mode = privacy_mode
        self.workspace_id = workspace_id
        self.project_id = project_id
        self.agent_id = agent_id
        self.fail_open = fail_open
        self.batch_size = batch_size
        self.max_retries = max_retries
        self._buffer: list[UsageEvent] = []
        self._offline = OfflineQueue(offline_queue_max)
        self._closed = False

    def is_configured(self) -> bool:
        return bool(self.api_key) and not self._closed

    def correlation_id(self, existing: str | None = None) -> str:
        return existing or str(uuid.uuid4())

    def capture(
        self,
        *,
        provider: str,
        model: str,
        correlation_id: str | None = None,
        input_tokens: int = 0,
        output_tokens: int = 0,
        cached_tokens: int = 0,
        cost_usd: float = 0.0,
        cost_kind: str = "estimate",
        status: EventStatus = "ok",
        error_code: str | None = None,
        error_message: str | None = None,
        retry_count: int = 0,
        tool_calls: list[ToolCallRecord] | None = None,
        agent_steps: list[AgentStepRecord] | None = None,
        prompt: str | None = None,
        response: str | None = None,
        latency_ms: float = 0.0,
        metadata: dict[str, Any] | None = None,
    ) -> UsageEvent:
        mode = self.privacy_mode
        prompt_hash = _sha256(prompt) if prompt and mode != "zero_retention" else None
        response_hash = _sha256(response) if response and mode != "zero_retention" else None
        prompt_content = (
            prompt if prompt and mode in ("full_content", "redacted_content") else None
        )
        response_content = (
            response if response and mode in ("full_content", "redacted_content") else None
        )

        event = UsageEvent(
            event_id=str(uuid.uuid4()),
            correlation_id=self.correlation_id(correlation_id),
            provider=provider,
            model=model,
            request_timestamp=_now_iso(),
            latency_ms=latency_ms,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cached_tokens=cached_tokens,
            cost_usd=cost_usd,
            cost_kind=cost_kind,
            status=status,
            retry_count=retry_count,
            tool_calls=tool_calls or [],
            agent_steps=agent_steps or [],
            redaction_count=0,
            metadata=metadata or {},
            sdk_version=SDK_VERSION,
            workspace_id=self.workspace_id,
            project_id=self.project_id,
            agent_id=self.agent_id,
            error_code=error_code,
            error_message=error_message,
            prompt_hash=prompt_hash,
            response_hash=response_hash,
            prompt_content=prompt_content,
            response_content=response_content,
        )
        event = apply_privacy(event, mode)

        if mode == "local_only":
            self._offline.enqueue(event)
            return event
        if mode == "zero_retention":
            return event

        self._buffer.append(event)
        if len(self._buffer) >= self.batch_size:
            self.flush()
        return event

    def wrap_call(
        self,
        fn: Callable[[], Any],
        *,
        provider: str,
        model: str,
        extract_usage: Callable[[Any], dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> Any:
        start = time.perf_counter()
        try:
            result = fn()
            extra = extract_usage(result) if extract_usage else {}
            self.capture(
                provider=provider,
                model=model,
                latency_ms=(time.perf_counter() - start) * 1000,
                status="ok",
                **{**kwargs, **extra},
            )
            return result
        except Exception as exc:
            self.capture(
                provider=provider,
                model=model,
                latency_ms=(time.perf_counter() - start) * 1000,
                status="error",
                error_message=str(exc)[:500],
                error_code=type(exc).__name__,
                **kwargs,
            )
            raise

    def gateway_chat_completions(
        self,
        request: dict[str, Any],
        *,
        provider: str = "openai",
        provider_account_id: int | None = None,
        identity_id: int | None = None,
        project_id: str | None = None,
        agent_id: str | None = None,
        timeout: float = 120.0,
    ) -> dict[str, Any]:
        """Invoke an OpenAI-compatible model through Rakshex enforcement.

        This data-plane method is always fail-closed. ``fail_open`` applies
        only to telemetry delivery and never bypasses a policy decision or a
        gateway outage. For streaming, configure an OpenAI-compatible client
        with ``gateway_url`` as its base URL.
        """
        if request.get("stream"):
            raise ValueError(
                "gateway_chat_completions returns JSON only; use an OpenAI-compatible "
                "client with the Rakshex base URL for streaming"
            )
        if not isinstance(request.get("model"), str) or not request["model"]:
            raise ValueError("request.model is required")
        if not isinstance(request.get("messages"), list) or not request["messages"]:
            raise ValueError("request.messages is required")
        if provider not in ("openai", "openai_compatible"):
            raise ValueError("provider must be openai or openai_compatible")

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
            "X-Rakshex-Provider": provider,
            "X-Rakshex-Sdk": "agentguard-python",
        }
        resolved_project = project_id or self.project_id
        resolved_agent = agent_id or self.agent_id
        if resolved_project:
            headers["X-Rakshex-Project-Id"] = resolved_project
        if resolved_agent:
            headers["X-Rakshex-Agent-Id"] = resolved_agent
        if identity_id is not None:
            headers["X-Rakshex-Identity-Id"] = str(identity_id)
        if provider_account_id is not None:
            headers["X-Rakshex-Provider-Account-Id"] = str(provider_account_id)

        payload = json.dumps({**request, "stream": False}).encode("utf-8")
        req = urllib.request.Request(
            f"{self.gateway_url}/v1/chat/completions",
            data=payload,
            method="POST",
            headers=headers,
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read().decode("utf-8")
                parsed = json.loads(raw)
                if not isinstance(parsed, dict):
                    raise RuntimeError("Rakshex gateway returned an invalid response")
                return parsed
        except urllib.error.HTTPError as exc:
            message = f"Rakshex gateway request failed ({exc.code})"
            code: str | None = None
            try:
                parsed_error = json.loads(exc.read().decode("utf-8"))
                detail = parsed_error.get("error", {})
                if isinstance(detail, dict):
                    message = str(detail.get("message") or message)
                    code = str(detail.get("code")) if detail.get("code") else None
            except Exception:
                pass
            error = RuntimeError(message)
            setattr(error, "status", exc.code)
            setattr(error, "code", code)
            raise error from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Rakshex enforcement gateway unavailable: {exc.reason}") from exc

    def flush(self) -> dict[str, Any]:
        if self._closed or self.privacy_mode in ("local_only", "zero_retention"):
            return {"ok": True}
        offline = self._offline.peek(50)
        batch = list(self._buffer)
        self._buffer.clear()
        events = offline + batch
        if not events:
            return {"ok": True}

        payload = json.dumps(
            {"events": [e.to_dict() for e in events], "sdkVersion": SDK_VERSION}
        ).encode("utf-8")
        url = f"{self.gateway_url}/api/telemetry/ingest"
        last_error = "unknown"

        for attempt in range(self.max_retries + 1):
            try:
                req = urllib.request.Request(
                    url,
                    data=payload,
                    method="POST",
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {self.api_key}",
                        "X-Rakshex-Sdk": "agentguard-python",
                    },
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    if 200 <= resp.status < 300:
                        if offline:
                            self._offline.mark_flushed(len(offline))
                        return {"ok": True, "status": resp.status}
                    last_error = f"HTTP {resp.status}"
            except urllib.error.HTTPError as e:
                last_error = f"HTTP {e.code}"
                if 400 <= e.code < 500 and e.code != 429:
                    break
            except Exception as e:
                last_error = str(e)
            if attempt < self.max_retries:
                time.sleep(min(2**attempt, 5))

        for e in events:
            self._offline.enqueue(e)
        if self.fail_open:
            return {"ok": False, "error": last_error, "queuedOffline": True}
        raise RuntimeError(f"telemetry flush failed: {last_error}")

    def get_offline_queue_size(self) -> int:
        return self._offline.size

    def close(self) -> None:
        self._closed = True
        self.flush()


def create_client(api_key: str, **kwargs: Any) -> AgentGuardClient:
    return AgentGuardClient(api_key, **kwargs)
