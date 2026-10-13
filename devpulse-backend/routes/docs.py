"""
Docs Routes - Documentation search and Q&A endpoint.

Implements parallel async searches across 3 sources (Wikipedia, DuckDuckGo, Semantic Scholar),
combines results, and uses Groq AI to produce developer-focused answers.
Each source is isolated - failures don't affect other sources.
"""
import os
import re
import json
import asyncio
import logging
import urllib.parse
from typing import Dict, Any, List, Optional, Tuple

import httpx
from fastapi import APIRouter, Request
from pydantic import BaseModel, Field, field_validator

logger = logging.getLogger(__name__)

router = APIRouter()


# =============================================================================
# CONSTANTS
# =============================================================================

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "mixtral-8x7b-32768"
XAI_API_URL = "https://api.x.ai/v1/chat/completions"
SEARCH_TIMEOUT = httpx.Timeout(8.0)
GROQ_TIMEOUT = httpx.Timeout(15.0)


def get_ai_provider_config(api_key: str) -> Tuple[str, str]:
    """Resolve endpoint/model for Groq or xAI based on key format."""
    if api_key.startswith("xai-"):
        return XAI_API_URL, os.getenv("XAI_MODEL", "grok-2-latest")
    return GROQ_API_URL, os.getenv("GROQ_MODEL", GROQ_MODEL)


# =============================================================================
# REQUEST MODEL WITH VALIDATION
# =============================================================================

class DocsSearchRequest(BaseModel):
    """Request model for documentation search endpoint."""
    question: str = Field(..., min_length=1, max_length=300)
    
    @field_validator("question")
    @classmethod
    def validate_and_sanitize(cls, v: str) -> str:
        """
        Sanitize question input.
        
        Steps:
        1. Strip whitespace
        2. Remove HTML tags
        3. Remove special characters (keep alphanumeric, spaces, basic punctuation)
        4. Validate non-empty
        """
        if not v:
            raise ValueError("question cannot be empty")
        
        # Strip whitespace
        sanitized = v.strip()
        
        # Remove HTML tags
        sanitized = re.sub(r'<[^>]+>', '', sanitized)
        
        # Remove dangerous/special characters but keep basic punctuation
        # Keep: alphanumeric, spaces, . , ? ! ' " - _
        sanitized = re.sub(r'[;`<>{}()\[\]\\|^~]', '', sanitized)
        
        # Final strip
        sanitized = sanitized.strip()
        
        if not sanitized:
            raise ValueError("question is empty after removing invalid characters")
        
        return sanitized


# =============================================================================
# PARALLEL SEARCH FUNCTIONS
# =============================================================================

async def search_wikipedia(query: str) -> Optional[Tuple[str, str]]:
    """
    Search Wikipedia for a topic summary.
    
    Args:
        query: Search query (already sanitized)
        
    Returns:
        Tuple of (label, text) or None on any error
    """
    try:
        encoded_query = urllib.parse.quote(query)
        url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{encoded_query}"
        
        async with httpx.AsyncClient(timeout=SEARCH_TIMEOUT) as client:
            response = await client.get(
                url,
                headers={"User-Agent": "DevPulse/1.0"}
            )
            
            if response.status_code == 404:
                logger.debug(f"Wikipedia: No article found for '{query}'")
                return None
            
            response.raise_for_status()
            data = response.json()
            
            extract = data.get("extract", "")
            if not extract:
                return None
            
            # Truncate to 500 chars
            if len(extract) > 500:
                extract = extract[:500] + "..."
            
            return ("Wikipedia", extract)
            
    except httpx.TimeoutException:
        logger.warning(f"Wikipedia search timed out for: {query}")
        return None
    except httpx.ConnectError:
        logger.warning(f"Wikipedia connection error for: {query}")
        return None
    except httpx.HTTPStatusError as e:
        logger.warning(f"Wikipedia HTTP error {e.response.status_code}")
        return None
    except json.JSONDecodeError:
        logger.warning(f"Wikipedia returned invalid JSON for: {query}")
        return None
    except Exception as e:
        logger.warning(f"Wikipedia search error: {e}")
        return None


