"""
Groq Client Service - AI-powered code generation via Groq API.

Implements complete input validation, API relevance detection,
and production-ready code generation with proper error handling.
"""
import os
import re
import json
import logging
from typing import Dict, List, Any, Tuple, Optional

import httpx

from services.code_validator import (
    validate_generated_code,
    get_repair_prompt,
    format_validation_response,
    ValidationResult
)

logger = logging.getLogger(__name__)

# =============================================================================
# CONSTANTS
# =============================================================================

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "mixtral-8x7b-32768"
XAI_API_URL = "https://api.x.ai/v1/chat/completions"
GROQ_TIMEOUT = httpx.Timeout(15.0)


def get_ai_provider_config(api_key: str) -> Tuple[str, str]:
    """
    Resolve provider endpoint and model from API key format.

    xAI keys start with "xai-" and use the xAI OpenAI-compatible endpoint.
    """
    if api_key.startswith("xai-"):
        return XAI_API_URL, os.getenv("XAI_MODEL", "grok-2-latest")
    return GROQ_API_URL, os.getenv("GROQ_MODEL", GROQ_MODEL)

# =============================================================================
# API KEYWORD MAPPING - Maps keywords to relevant APIs
# =============================================================================

API_KEYWORD_MAP: Dict[str, List[str]] = {
    # Weather APIs
    "weather": ["OpenWeatherMap"],
    "temperature": ["OpenWeatherMap"],
    "forecast": ["OpenWeatherMap"],
    "climate": ["OpenWeatherMap"],
    
    # Space APIs
    "space": ["NASA"],
    "nasa": ["NASA"],
    "astronomy": ["NASA"],
    "planet": ["NASA"],
    
    # Developer APIs
    "code": ["GitHub"],
    "repository": ["GitHub"],
    "github": ["GitHub"],
    "developer": ["GitHub"],
    "git": ["GitHub"],
    
    # Social Media
    "tweet": ["Twitter"],
    "twitter": ["Twitter"],
    "social media": ["Twitter"],
    "post": ["Twitter", "Reddit"],
    
    # Payment APIs
    "payment": ["Stripe"],
    "charge": ["Stripe"],
    "stripe": ["Stripe"],
    "billing": ["Stripe"],
    "invoice": ["Stripe"],
    
    # Communication - SMS
    "sms": ["Twilio"],
    "text message": ["Twilio"],
    "twilio": ["Twilio"],
    "phone": ["Twilio"],
    
    # Communication - Email
    "email": ["SendGrid"],
    "sendgrid": ["SendGrid"],
    "mail": ["SendGrid"],
    "newsletter": ["SendGrid"],
    
    # Music APIs
    "music": ["Spotify"],
    "spotify": ["Spotify"],
    "song": ["Spotify"],
    "playlist": ["Spotify"],
    "artist": ["Spotify"],
    
    # Location APIs
    "map": ["Google Maps"],
    "location": ["Google Maps"],
    "address": ["Google Maps"],
    "geocode": ["Google Maps"],
    "coordinates": ["Google Maps"],
    
    # Crypto APIs
    "crypto": ["CoinGecko"],
    "bitcoin": ["CoinGecko"],
    "ethereum": ["CoinGecko"],
    "coin": ["CoinGecko"],
    "price": ["CoinGecko"],
    
    # Reddit
    "reddit": ["Reddit"],
    "forum": ["Reddit"],
    "subreddit": ["Reddit"],
    
    # Slack
    "slack": ["Slack"],
    "workspace": ["Slack"],
    "channel": ["Slack"],
    "notify": ["Slack"],
    
    # Discord
    "discord": ["Discord"],
    "server": ["Discord"],
    "bot": ["Discord"],
    "guild": ["Discord"],
    
    # News APIs
    "news": ["NewsAPI"],
    "headline": ["NewsAPI"],
    "article": ["NewsAPI"],
    "breaking": ["NewsAPI"],
    
    # AI APIs
    "ai": ["OpenAI"],
    "openai": ["OpenAI"],
    "gpt": ["OpenAI"],
    "generate": ["OpenAI"],
    "language model": ["OpenAI"],
}


