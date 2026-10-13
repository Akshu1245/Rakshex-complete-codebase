"""
Marketplace Service - Community template sharing and discovery.

Supports publishing, browsing, installing, and reviewing templates.
All data persisted to DB. Starter templates seeded on first access.
"""
import uuid
import json
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

_seeded = False

STARTER_TEMPLATES = [
    {
        "name": "Weather Dashboard", "description": "Real-time weather data aggregator using OpenWeatherMap + visual dashboard",
        "author": "DevPulse Team", "category": "weather", "tags": ["weather", "dashboard", "api"],
        "language": "python", "apis_used": ["OpenWeatherMap"], "version": "1.0.0", "verified": True,
        "code": '''import httpx, asyncio, os

async def get_weather(city: str = "London"):
    key = os.getenv("OPENWEATHER_API_KEY", "demo")
    async with httpx.AsyncClient() as client:
        r = await client.get(f"https://api.openweathermap.org/data/2.5/weather?q={city}&appid={key}&units=metric")
        r.raise_for_status()
        data = r.json()
        return {"city": data["name"], "temp": data["main"]["temp"], "desc": data["weather"][0]["description"]}

if __name__ == "__main__":
    print(asyncio.run(get_weather()))
''',
    },
    {
        "name": "GitHub Repo Monitor", "description": "Monitor GitHub repositories for new issues, PRs, and releases",
        "author": "DevPulse Team", "category": "devops", "tags": ["github", "monitoring", "ci-cd"],
        "language": "python", "apis_used": ["GitHub"], "version": "1.0.0", "verified": True,
        "code": '''import httpx, asyncio

async def check_repo(owner: str, repo: str):
    async with httpx.AsyncClient() as client:
        r = await client.get(f"https://api.github.com/repos/{owner}/{repo}")
        r.raise_for_status()
        data = r.json()
        return {"name": data["full_name"], "stars": data["stargazers_count"], "open_issues": data["open_issues_count"]}

if __name__ == "__main__":
    print(asyncio.run(check_repo("fastapi", "fastapi")))
''',
    },
    {
        "name": "Crypto Price Tracker", "description": "Track cryptocurrency prices with alerts using CoinGecko API",
        "author": "DevPulse Team", "category": "finance", "tags": ["crypto", "finance", "coingecko"],
        "language": "javascript", "apis_used": ["CoinGecko"], "version": "1.0.0", "verified": True,
        "code": '''async function getCryptoPrice(coinId = "bitcoin") {
  const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`);
  const data = await response.json();
  return { coin: coinId, price_usd: data[coinId]?.usd || 0 };
}

getCryptoPrice().then(console.log);
''',
    },
    {
        "name": "Multi-API Aggregator", "description": "Combine data from multiple APIs into a unified response",
        "author": "DevPulse Team", "category": "integration", "tags": ["multi-api", "aggregation"],
        "language": "python", "apis_used": ["GitHub", "CoinGecko", "OpenWeatherMap"], "version": "1.0.0", "verified": True,
        "code": '''import httpx, asyncio

async def aggregate():
    async with httpx.AsyncClient(timeout=10) as client:
        github, crypto, weather = await asyncio.gather(
            client.get("https://api.github.com"),
            client.get("https://api.coingecko.com/api/v3/ping"),
            client.get("https://api.openweathermap.org/data/2.5/weather?q=London&appid=demo"),
            return_exceptions=True,
        )
        return {
            "github": "ok" if not isinstance(github, Exception) else "error",
            "crypto": "ok" if not isinstance(crypto, Exception) else "error",
            "weather": "ok" if not isinstance(weather, Exception) else "error",
        }

if __name__ == "__main__":
    print(asyncio.run(aggregate()))
''',
    },
    {
        "name": "Slack Notification Bot", "description": "Send formatted notifications to Slack channels via webhooks",
        "author": "DevPulse Team", "category": "communication", "tags": ["slack", "notifications", "webhook"],
        "language": "python", "apis_used": ["Slack"], "version": "1.0.0", "verified": True,
        "code": '''import httpx, os, asyncio

async def notify_slack(message: str, channel: str = "#general"):
    webhook = os.getenv("SLACK_WEBHOOK_URL")
    if not webhook:
        return {"error": "SLACK_WEBHOOK_URL not set"}
    async with httpx.AsyncClient() as client:
        r = await client.post(webhook, json={"text": message, "channel": channel})
        return {"status": "sent" if r.status_code == 200 else "failed"}

if __name__ == "__main__":
    print(asyncio.run(notify_slack("Hello from DevPulse!")))
''',
    },
]


async def _seed_templates():
    """Seed starter templates if marketplace is empty."""
    global _seeded
    if _seeded:
        return
    from services.database import get_marketplace_templates_db, save_marketplace_template
    existing = await get_marketplace_templates_db(limit=1)
    if existing:
        _seeded = True
        return
    for t in STARTER_TEMPLATES:
        tid = f"tpl-{uuid.uuid4().hex[:8]}"
        await save_marketplace_template(
            tid, t["name"], t["description"], t["author"], None,
            t["category"], t["tags"], t["language"], t["apis_used"],
            t["code"], t["version"],
        )
    _seeded = True
    logger.info(f"[MARKETPLACE] Seeded {len(STARTER_TEMPLATES)} starter templates")


async def get_templates(category: Optional[str] = None,
                        language: Optional[str] = None,
                        search: Optional[str] = None) -> List[Dict[str, Any]]:
    """Get marketplace templates."""
    await _seed_templates()
    from services.database import get_marketplace_templates_db
    return await get_marketplace_templates_db(category, language, search)


async def get_template(template_id: str) -> Optional[Dict[str, Any]]:
    """Get a single template."""
    from services.database import get_marketplace_template_db
    return await get_marketplace_template_db(template_id)


async def publish_template(name: str, description: str, author: str,
                           author_id: Optional[int], category: str,
                           tags: List[str], language: str,
                           apis_used: List[str], code: str,
                           version: str = "1.0.0") -> Dict[str, Any]:
    """Publish a new template to the marketplace."""
    from services.database import save_marketplace_template
    tid = f"tpl-{uuid.uuid4().hex[:8]}"
    await save_marketplace_template(
        tid, name, description, author, author_id,
        category, tags, language, apis_used, code, version,
    )
    return {"id": tid, "name": name, "status": "published"}


async def install_template(template_id: str) -> Optional[Dict[str, Any]]:
    """Install (download) a template."""
    from services.database import get_marketplace_template_db, increment_template_downloads
    template = await get_marketplace_template_db(template_id)
    if not template:
        return None
    await increment_template_downloads(template_id)
    return {"status": "success", "code": template.get("code", ""),
            "name": template.get("name", ""), "language": template.get("language", "python")}


async def add_review(template_id: str, user_id: Optional[int],
                     rating: int, comment: str) -> Dict[str, Any]:
    """Add a review to a template."""
    from services.database import add_template_review
    if not 1 <= rating <= 5:
        return {"status": "error", "message": "Rating must be 1-5"}
    review_id = await add_template_review(template_id, user_id, rating, comment)
    return {"status": "success", "review_id": review_id}


async def get_marketplace_stats() -> Dict[str, Any]:
    """Get marketplace statistics."""
    await _seed_templates()
    from services.database import get_marketplace_templates_db
    templates = await get_marketplace_templates_db(limit=1000)
    total = len(templates)
    total_downloads = sum(t.get("downloads", 0) for t in templates)
    categories = list(set(t.get("category", "general") for t in templates))
    return {
        "total_templates": total, "total_downloads": total_downloads,
        "categories": categories, "category_count": len(categories),
    }