async def search_duckduckgo(query: str) -> Optional[Tuple[str, str]]:
    """
    Search DuckDuckGo Instant Answer API.
    
    Args:
        query: Search query (already sanitized)
        
    Returns:
        Tuple of (label, text) or None on any error
    """
    try:
        encoded_query = urllib.parse.quote(query)
        url = f"https://api.duckduckgo.com/?q={encoded_query}&format=json&no_html=1&skip_disambig=1"
        
        async with httpx.AsyncClient(timeout=SEARCH_TIMEOUT) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
            
            # Try AbstractText first
            abstract_text = data.get("AbstractText", "")
            if abstract_text and len(abstract_text.strip()) > 10:
                text = abstract_text.strip()
                if len(text) > 500:
                    text = text[:500] + "..."
                return ("DuckDuckGo", text)
            
            # Fall back to first RelatedTopic
            related_topics = data.get("RelatedTopics", [])
            if related_topics and len(related_topics) > 0:
                first_topic = related_topics[0]
                if isinstance(first_topic, dict):
                    topic_text = first_topic.get("Text", "")
                    if topic_text and len(topic_text.strip()) > 10:
                        text = topic_text.strip()
                        if len(text) > 500:
                            text = text[:500] + "..."
                        return ("DuckDuckGo", text)
            
            return None
            
    except httpx.TimeoutException:
        logger.warning(f"DuckDuckGo search timed out for: {query}")
        return None
    except httpx.ConnectError:
        logger.warning(f"DuckDuckGo connection error for: {query}")
        return None
    except httpx.HTTPStatusError as e:
        logger.warning(f"DuckDuckGo HTTP error {e.response.status_code}")
        return None
    except json.JSONDecodeError:
        logger.warning(f"DuckDuckGo returned invalid JSON for: {query}")
        return None
    except Exception as e:
        logger.warning(f"DuckDuckGo search error: {e}")
        return None


async def search_semantic_scholar(query: str) -> Optional[Tuple[str, str]]:
    """
    Search Semantic Scholar for academic papers.
    
    Args:
        query: Search query (already sanitized)
        
    Returns:
        Tuple of (label, text) or None on any error
    """
    try:
        encoded_query = urllib.parse.quote(query)
        url = f"https://api.semanticscholar.org/graph/v1/paper/search?query={encoded_query}&fields=title,abstract&limit=2"
        
        async with httpx.AsyncClient(timeout=SEARCH_TIMEOUT) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
            
            papers = data.get("data", [])
            if not papers:
                return None
            
            # Get first paper with abstract
            for paper in papers:
                title = paper.get("title", "")
                abstract = paper.get("abstract", "")
                
                if title and abstract:
                    # Truncate abstract to 300 chars
                    if len(abstract) > 300:
                        abstract = abstract[:300] + "..."
                    
                    text = f"{title} — {abstract}"
                    return ("Semantic Scholar", text)
            
            return None
            
    except httpx.TimeoutException:
        logger.warning(f"Semantic Scholar search timed out for: {query}")
        return None
    except httpx.ConnectError:
        logger.warning(f"Semantic Scholar connection error for: {query}")
        return None
    except httpx.HTTPStatusError as e:
        logger.warning(f"Semantic Scholar HTTP error {e.response.status_code}")
        return None
    except json.JSONDecodeError:
        logger.warning(f"Semantic Scholar returned invalid JSON for: {query}")
        return None
    except Exception as e:
        logger.warning(f"Semantic Scholar search error: {e}")
        return None


# =============================================================================
# GROQ SUMMARIZATION
# =============================================================================