# =============================================================================
# INPUT SANITIZATION
# =============================================================================

def sanitize_input(text: str) -> Tuple[str, Optional[str]]:
    """
    Sanitize user input by removing dangerous content.
    
    Steps:
    1. Strip leading/trailing whitespace
    2. Remove HTML tags using regex
    3. Remove dangerous characters: semicolons, backticks, angle brackets
    
    Args:
        text: Raw input text
        
    Returns:
        Tuple of (sanitized_text, error_message or None)
    """
    if not text:
        return "", "Input cannot be empty"
    
    # Step 1: Strip whitespace
    sanitized = text.strip()
    
    # Step 2: Remove HTML tags
    sanitized = re.sub(r'<[^>]+>', '', sanitized)
    
    # Step 3: Remove dangerous characters
    # Remove semicolons, backticks, and remaining angle brackets
    sanitized = re.sub(r'[;`<>]', '', sanitized)
    
    # Final strip after removal
    sanitized = sanitized.strip()
    
    # Validate non-empty after sanitization
    if not sanitized:
        return "", "Input is empty after removing invalid characters"
    
    return sanitized, None


# =============================================================================
# API RELEVANCE DETECTION
# =============================================================================

def detect_relevant_apis(use_case: str) -> List[str]:
    """
    Scan use_case text for keywords and map to relevant APIs.
    
    Args:
        use_case: Sanitized use case description
        
    Returns:
        List of relevant API names (unique, ordered by detection)
    """
    use_case_lower = use_case.lower()
    detected_apis: List[str] = []
    
    for keyword, apis in API_KEYWORD_MAP.items():
        if keyword in use_case_lower:
            for api in apis:
                if api not in detected_apis:
                    detected_apis.append(api)
    
    # If no APIs detected, return empty list (caller handles this)
    return detected_apis[:5]  # Limit to 5 most relevant


# =============================================================================
# RESPONSE PROCESSING
# =============================================================================

def process_groq_response(content: str) -> Tuple[str, bool]:
    """
    Process and validate Groq API response.
    
    Steps:
    1. Strip markdown code fences if present (any language)
    2. Validate output contains code
    
    Args:
        content: Raw response content from Groq
        
    Returns:
        Tuple of (processed_code, is_valid)
    """
    if not content:
        return "", False
    
    code = content.strip()
    
    # Remove markdown code fences for any language
    # Handle ```language ... ``` format
    import re as _re
    fence_match = _re.match(r'^```\w*\n?(.*?)```$', code, _re.DOTALL)
    if fence_match:
        code = fence_match.group(1).strip()
    elif code.startswith("```"):
        # Fallback: remove leading/trailing fences
        lines = code.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        code = "\n".join(lines).strip()
    
    # Validate: must have some substantial content
    is_valid = len(code) > 20 and "\n" in code
    
    return code, is_valid


# =============================================================================
# LANGUAGE-SPECIFIC PROMPTS
# =============================================================================

