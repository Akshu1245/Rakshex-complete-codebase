"""
Standalone Social Media Search Engine — Portable, zero dependencies.
Searches across Twitter/X, Reddit, LinkedIn, GitHub, ProductHunt, and News.
Uses multiple free/API backends. Works from any project.

Usage:
    from research.social_search import search_social
    results = search_social("AI observability", sources=["twitter", "reddit", "github"])

Or CLI:
    python research/social_search.py "AI security" --sources twitter,reddit,news --days 7
"""
import json
import sys
import urllib.request
import urllib.error
import os
from datetime import datetime
from pathlib import Path
from typing import Any


# ── Source-specific search implementations ─────────────────────────────────

def _search_reddit(query: str, max_results: int = 10, days: int = 30) -> list[dict]:
    """Search Reddit via public JSON API (no key needed)."""
    results = []
    try:
        url = f"https://www.reddit.com/search.json?q={urllib.parse.quote(query)}&limit={max_results}&sort=relevance&t={'month' if days > 7 else 'week'}"
        req = urllib.request.Request(url, headers={"User-Agent": "DevPulse-Research/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        for child in data.get("data", {}).get("children", []):
            d = child["data"]
            results.append({
                "title": d.get("title", ""),
                "url": f"https://reddit.com{d.get('permalink', '')}",
                "content": d.get("selftext", "")[:500],
                "score": d.get("score", 0),
                "comments": d.get("num_comments", 0),
                "subreddit": d.get("subreddit", ""),
                "published": datetime.fromtimestamp(d.get("created_utc", 0)).isoformat(),
                "source": "reddit",
            })
    except Exception as e:
        pass
    return results


def _search_hackernews(query: str, max_results: int = 10) -> list[dict]:
    """Search Hacker News via Algolia API (no key needed)."""
    results = []
    try:
        url = f"https://hn.algolia.com/api/v1/search?query={urllib.parse.quote(query)}&hitsPerPage={max_results}"
        req = urllib.request.Request(url, headers={"User-Agent": "DevPulse-Research/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        for hit in data.get("hits", []):
            results.append({
                "title": hit.get("title", ""),
                "url": hit.get("url", f"https://news.ycombinator.com/item?id={hit.get('objectID')}"),
                "content": hit.get("story_text", hit.get("comment_text", ""))[:500],
                "score": hit.get("points", 0),
                "comments": hit.get("num_comments", 0),
                "author": hit.get("author", ""),
                "published": hit.get("created_at", ""),
                "source": "hackernews",
            })
    except Exception as e:
        pass
    return results


def _search_github(query: str, max_results: int = 10, days: int = 30) -> list[dict]:
    """Search GitHub repositories and issues (public API, optional token for higher rate limit)."""
    results = []
    headers = {"User-Agent": "DevPulse-Research/1.0", "Accept": "application/vnd.github.v3+json"}
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    # Search repos
    try:
        date_filter = f" pushed:>={datetime.now().strftime('%Y-%m-%d')}" if days <= 1 else ""
        url = f"https://api.github.com/search/repositories?q={urllib.parse.quote(query)}{date_filter}&sort=stars&per_page={max_results}"
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        for item in data.get("items", []):
            results.append({
                "title": item.get("full_name", ""),
                "url": item.get("html_url", ""),
                "content": item.get("description", "")[:500],
                "score": item.get("stargazers_count", 0),
                "language": item.get("language", ""),
                "topics": item.get("topics", []),
                "published": item.get("updated_at", ""),
                "source": "github",
            })
    except Exception:
        pass
    return results


def _search_producthunt(query: str, max_results: int = 10) -> list[dict]:
    """Search ProductHunt (via public scraping — requires API token for official API)."""
    results = []
    token = os.environ.get("PRODUCTHUNT_TOKEN")
    if not token:
        return results
    try:
        url = "https://api.producthunt.com/v2/api/graphql"
        gql = {
            "query": """
            query($query: String!, $first: Int!) {
                posts(search: $query, first: $first) {
                    edges { node { id name tagline url votesCount createdAt } }
                }
            }""",
            "variables": {"query": query, "first": max_results},
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(gql).encode("utf-8"),
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        for edge in data.get("data", {}).get("posts", {}).get("edges", []):
            node = edge["node"]
            results.append({
                "title": node.get("name", ""),
                "url": node.get("url", ""),
                "content": node.get("tagline", "")[:300],
                "score": node.get("votesCount", 0),
                "published": node.get("createdAt", ""),
                "source": "producthunt",
            })
    except Exception:
        pass
    return results


def _search_news(query: str, max_results: int = 10) -> list[dict]:
    """Search news via NewsAPI (requires free API key)."""
    results = []
    api_key = os.environ.get("NEWSAPI_KEY")
    if not api_key:
        return results
    try:
        url = f"https://newsapi.org/v2/everything?q={urllib.parse.quote(query)}&pageSize={max_results}&sortBy=relevancy&apiKey={api_key}"
        req = urllib.request.Request(url, headers={"User-Agent": "DevPulse-Research/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        for article in data.get("articles", []):
            results.append({
                "title": article.get("title", ""),
                "url": article.get("url", ""),
                "content": (article.get("description") or "")[:500],
                "author": article.get("author", ""),
                "published": article.get("publishedAt", ""),
                "source_name": article.get("source", {}).get("name", ""),
                "source": "news",
            })
    except Exception:
        pass
    return results


# ── Main search function ────────────────────────────────────────────────────

SOURCE_MAP = {
    "reddit": _search_reddit,
    "hackernews": _search_hackernews,
    "github": _search_github,
    "producthunt": _search_producthunt,
    "news": _search_news,
    "twitter": None,  # requires paid API (X API v2)
    "linkedin": None,  # requires LinkedIn API access
}


def search_social(
    query: str,
    sources: list[str] | None = None,
    max_results: int = 10,
    days: int = 30,
) -> dict[str, Any]:
    """Search across social media and developer platforms.

    Args:
        query: The search query
        sources: Which platforms to search. Default: ['reddit', 'hackernews', 'github']
                 Available: reddit, hackernews, github, producthunt, news, twitter*, linkedin*
                 (* requires API key)
        max_results: Max results per source
        days: Only results from last N days

    Returns:
        Dict with results grouped by source, plus metadata.
    """
    if sources is None:
        sources = ["reddit", "hackernews", "github"]

    all_results = {}
    total = 0
    errors = []

    for source in sources:
        if source not in SOURCE_MAP:
            errors.append(f"Unknown source: {source}")
            continue
        if SOURCE_MAP[source] is None:
            errors.append(f"Source '{source}' requires paid API key — skipped")
            continue

        try:
            func = SOURCE_MAP[source]
            if source in ("hackernews", "producthunt"):
                results = func(query, max_results)
            else:
                results = func(query, max_results, days)
            all_results[source] = results
            total += len(results)
        except Exception as e:
            errors.append(f"{source}: {e}")

    return {
        "query": query,
        "sources_searched": sources,
        "total_results": total,
        "results_by_source": all_results,
        "errors": errors,
        "timestamp": datetime.now().isoformat(),
    }


def format_social_results(results: dict) -> str:
    """Format social search results as readable text."""
    lines = []
    lines.append(f"## Social Media Search: \"{results['query']}\"")
    lines.append(f"*{results['total_results']} results across {len(results['results_by_source'])} platforms*")
    lines.append("")

    for source, items in results["results_by_source"].items():
        lines.append(f"### {source.upper()} ({len(items)} results)")
        for item in items[:10]:
            lines.append(f"- **[{item['title'][:100]}]({item['url']})**")
            if item.get("score"):
                lines.append(f"  Score: {item['score']} | Comments: {item.get('comments', 0)}")
            if item.get("content"):
                lines.append(f"  {item['content'][:200]}")
            lines.append("")
        lines.append("")

    if results.get("errors"):
        lines.append("### Notes")
        for err in results["errors"]:
            lines.append(f"- {err}")

    return "\n".join(lines)


# ── CLI ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python social_search.py <query> [--sources src1,src2] [--max N] [--days N]")
        print("Sources: reddit, hackernews, github, producthunt, news")
        print("Example: python social_search.py \"AI security\" --sources reddit,github,news --days 7")
        sys.exit(1)

    query = sys.argv[1]
    sources = ["reddit", "hackernews", "github"]
    max_results = 10
    days = 30

    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == "--sources" and i + 1 < len(sys.argv):
            sources = [s.strip() for s in sys.argv[i + 1].split(",")]
            i += 2
        elif sys.argv[i] == "--max" and i + 1 < len(sys.argv):
            max_results = int(sys.argv[i + 1]); i += 2
        elif sys.argv[i] == "--days" and i + 1 < len(sys.argv):
            days = int(sys.argv[i + 1]); i += 2
        else:
            i += 1

    results = search_social(query, sources=sources, max_results=max_results, days=days)
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    print(format_social_results(results))
