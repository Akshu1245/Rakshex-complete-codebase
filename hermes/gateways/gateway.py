"""
Hermes Telegram Gateway — Summon any DevPulse agent from Telegram.
Uses python-telegram-bot for long-polling (no public HTTPS needed).
"""
import asyncio
import json
import os
from datetime import datetime, timezone
from pathlib import Path

DEVPULSE_ROOT = Path(__file__).resolve().parent.parent.parent
HERMES_ROOT = DEVPULSE_ROOT / "hermes"
CONFIG_FILE = HERMES_ROOT / "gateways" / "gateway_config.json"

DEFAULT_CONFIG = {
    "telegram": {
        "enabled": False,
        "token": "YOUR_BOT_TOKEN_HERE",
        "allowed_users": [],
        "polling_interval": 2,
    },
    "slack": {
        "enabled": False,
        "bot_token": "xoxb-YOUR-BOT-TOKEN",
        "app_token": "xapp-YOUR-APP-TOKEN",
        "allowed_channels": [],
    },
}


def load_config() -> dict:
    if CONFIG_FILE.exists():
        return json.loads(CONFIG_FILE.read_text())
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.write_text(json.dumps(DEFAULT_CONFIG, indent=2))
    return DEFAULT_CONFIG


AGENT_ALIASES = {
    "pulse": "PULSE-COMMAND",
    "ceo": "CEO-STRATEGY",
    "cto": "CTO-ARCHITECT",
    "cpo": "CPO-PRODUCT",
    "vp": "VP-ENGINEERING",
    "em": "EM-DELIVERY",
    "qa": "QA-LEAD",
    "backend": "DEV-BACKEND",
    "frontend": "DEV-FRONTEND",
    "vscode": "DEV-VSCODE",
    "db": "DEV-DATABASE",
    "database": "DEV-DATABASE",
    "api": "DEV-API",
    "security": "DEV-SECURITY",
    "devops": "DEV-DEVOPS",
    "fullstack": "DEV-FULLSTACK",
    "tester": "QA-TESTER",
    "docs": "DOCS-WRITER",
    "review": "REVIEWER",
    "bug": "BUG-HUNTER",
    "release": "OPS-RELEASE",
    "monitor": "OPS-MONITOR",
    "factory": "AGENT-FACTORY",
    "research": "RESEARCH-ORCHESTRATOR",
    "recovery": "ERROR-RECOVERY",
    "deps": "DEPENDENCY-GUARDIAN",
    "steward": "API-STEWARD",
    "competitor": "COMPETITIVE-WATCH",
    "perf": "PERFORMANCE-AUDITOR",
    "hermes": "HERMES",
}


async def telegram_polling(event_queue: asyncio.Queue):
    """Long-polling Telegram bot that routes messages to DevPulse agents."""
    try:
        from telegram import Update
        from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
    except ImportError:
        print("[Hermes/Telegram] python-telegram-bot not installed — gateway disabled")
        print("[Hermes/Telegram] Install: pip install python-telegram-bot")
        return

    config = load_config()
    tg_config = config.get("telegram", {})
    if not tg_config.get("enabled"):
        print("[Hermes/Telegram] Gateway disabled in config")
        return

    token = tg_config.get("token", "")
    if not token or token == "YOUR_BOT_TOKEN_HERE":
        print("[Hermes/Telegram] No bot token configured")
        return

    allowed = set(tg_config.get("allowed_users", []))

    async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not update.message or not update.message.text:
            return

        user_id = str(update.effective_user.id)
        if allowed and user_id not in allowed:
            await update.message.reply_text("Access denied")
            return

        text = update.message.text.strip()
        chat_id = str(update.effective_chat.id)

        # Parse agent targeting: /agent_name task description
        agent_target = None
        content = text

        if text.startswith("/"):
            parts = text[1:].split(maxsplit=1)
            cmd = parts[0].lower()
            task_text = parts[1] if len(parts) > 1 else "status"

            if cmd in AGENT_ALIASES:
                agent_target = AGENT_ALIASES[cmd]
                content = task_text
            elif cmd == "agents":
                agent_list = "\n".join(f"/{a} — {n}" for a, n in AGENT_ALIASES.items() if a != "hermes")
                await update.message.reply_text(f"Available agents:\n{agent_list}")
                return
            elif cmd == "status":
                agent_target = "PULSE-COMMAND"
                content = "status report"
            elif cmd == "help":
                help_text = (
                    "Hermes + DevPulse Telegram Gateway\n\n"
                    "Commands:\n"
                    "/agent_name task — Route task to specific agent\n"
                    "/agents — List all 28 agents\n"
                    "/status — Get swarm status\n"
                    "/help — Show this help\n\n"
                    "Or just send a message — Hermes routes it automatically."
                )
                await update.message.reply_text(help_text)
                return

        # Queue event
        from hermes.agent_loop import GatewayEvent
        event = GatewayEvent(
            source="telegram",
            event_type="message",
            user_id=user_id,
            chat_id=chat_id,
            content=content,
            agent_target=agent_target,
            timestamp=datetime.now(timezone.utc),
        )
        await event_queue.put(event)

        # Typing indicator — agent is thinking
        await context.bot.send_chat_action(chat_id=chat_id, action="typing")
        await update.message.reply_text(
            f"Task routed → {agent_target or 'AUTO-DETECT'}\n{content[:100]}..."
        )

    app = Application.builder().token(token).build()
    app.add_handler(CommandHandler(
        list(AGENT_ALIASES.keys()) + ["agents", "status", "help", "start"],
        handle_message
    ))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    print(f"[Hermes/Telegram] Gateway active — polling started")
    await app.run_polling()


