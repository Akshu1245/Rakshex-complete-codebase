"""
Standalone Web Search Engine — Portable, zero DevPulse dependency.
Uses Tavily API for AI-powered search. Works from any project.

Usage:
    from research.web_search import search_web
    results = search_web("latest TypeScript features", max_results=5)

Or CLI:
    python research/web_search.py "your query" --depth advanced --max 10
"""
import os
import json
import sys
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path
from typing import Any

TAVILY_API_URL = "https://api.tavily.com/search"


def get_api_key() -> str | None:
    key = os.environ.get("TAVILY_API_KEY")
    if key:
        return key
    for env_path in [Path.home() / ".devpulse" / ".env", Path.cwd() / ".env"]:
        if env_path.exists():
            for line in env_path.read_text().split("\n"):
                if line.startswith("TAVILY_API_KEY="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


def search_web(
    query: str,
    search_depth: str = "basic",
    max_results: int = 10,
    include_domains: list[str] | None = None,
    exclude_domains: list[str] | None = None,
    days: int | None = None,
    include_answer: bool = False,
    include_raw: bool = False,
) -> dict[str, Any]:
    api_key = get_api_key()
    if not api_key:
        return {"error": "TAVILY_API_KEY not configured.", "results": []}

    body = {
        "api_key": api_key,
        "query": query,
        "search_depth": search_depth,
        "max_results": max_results,
        "include_answer": include_answer or search_depth == "advanced",
        "include_raw_content": include_raw or search_depth == "advanced",
        "include_images": False,
    }
    if include_domains:
        body["include_domains"] = include_domains
    if exclude_domains:
        body["exclude_domains"] = exclude_domains
    if days:
        body["days"] = days

    try:
        req = urllib.request.Request(
            TAVILY_API_URL,
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return {
            "query": data.get("query", query),
            "results": data.get("results", []),
            "answer": data.get("answer"),
            "response_time": data.get("response_time", 0),
            "result_count": len(data.get("results", [])),
            "timestamp": datetime.now().isoformat(),
        }
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")[:500]
        return {"error": f"HTTP {e.code}: {error_body}", "results": []}
    except Exception as e:
        return {"error": str(e), "results": []}


def format_results(results: dict) -> str:
    lines = []
    lines.append(f"## Web Search: \"{results.get('query', '')}\"")
    lines.append(f"*{results.get('result_count', 0)} results in {results.get('response_time', 0)}ms*")
    lines.append("")
    if results.get("answer"):
        lines.append("### Answer")
        lines.append(results["answer"])
        lines.append("")
    lines.append("### Results")
    for i, r in enumerate(results.get("results", [])):
        title = r.get("title", "Untitled")
        url = r.get("url", "")
        score = r.get("score", 0)
        content = r.get("content", "")[:500]
        published = r.get("published_date", "")
        lines.append(f"**{i+1}. [{title}]({url})** - Relevance: {int(score*100)}%")
        if published:
            lines.append(f"   *Published: {published}*")
        lines.append(f"   {content}")
        lines.append("")
    return "\n".join(lines)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python web_search.py <query> [--depth basic|advanced] [--max N]")
        sys.exit(1)
    query = sys.argv[1]
    depth = "basic"
    max_results = 10
    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == "--depth" and i + 1 < len(sys.argv):
            depth = sys.argv[i + 1]; i += 2
        elif sys.argv[i] == "--max" and i + 1 < len(sys.argv):
            max_results = int(sys.argv[i + 1]); i += 2
        else:
            i += 1
    results = search_web(query, search_depth=depth, max_results=max_results)
    print(format_results(results))