LANGUAGE_PROMPTS: Dict[str, Dict[str, str]] = {
    "python": {
        "system": (
            "You are a senior Python developer specializing in async API integration. "
            "Generate only Python code. No markdown. No explanation. No comments except "
            "inline code comments. Output must be valid, runnable Python."
        ),
        "requirements": (
            "Requirements:\n"
            "1. Use httpx.AsyncClient for all HTTP calls\n"
            "2. Every function has try/except with specific exception handling\n"
            "3. timeout=10 on all HTTP calls\n"
            "4. Each API gets its own async function\n"
            "5. A main() async orchestrator function that calls all APIs and combines results\n"
            "6. Print results clearly\n"
            "7. if __name__ == '__main__': asyncio.run(main())\n"
            "8. Handle rate limits with retry logic (max 3 retries, exponential backoff)"
        ),
    },
    "javascript": {
        "system": (
            "You are a senior JavaScript developer specializing in API integration. "
            "Generate only modern JavaScript (ES2022+) code using fetch or axios. No markdown. No explanation. "
            "Output must be valid, runnable Node.js JavaScript."
        ),
        "requirements": (
            "Requirements:\n"
            "1. Use fetch or axios for all HTTP calls\n"
            "2. Every function has try/catch with specific error handling\n"
            "3. Use async/await throughout\n"
            "4. Each API gets its own async function\n"
            "5. A main() async function that calls all APIs and combines results\n"
            "6. console.log results clearly\n"
            "7. Use AbortController with timeout for HTTP calls\n"
            "8. Handle rate limits with retry logic (max 3 retries, exponential backoff)"
        ),
    },
    "typescript": {
        "system": (
            "You are a senior TypeScript developer specializing in API integration. "
            "Generate only TypeScript code with proper type annotations. No markdown. No explanation. "
            "Output must be valid, compilable TypeScript."
        ),
        "requirements": (
            "Requirements:\n"
            "1. Use fetch or axios for all HTTP calls with typed responses\n"
            "2. Define interfaces for all API response types\n"
            "3. Every function has try/catch with specific error handling\n"
            "4. Use async/await throughout\n"
            "5. Each API gets its own async function with return types\n"
            "6. A main() async function that orchestrates everything\n"
            "7. Use AbortController with timeout for HTTP calls\n"
            "8. Handle rate limits with retry logic (max 3 retries, exponential backoff)"
        ),
    },
    "java": {
        "system": (
            "You are a senior Java developer specializing in API integration. "
            "Generate only Java code using java.net.http.HttpClient. No markdown. No explanation. "
            "Output must be valid, compilable Java 17+."
        ),
        "requirements": (
            "Requirements:\n"
            "1. Use java.net.http.HttpClient for all HTTP calls\n"
            "2. Every method has try/catch with specific exception handling\n"
            "3. Set timeouts on all HTTP calls\n"
            "4. Each API gets its own method\n"
            "5. A main() method that orchestrates calls and prints results\n"
            "6. Use CompletableFuture for async operations where applicable\n"
            "7. Use Jackson or Gson for JSON parsing\n"
            "8. Handle rate limits with retry logic"
        ),
    },
    "go": {
        "system": (
            "You are a senior Go developer specializing in API integration. "
            "Generate only Go code. No markdown. No explanation. "
            "Output must be valid, compilable Go."
        ),
        "requirements": (
            "Requirements:\n"
            "1. Use net/http or resty for all HTTP calls\n"
            "2. Every function returns errors properly\n"
            "3. Use context.WithTimeout for all HTTP calls\n"
            "4. Each API gets its own function\n"
            "5. A main() function that orchestrates everything\n"
            "6. Use goroutines and channels for concurrent API calls\n"
            "7. Use encoding/json for JSON parsing\n"
            "8. Handle rate limits with retry logic and backoff"
        ),
    },
    "rust": {
        "system": (
            "You are a senior Rust developer specializing in API integration. "
            "Generate only Rust code using reqwest. No markdown. No explanation. "
            "Output must be valid, compilable Rust."
        ),
        "requirements": (
            "Requirements:\n"
            "1. Use reqwest for all HTTP calls\n"
            "2. Use proper Result<T, E> error handling throughout\n"
            "3. Set timeouts on all HTTP calls\n"
            "4. Each API gets its own async function\n"
            "5. Use tokio::main for the entry point\n"
            "6. Use serde for JSON deserialization with derive macros\n"
            "7. Use tokio::join! for concurrent API calls\n"
            "8. Handle rate limits with retry logic"
        ),
    },
}


# =============================================================================
# GROQ API CLIENT
# =============================================================================