async def slack_gateway(event_queue: asyncio.Queue):
    """Slack Socket Mode gateway — no public HTTPS needed."""
    try:
        from slack_bolt.app.async_app import AsyncApp
        from slack_bolt.adapter.socket_mode.async_handler import AsyncSocketModeHandler
    except ImportError:
        print("[Hermes/Slack] slack-bolt not installed — gateway disabled")
        print("[Hermes/Slack] Install: pip install slack-bolt")
        return

    config = load_config()
    sl_config = config.get("slack", {})
    if not sl_config.get("enabled"):
        print("[Hermes/Slack] Gateway disabled in config")
        return

    bot_token = sl_config.get("bot_token", "")
    app_token = sl_config.get("app_token", "")
    if not bot_token or bot_token.startswith("xoxb-YOUR"):
        print("[Hermes/Slack] No bot token configured")
        return

    app = AsyncApp(token=bot_token)
    allowed_channels = set(sl_config.get("allowed_channels", []))

    @app.event("message")
    async def handle_message(event, say):
        if event.get("subtype"):
            return  # skip bot messages, edits, etc.

        channel = event.get("channel", "")
        if allowed_channels and channel not in allowed_channels:
            return

        text = event.get("text", "").strip()
        user = event.get("user", "unknown")

        agent_target = None
        content = text

        # Parse /agent_name syntax
        if text.startswith("/hermes "):
            parts = text[8:].split(maxsplit=1)
            cmd = parts[0].lower()
            task = parts[1] if len(parts) > 1 else "status"
            if cmd in AGENT_ALIASES:
                agent_target = AGENT_ALIASES[cmd]
                content = task
            elif cmd == "agents":
                agent_list = " | ".join(f"`/{a}` → {n}" for a, n in AGENT_ALIASES.items() if a != "hermes")
                await say(f"*28 DevPulse Agents:*\n{agent_list}")
                return

        from hermes.agent_loop import GatewayEvent
        event_obj = GatewayEvent(
            source="slack",
            event_type="message",
            user_id=user,
            chat_id=channel,
            content=content,
            agent_target=agent_target,
            timestamp=datetime.now(timezone.utc),
        )
        await event_queue.put(event_obj)
        await say(f"Task routed → `{agent_target or 'AUTO-DETECT'}`\n>{content[:150]}...")

    @app.command("/hermes-help")
    async def help_command(ack, say):
        await ack()
        await say(
            "*Hermes + DevPulse Slack Gateway*\n\n"
            "`/hermes agents` — List all 28 agents\n"
            "`/hermes backend implement rate limiting` — Route to DEV-BACKEND\n"
            "`/hermes review check PR #42` — Route to REVIEWER\n"
            "`/hermes security audit dependencies` — Route to DEV-SECURITY\n"
            "Just DM me — Hermes auto-routes your task."
        )

    print(f"[Hermes/Slack] Gateway active — Socket Mode connected")
    handler = AsyncSocketModeHandler(app, app_token)
    await handler.start_async()


# Export for agent_loop.py
__all__ = ["telegram_polling", "slack_gateway", "AGENT_ALIASES", "load_config"]