async def summarize_with_groq(question: str, context: str, sources: List[str]) -> Dict[str, Any]:
    """
    Use Groq AI to summarize search results into a developer-focused answer.
    
    Args:
        question: Original user question
        context: Combined context from all sources
        sources: List of source names that returned data
        
    Returns:
        Dict with summary, sources, source_count, status
    """
    api_key = os.getenv("GROQ_API_KEY", "")
    
    if not api_key or len(api_key) < 10:
        # No API key - return context as-is or fallback
        if context and context != "No external sources available.":
            return {
                "summary": f"Based on available sources:\n\n{context[:1000]}",
                "sources": sources,
                "source_count": len(sources),
                "status": "success"
            }
        return {
            "summary": "Documentation service temporarily unavailable. Please check official documentation.",
            "sources": [],
            "source_count": 0,
            "status": "fallback"
        }
    
    system_prompt = (
        "You are a technical documentation assistant for developers. "
        "Summarize provided context into a clear, structured, concise answer. "
        "Use plain English. No fluff. Bullet points only if listing multiple items."
    )
    
    user_prompt = (
        f"Developer question: {question}\n\n"
        f"Context:\n{context}\n\n"
        f"Provide a clear, accurate answer in 3-5 sentences. "
        f"If context is insufficient, answer from your own knowledge."
    )
    
    try:
        async with httpx.AsyncClient(timeout=GROQ_TIMEOUT) as client:
            ai_url, ai_model = get_ai_provider_config(api_key)
            response = await client.post(
                ai_url,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": ai_model,
                    "temperature": 0.3,
                    "max_tokens": 500,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ]
                }
            )
            response.raise_for_status()
            data = response.json()
            
            summary = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            if not summary:
                # Empty response - use context as fallback
                if context and context != "No external sources available.":
                    summary = f"Based on available sources:\n\n{context[:1000]}"
                else:
                    summary = "Documentation service temporarily unavailable. Please check official documentation."
            
            return {
                "summary": summary.strip(),
                "sources": sources,
                "source_count": len(sources),
                "status": "success"
            }
            
    except httpx.TimeoutException:
        logger.warning("Groq summarization timed out")
        # Fallback: return raw context
        if context and context != "No external sources available.":
            return {
                "summary": f"AI summarization timed out. Raw results:\n\n{context[:1000]}",
                "sources": sources,
                "source_count": len(sources),
                "status": "fallback"
            }
        return {
            "summary": "Documentation search is temporarily unavailable. Please check official docs.",
            "sources": [],
            "source_count": 0,
            "status": "fallback"
        }
        
    except httpx.ConnectError:
        logger.warning("Groq connection error")
        if context and context != "No external sources available.":
            return {
                "summary": f"AI service unreachable. Raw results:\n\n{context[:1000]}",
                "sources": sources,
                "source_count": len(sources),
                "status": "fallback"
            }
        return {
            "summary": "Documentation search is temporarily unavailable. Please check official docs.",
            "sources": [],
            "source_count": 0,
            "status": "fallback"
        }
        
    except httpx.HTTPStatusError as e:
        logger.warning(f"Groq HTTP error {e.response.status_code}")
        if context and context != "No external sources available.":
            return {
                "summary": f"AI unavailable. Raw results:\n\n{context[:1000]}",
                "sources": sources,
                "source_count": len(sources),
                "status": "fallback"
            }
        return {
            "summary": "Documentation search is temporarily unavailable. Please check official docs.",
            "sources": [],
            "source_count": 0,
            "status": "fallback"
        }
    
    except json.JSONDecodeError:
        logger.warning("Groq returned invalid JSON")
        if context and context != "No external sources available.":
            return {
                "summary": f"AI response parsing error. Raw results:\n\n{context[:1000]}",
                "sources": sources,
                "source_count": len(sources),
                "status": "fallback"
            }
        return {
            "summary": "Documentation service temporarily unavailable.",
            "sources": [],
            "source_count": 0,
            "status": "fallback"
        }
        
    except Exception as e:
        logger.error(f"Groq summarization error: {e}")
        if context and context != "No external sources available.":
            return {
                "summary": f"Error during summarization. Raw results:\n\n{context[:1000]}",
                "sources": sources,
                "source_count": len(sources),
                "status": "fallback"
            }
        return {
            "summary": "Documentation service temporarily unavailable.",
            "sources": [],
            "source_count": 0,
            "status": "fallback"
        }


# =============================================================================
# MAIN ENDPOINT
# =============================================================================