async def call_groq_api(use_case: str, apis: List[str], language: str = "python") -> Dict[str, Any]:
    """
    Call Groq API to generate integration code.
    
    Args:
        use_case: Sanitized use case description
        apis: List of relevant API names
        
    Returns:
        Dict with code, apis_used, tokens_used, status, and optional message
    """
    api_key = os.getenv("GROQ_API_KEY", "")
    
    if not api_key or len(api_key) < 10:
        logger.warning("GROQ_API_KEY not configured or invalid")
        return {
            "code": "",
            "apis_used": apis,
            "tokens_used": 0,
            "status": "fallback",
            "message": "AI service not configured. Set GROQ_API_KEY environment variable."
        }

    ai_url, ai_model = get_ai_provider_config(api_key)
    
    # Build API list string
    apis_list = ", ".join(apis) if apis else "general async patterns"
    
    # Get language-specific prompts
    lang_config = LANGUAGE_PROMPTS.get(language, LANGUAGE_PROMPTS["python"])
    system_prompt = lang_config["system"]
    requirements = lang_config["requirements"]
    
    user_prompt = f"""Generate complete {language} integration code for this use case: {use_case}

APIs to integrate: {apis_list}

{requirements}"""

    request_body = {
        "model": ai_model,
        "temperature": 0.2,
        "max_tokens": 1500,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    try:
        async with httpx.AsyncClient(timeout=GROQ_TIMEOUT) as client:
            response = await client.post(
                ai_url,
                headers=headers,
                json=request_body
            )
            response.raise_for_status()
            
            try:
                data = response.json()
            except json.JSONDecodeError:
                logger.error("Groq API returned invalid JSON")
                return {
                    "code": "",
                    "apis_used": apis,
                    "tokens_used": 0,
                    "status": "fallback",
                    "message": "AI response format error. Try again."
                }
            
            # Extract content
            choices = data.get("choices", [])
            if not choices:
                logger.error("Groq response missing choices")
                return {
                    "code": "",
                    "apis_used": apis,
                    "tokens_used": 0,
                    "status": "fallback",
                    "message": "AI returned empty response. Try again."
                }
            
            raw_content = choices[0].get("message", {}).get("content", "")
            
            # Extract token usage
            usage = data.get("usage", {})
            tokens_used = usage.get("total_tokens", 0)
            
            # Process and validate response
            processed_code, is_valid = process_groq_response(raw_content)
            
            if not is_valid:
                logger.warning("Groq response failed validation")
                return {
                    "code": "",
                    "apis_used": apis,
                    "tokens_used": tokens_used,
                    "status": "fallback",
                    "message": "AI generated invalid code format. Try again."
                }
            
            # Validate code quality
            validation = validate_generated_code(processed_code)
            
            return {
                "code": processed_code,
                "apis_used": apis,
                "tokens_used": tokens_used,
                "status": "success",
                "language": language,
                "validation": format_validation_response(validation)
            }
            
    except httpx.TimeoutException:
        logger.warning("Groq API request timed out")
        return {
            "code": "",
            "apis_used": apis,
            "tokens_used": 0,
            "status": "fallback",
            "message": "AI engine timeout. Try again."
        }
    
    except httpx.ConnectError:
        logger.warning("Groq API connection error")
        return {
            "code": "",
            "apis_used": apis,
            "tokens_used": 0,
            "status": "fallback",
            "message": "AI service unreachable. Try again."
        }
        
    except httpx.HTTPStatusError as e:
        status_code = e.response.status_code
        logger.error(f"Groq API HTTP error: {status_code}")
        
        if status_code == 401:
            message = "AI service authentication failed. Check API key."
        elif status_code == 429:
            message = "AI service rate limited. Try again in a moment."
        elif status_code >= 500:
            message = "AI service temporarily unavailable."
        else:
            message = f"AI service error (HTTP {status_code})."
        
        return {
            "code": "",
            "apis_used": apis,
            "tokens_used": 0,
            "status": "fallback",
            "message": message
        }
        
    except httpx.RequestError as e:
        logger.error(f"Groq API request error: {e}")
        return {
            "code": "",
            "apis_used": apis,
            "tokens_used": 0,
            "status": "fallback",
            "message": "AI temporarily unavailable."
        }
        
    except KeyError as e:
        logger.error(f"Groq API response parsing error: {e}")
        return {
            "code": "",
            "apis_used": apis,
            "tokens_used": 0,
            "status": "fallback",
            "message": "AI response format error. Try again."
        }
        
    except Exception as e:
        logger.error(f"Unexpected error calling Groq API: {e}")
        return {
            "code": "",
            "apis_used": apis,
            "tokens_used": 0,
            "status": "fallback",
            "message": "AI temporarily unavailable."
        }


# =============================================================================
# AUTO-REPAIR FUNCTION
# =============================================================================

async def repair_code(code: str, validation: ValidationResult, apis: List[str]) -> Dict[str, Any]:
    """
    Attempt to repair code that failed validation.
    
    Args:
        code: Original generated code
        validation: Validation result with failures
        apis: List of APIs being used
        
    Returns:
        Dict with repaired code or error message
    """
    if validation.is_valid:
        return {"code": code, "repaired": False}
    
    repair_prompt = get_repair_prompt(code, validation)
    if not repair_prompt:
        return {"code": code, "repaired": False}
    
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key or len(api_key) < 10:
        return {"code": code, "repaired": False, "message": "Cannot repair without API key"}

    ai_url, ai_model = get_ai_provider_config(api_key)
    
    request_body = {
        "model": ai_model,
        "temperature": 0.1,  # Lower temperature for repairs
        "max_tokens": 2000,
        "messages": [
            {
                "role": "system",
                "content": "You are a code repair expert. Fix the provided code. Output only valid Python code, no markdown or explanation."
            },
            {"role": "user", "content": repair_prompt}
        ]
    }
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    try:
        async with httpx.AsyncClient(timeout=GROQ_TIMEOUT) as client:
            response = await client.post(
                ai_url,
                headers=headers,
                json=request_body
            )
            response.raise_for_status()
            
            data = response.json()
            raw_content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            repaired_code, is_valid = process_groq_response(raw_content)
            
            if is_valid and repaired_code:
                # Re-validate repaired code
                new_validation = validate_generated_code(repaired_code)
                if new_validation.score > validation.score:
                    return {
                        "code": repaired_code,
                        "repaired": True,
                        "validation": format_validation_response(new_validation)
                    }
            
            # Repair failed, return original
            return {"code": code, "repaired": False}
            
    except Exception as e:
        logger.warning(f"Code repair failed: {e}")
        return {"code": code, "repaired": False}


# =============================================================================
# MAIN GENERATE FUNCTION
# =============================================================================

async def generate_code(use_case: str, language: str = "python", auto_repair: bool = True) -> Dict[str, Any]:
    """
    Generate production-ready Python integration code.
    
    This is the main entry point called by the /api/generate endpoint.
    Implements full validation, API detection, and code generation.
    
    Args:
        use_case: Raw use case description from user
        
    Returns:
        Success: {"code": str, "apis_used": list, "tokens_used": int, "status": "success"}
        Fallback: {"code": "", "apis_used": list, "status": "fallback", "message": str}
        Error: {"code": "", "apis_used": [], "status": "error", "message": str}
    """
    try:
        # Step 1: Sanitize input
        sanitized, error = sanitize_input(use_case)
        if error:
            return {
                "code": "",
                "apis_used": [],
                "tokens_used": 0,
                "status": "error",
                "message": error
            }
        
        # Step 2: Detect relevant APIs
        relevant_apis = detect_relevant_apis(sanitized)
        
        if not relevant_apis:
            # No specific APIs detected - use generic coding approach
            relevant_apis = ["OpenAI"]  # Default to OpenAI for general code gen
        
        # Step 3: Call Groq API
        result = await call_groq_api(sanitized, relevant_apis, language=language)
        
        # Step 4: Auto-repair if enabled and validation failed
        if auto_repair and result.get("status") == "success" and result.get("code"):
            validation = result.get("validation", {})
            if not validation.get("is_valid", True):
                # Attempt repair
                from services.code_validator import validate_generated_code as revalidate
                current_validation = revalidate(result["code"])
                repair_result = await repair_code(
                    result["code"],
                    current_validation,
                    relevant_apis
                )
                if repair_result.get("repaired"):
                    result["code"] = repair_result["code"]
                    result["validation"] = repair_result.get("validation", validation)
                    result["auto_repaired"] = True
        
        return result
        
    except Exception as e:
        # Catch-all: never crash, never return 500
        logger.error(f"Unexpected error in generate_code: {e}")
        return {
            "code": "",
            "apis_used": [],
            "tokens_used": 0,
            "status": "error",
            "message": "An unexpected error occurred. Please try again."
        }


# =============================================================================
# DOCUMENTATION SEARCH (kept for backwards compatibility)
# =============================================================================

async def search_docs(question: str) -> Dict[str, Any]:
    """
    Search documentation and answer questions.
    
    Returns dict with summary, sources, and status.
    """
    default_sources = [
        "https://docs.python.org/3/library/asyncio.html",
        "https://fastapi.tiangolo.com/",
        "https://www.python-httpx.org/",
    ]
    
    try:
        sanitized, error = sanitize_input(question)
        if error:
            return {
                "summary": f"Invalid question: {error}",
                "sources": [],
                "status": "error"
            }
        
        api_key = os.getenv("GROQ_API_KEY", "")
        
        if not api_key or len(api_key) < 10:
            return {
                "summary": f"To get AI-powered answers about '{sanitized}', configure GROQ_API_KEY.",
                "sources": default_sources,
                "status": "fallback"
            }
        
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
                    "max_tokens": 1000,
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a technical documentation expert. Provide clear, accurate answers about APIs and programming. Be concise."
                        },
                        {
                            "role": "user",
                            "content": sanitized
                        }
                    ]
                }
            )
            response.raise_for_status()
            
            try:
                data = response.json()
            except json.JSONDecodeError:
                return {
                    "summary": "AI returned invalid response format.",
                    "sources": default_sources,
                    "status": "fallback"
                }
            
            summary = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            if not summary:
                return {
                    "summary": "AI returned empty response. Please try again.",
                    "sources": default_sources,
                    "status": "fallback"
                }
            
            return {
                "summary": summary,
                "sources": default_sources,
                "status": "success"
            }
            
    except httpx.TimeoutException:
        return {
            "summary": "AI service timed out. Please try again.",
            "sources": default_sources,
            "status": "fallback"
        }
    
    except httpx.ConnectError:
        return {
            "summary": "AI service unreachable. Please try again.",
            "sources": default_sources,
            "status": "fallback"
        }
        
    except httpx.HTTPStatusError:
        return {
            "summary": "AI service temporarily unavailable.",
            "sources": default_sources,
            "status": "fallback"
        }
        
    except Exception as e:
        logger.error(f"Docs search error: {e}")
        return {
            "summary": "An error occurred. Please try again.",
            "sources": default_sources,
            "status": "error"
        }


# =============================================================================
# LEGACY COMPATIBILITY - GroqClient class wrapper
# =============================================================================

class GroqClient:
    """Legacy wrapper for backwards compatibility."""
    
    async def generate_code(self, use_case: str) -> Dict[str, Any]:
        return await generate_code(use_case)
    
    async def search_docs(self, question: str) -> Dict[str, Any]:
        return await search_docs(question)


# Global singleton for legacy imports
groq_client = GroqClient()
