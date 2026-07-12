from __future__ import annotations

from typing import Any, Callable

from .client import AgentGuardClient


def _wrap(
    guard: AgentGuardClient,
    provider: str,
    model: str,
    fn: Callable[[], Any],
    extract: Callable[[Any], dict[str, Any]],
    **kwargs: Any,
) -> Any:
    return guard.wrap_call(fn, provider=provider, model=model, extract_usage=extract, **kwargs)


def wrap_openai(guard: AgentGuardClient) -> dict[str, Any]:
    def chat_completions_create(client: Any, body: dict[str, Any], **opts: Any) -> Any:
        def extract(result: Any) -> dict[str, Any]:
            usage = getattr(result, "usage", None) or {}
            if isinstance(usage, dict):
                return {
                    "input_tokens": usage.get("prompt_tokens", 0),
                    "output_tokens": usage.get("completion_tokens", 0),
                }
            return {
                "input_tokens": getattr(usage, "prompt_tokens", 0) or 0,
                "output_tokens": getattr(usage, "completion_tokens", 0) or 0,
            }

        return _wrap(
            guard,
            "openai",
            body["model"],
            lambda: client.chat.completions.create(**body),
            extract,
            **opts,
        )

    return {"chat_completions_create": chat_completions_create}


def wrap_anthropic(guard: AgentGuardClient) -> dict[str, Any]:
    def messages_create(client: Any, body: dict[str, Any], **opts: Any) -> Any:
        def extract(result: Any) -> dict[str, Any]:
            usage = getattr(result, "usage", None) or {}
            return {
                "input_tokens": getattr(usage, "input_tokens", 0) or 0,
                "output_tokens": getattr(usage, "output_tokens", 0) or 0,
            }

        return _wrap(
            guard,
            "anthropic",
            body["model"],
            lambda: client.messages.create(**body),
            extract,
            **opts,
        )

    return {"messages_create": messages_create}


def wrap_gemini(guard: AgentGuardClient) -> dict[str, Any]:
    def generate_content(generate: Callable[..., Any], model: str, *args: Any, **opts: Any) -> Any:
        def extract(result: Any) -> dict[str, Any]:
            meta = getattr(result, "usage_metadata", None) or {}
            return {
                "input_tokens": getattr(meta, "prompt_token_count", 0) or 0,
                "output_tokens": getattr(meta, "candidates_token_count", 0) or 0,
            }

        return _wrap(guard, "gemini", model, lambda: generate(*args), extract, **opts)

    return {"generate_content": generate_content}


def wrap_azure_openai(guard: AgentGuardClient) -> dict[str, Any]:
    w = wrap_openai(guard)

    def chat_completions_create(client: Any, body: dict[str, Any], **opts: Any) -> Any:
        # Re-tag provider
        return guard.wrap_call(
            lambda: client.chat.completions.create(**body),
            provider="azure_openai",
            model=body["model"],
            extract_usage=lambda r: {
                "input_tokens": getattr(getattr(r, "usage", None), "prompt_tokens", 0) or 0,
                "output_tokens": getattr(getattr(r, "usage", None), "completion_tokens", 0) or 0,
            },
            **opts,
        )

    return {"chat_completions_create": chat_completions_create}


def wrap_bedrock(guard: AgentGuardClient) -> dict[str, Any]:
    def invoke_model(invoke: Callable[..., Any], model_id: str, *args: Any, **opts: Any) -> Any:
        return _wrap(
            guard,
            "bedrock",
            model_id,
            lambda: invoke(*args),
            lambda _r: {"input_tokens": 0, "output_tokens": 0},
            **opts,
        )

    return {"invoke_model": invoke_model}


def wrap_openrouter(guard: AgentGuardClient) -> dict[str, Any]:
    return wrap_openai(guard)  # OpenAI-compatible; capture re-tags if needed
