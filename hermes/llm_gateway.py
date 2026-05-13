"""
Hermes LLM Gateway — Python bridge to the same providers as server/_core/providers.ts.
Reads .env for API keys. Agents call invoke_llm() to actually execute tasks.
Supports: OpenAI, Anthropic, MiniMax, Forge/Gemini, Google Gemini.
"""
import json
import os
import re
import time
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError

DEVPULSE_ROOT = Path(__file__).resolve().parent.parent


def _load_env() -> dict:
    env_file = DEVPULSE_ROOT / ".env"
    env = dict(os.environ)
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").split("\n"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip('"').strip("'")
                if v and v not in ("your_", "sk-your", "sk-ant-your"):
                    env[k] = v
    return env


ENV = _load_env()


def _get_openai_client():
    api_key = ENV.get("OPENAI_API_KEY", "")
    if not api_key or api_key.startswith("sk-your"):
        return None
    return {"key": api_key, "url": "https://api.openai.com/v1/chat/completions", "model": "gpt-4o"}


def _get_anthropic_client():
    api_key = ENV.get("ANTHROPIC_API_KEY", "")
    if not api_key or api_key.startswith("sk-ant-your"):
        return None
    return {"key": api_key, "url": "https://api.anthropic.com/v1/messages", "model": "claude-sonnet-4-20250514"}


def _get_minimax_client():
    api_key = ENV.get("MINIMAX_API_KEY", "")
    if not api_key or api_key == "your_minimax_api_key":
        return None
    url = ENV.get("MINIMAX_API_URL", "https://api.minimax.io/v1").rstrip("/")
    return {"key": api_key, "url": f"{url}/chat/completions", "model": "MiniMax-M2.7"}


def _get_forge_client():
    api_key = ENV.get("BUILT_IN_FORGE_API_KEY", "")
    if not api_key or api_key == "your_forge_api_key":
        return None
    url = ENV.get("BUILT_IN_FORGE_API_URL", "https://forge.manus.im").rstrip("/")
    return {"key": api_key, "url": f"{url}/v1/chat/completions", "model": "gemini-2.5-flash"}


def _get_google_client():
    api_key = ENV.get("GOOGLE_API_KEY", "") or ENV.get("GEMINI_API_KEY", "")
    if not api_key:
        return None
    return {"key": api_key, "url": "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", "model": "gemini-2.5-flash"}


PROVIDERS = [
    ("openai", _get_openai_client),
    ("anthropic", _get_anthropic_client),
    ("minimax", _get_minimax_client),
    ("google", _get_google_client),
    ("forge", _get_forge_client),
]


def _get_provider() -> tuple[str, dict] | None:
    for name, fn in PROVIDERS:
        client = fn()
        if client:
            return name, client
    return None


def invoke_llm(
    system_prompt: str,
    user_message: str,
    max_tokens: int = 4096,
    model: str | None = None,
    tools: list[dict] | None = None,
) -> str:
    """Invoke LLM with system + user messages. Returns response text."""
    provider_info = _get_provider()
    if not provider_info:
        return f"[LLM UNAVAILABLE] No API key configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or MINIMAX_API_KEY in .env"

    provider_name, client = provider_info

    if provider_name == "openai":
        return _invoke_openai(client, system_prompt, user_message, max_tokens, model, tools)
    elif provider_name == "anthropic":
        return _invoke_anthropic(client, system_prompt, user_message, max_tokens, model, tools)
    elif provider_name == "google":
        return _invoke_google(client, system_prompt, user_message, max_tokens)
    elif provider_name in ("minimax", "forge"):
        return _invoke_openai_compat(client, system_prompt, user_message, max_tokens, model)
    return "[LLM ERROR] Unknown provider"


def _invoke_openai(client, system, user, max_tokens, model, tools):
    payload = {
        "model": model or client["model"],
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "max_tokens": max_tokens,
    }
    if tools:
        payload["tools"] = tools

    req = Request(
        client["url"],
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {client['key']}", "Content-Type": "application/json"},
    )
    try:
        resp = urlopen(req, timeout=120)
        data = json.loads(resp.read())
        return data["choices"][0]["message"]["content"]
    except Exception as e:
        return f"[LLM ERROR] OpenAI: {e}"


def _invoke_anthropic(client, system, user, max_tokens, model, tools):
    payload = {
        "model": model or client["model"],
        "system": system,
        "messages": [{"role": "user", "content": user}],
        "max_tokens": max_tokens,
    }
    if tools:
        payload["tools"] = tools

    req = Request(
        client["url"],
        data=json.dumps(payload).encode(),
        headers={"x-api-key": client["key"], "anthropic-version": "2023-06-01", "Content-Type": "application/json"},
    )
    try:
        resp = urlopen(req, timeout=120)
        data = json.loads(resp.read())
        return data["content"][0]["text"]
    except Exception as e:
        return f"[LLM ERROR] Anthropic: {e}"


def _invoke_google(client, system, user, max_tokens):
    url = f"{client['url']}?key={client['key']}"
    payload = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {"maxOutputTokens": max_tokens},
    }
    req = Request(url, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    try:
        resp = urlopen(req, timeout=120)
        data = json.loads(resp.read())
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        return f"[LLM ERROR] Google: {e}"


def _invoke_openai_compat(client, system, user, max_tokens, model):
    payload = {
        "model": model or client["model"],
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "max_tokens": max_tokens,
    }
    req = Request(
        client["url"],
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {client['key']}", "Content-Type": "application/json"},
    )
    try:
        resp = urlopen(req, timeout=120)
        data = json.loads(resp.read())
        content = data["choices"][0]["message"]["content"]
        return re.sub(r"<think>[\s\S]*?</think>", "", content, flags=re.IGNORECASE).strip()
    except Exception as e:
        return f"[LLM ERROR] Compat: {e}"


def check_availability() -> dict:
    """Return which providers are configured."""
    result = {}
    for name, fn in PROVIDERS:
        client = fn()
        result[name] = bool(client)
    return result


if __name__ == "__main__":
    print("LLM Gateway Availability:")
    for k, v in check_availability().items():
        print(f"  {k:<12} {'READY' if v else 'MISSING KEY'}")