@router.post("/api/docs")
async def search_docs(request: DocsSearchRequest) -> Dict[str, Any]:
    """
    Search documentation across multiple sources and return AI-summarized answer.
    
    Performs parallel searches across:
    - Wikipedia
    - DuckDuckGo Instant Answer
    - Semantic Scholar
    
    Combines results and uses Groq AI to produce a developer-focused answer.
    Each source is isolated - one failure doesn't affect others.
    
    Request Body:
        {"question": str} - Developer question (1-300 chars)
    
    Returns:
        {
            "summary": str,      - AI-generated or fallback summary
            "sources": [str],    - List of sources that returned data
            "source_count": int, - Number of successful sources
            "status": str        - "success" or "fallback"
        }
    
    Never returns HTTP 500. All errors are handled gracefully.
    """
    try:
        question = request.question
        
        # =================================================================
        # STEP 1: Execute parallel searches
        # =================================================================
        search_tasks = [
            search_wikipedia(question),
            search_duckduckgo(question),
            search_semantic_scholar(question)
        ]
        
        # gather with return_exceptions=True ensures no single failure crashes everything
        results = await asyncio.gather(*search_tasks, return_exceptions=True)
        
        # =================================================================
        # STEP 2: Filter and combine results
        # =================================================================
        successful_results: List[Tuple[str, str]] = []
        sources_used: List[str] = []
        
        for result in results:
            # Skip exceptions and None results
            if isinstance(result, Exception):
                logger.warning(f"Search task raised exception: {result}")
                continue
            if result is None:
                continue
            if isinstance(result, tuple) and len(result) == 2:
                label, text = result
                if text and len(text.strip()) > 0:
                    successful_results.append((label, text))
                    sources_used.append(label)
        
        # Build combined context
        if successful_results:
            context_parts = [f"[{label}]: {text}" for label, text in successful_results]
            context = "\n\n".join(context_parts)
        else:
            context = "No external sources available."
        
        logger.info(f"Doc search for '{question[:50]}...' returned {len(sources_used)} sources: {sources_used}")
        
        # =================================================================
        # STEP 3: Summarize with Groq
        # =================================================================
        result = await summarize_with_groq(question, context, sources_used)
        
        return result
        
    except ValueError as e:
        # Validation errors
        logger.warning(f"Docs validation error: {e}")
        return {
            "summary": f"Invalid question: {str(e)}",
            "sources": [],
            "source_count": 0,
            "status": "error"
        }
        
    except Exception as e:
        # Catch-all: never return 500
        logger.error(f"Unexpected error in docs endpoint: {e}")
        return {
            "summary": "Documentation service temporarily unavailable.",
            "sources": [],
            "source_count": 0,
            "status": "fallback"
        }


# =============================================================================
# HEALTH CHECK FOR DOCS SERVICE
# =============================================================================

@router.get("/api/docs/health")
async def docs_health() -> Dict[str, Any]:
    """
    Check health of documentation search service.
    
    Tests connectivity to all 3 search sources.
    """
    try:
        health_tasks = [
            search_wikipedia("Python programming"),
            search_duckduckgo("Python programming"),
            search_semantic_scholar("machine learning")
        ]
        
        results = await asyncio.gather(*health_tasks, return_exceptions=True)
        
        sources_status = {}
        for i, (name, result) in enumerate(zip(
            ["Wikipedia", "DuckDuckGo", "Semantic Scholar"],
            results
        )):
            if isinstance(result, Exception):
                sources_status[name] = "error"
            elif result is None:
                sources_status[name] = "no_data"
            else:
                sources_status[name] = "healthy"
        
        healthy_count = sum(1 for s in sources_status.values() if s == "healthy")
        
        return {
            "status": "healthy" if healthy_count >= 2 else "degraded" if healthy_count >= 1 else "down",
            "sources": sources_status,
            "healthy_sources": healthy_count,
            "total_sources": 3
        }
        
    except Exception as e:
        logger.error(f"Docs health check error: {e}")
        return {
            "status": "error",
            "sources": {},
            "healthy_sources": 0,
            "total_sources": 3
        }
