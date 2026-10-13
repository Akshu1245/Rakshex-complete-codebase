"""
Code Validator Service - Validates AI-generated Python code quality.

Implements validation rules from DevPulse AI Engine:
- Async function presence
- Main function with proper structure
- Error handling patterns
- No debug statements
- No incomplete TODO markers
"""
import re
from typing import Dict, Any, List
from dataclasses import dataclass


@dataclass
class ValidationResult:
    """Result of code validation."""
    is_valid: bool
    score: int  # 0-100 quality score
    passed_checks: List[str]
    failed_checks: List[str]
    suggestions: List[str]


# =============================================================================
# VALIDATION RULES
# =============================================================================

def check_has_async(code: str) -> bool:
    """Check if code contains async function definitions."""
    return bool(re.search(r'\basync\s+def\b', code))


def check_has_main(code: str) -> bool:
    """Check if code has a main() function or entry point."""
    has_main_func = bool(re.search(r'\bdef\s+main\s*\(', code))
    has_async_main = bool(re.search(r'\basync\s+def\s+main\s*\(', code))
    has_entry_point = bool(re.search(r'if\s+__name__\s*==\s*["\']__main__["\']\s*:', code))
    return (has_main_func or has_async_main) and has_entry_point


def check_has_error_handling(code: str) -> bool:
    """Check if code has try/except blocks."""
    return bool(re.search(r'\btry\s*:', code)) and bool(re.search(r'\bexcept\b', code))


def check_no_print_debug(code: str) -> bool:
    """Check that code doesn't use print() for debugging (allows structured logging)."""
    # Allow print() in main() for output, but flag excessive prints
    prints = re.findall(r'\bprint\s*\(', code)
    return len(prints) <= 5  # Allow up to 5 print statements for user output


def check_no_todo_comments(code: str) -> bool:
    """Check for incomplete TODO markers."""
    return not bool(re.search(r'#\s*TODO\b', code, re.IGNORECASE))


def check_has_imports(code: str) -> bool:
    """Check that code has necessary imports."""
    return bool(re.search(r'^(import|from)\s+', code, re.MULTILINE))


def check_has_httpx(code: str) -> bool:
    """Check for httpx usage (preferred async HTTP client)."""
    return bool(re.search(r'\bhttpx\b', code))


def check_has_timeout(code: str) -> bool:
    """Check for timeout parameter in HTTP calls."""
    return bool(re.search(r'\btimeout\s*=', code))


def check_no_hardcoded_secrets(code: str) -> bool:
    """Check for hardcoded API keys or secrets."""
    secret_patterns = [
        r'api_key\s*=\s*["\'][a-zA-Z0-9]{20,}["\']',
        r'secret\s*=\s*["\'][a-zA-Z0-9]{20,}["\']',
        r'password\s*=\s*["\'][^"\']{8,}["\']',
        r'token\s*=\s*["\'][a-zA-Z0-9]{20,}["\']',
    ]
    for pattern in secret_patterns:
        if re.search(pattern, code, re.IGNORECASE):
            return False
    return True


def check_uses_env_vars(code: str) -> bool:
    """Check if code uses environment variables for config."""
    return bool(re.search(r'os\.getenv|os\.environ|dotenv', code))


# =============================================================================
# MAIN VALIDATION FUNCTION
# =============================================================================

def validate_generated_code(code: str) -> ValidationResult:
    """
    Validate AI-generated code against quality rules.
    
    Args:
        code: Python code string to validate
        
    Returns:
        ValidationResult with score, passed/failed checks, and suggestions
    """
    if not code or not code.strip():
        return ValidationResult(
            is_valid=False,
            score=0,
            passed_checks=[],
            failed_checks=["Code is empty"],
            suggestions=["Generate code first before validating"]
        )
    
    # Define checks with weights
    checks = [
        ("has_async", check_has_async, 20, "Add async function definitions"),
        ("has_main", check_has_main, 15, "Add main() function with if __name__ == '__main__'"),
        ("has_error_handling", check_has_error_handling, 20, "Add try/except blocks for error handling"),
        ("has_imports", check_has_imports, 10, "Add necessary import statements"),
        ("no_print_debug", check_no_print_debug, 5, "Reduce print statements or use logging"),
        ("no_todo", check_no_todo_comments, 5, "Complete TODO items before deployment"),
        ("has_httpx", check_has_httpx, 10, "Use httpx.AsyncClient for HTTP calls"),
        ("has_timeout", check_has_timeout, 10, "Add timeout parameters to HTTP calls"),
        ("no_hardcoded_secrets", check_no_hardcoded_secrets, 15, "Use environment variables instead of hardcoded secrets"),
        ("uses_env_vars", check_uses_env_vars, 10, "Use os.getenv() for configuration"),
    ]
    
    passed_checks = []
    failed_checks = []
    suggestions = []
    total_score = 0
    max_score = sum(weight for _, _, weight, _ in checks)
    
    for name, check_func, weight, suggestion in checks:
        try:
            if check_func(code):
                passed_checks.append(name)
                total_score += weight
            else:
                failed_checks.append(name)
                suggestions.append(suggestion)
        except Exception:
            # If check fails, treat as failed
            failed_checks.append(name)
            suggestions.append(suggestion)
    
    # Normalize score to 0-100
    normalized_score = int((total_score / max_score) * 100)
    
    # Code is valid if score >= 60 and critical checks pass
    critical_checks = {"has_error_handling", "no_hardcoded_secrets"}
    critical_passed = critical_checks.issubset(set(passed_checks))
    is_valid = normalized_score >= 60 and critical_passed
    
    return ValidationResult(
        is_valid=is_valid,
        score=normalized_score,
        passed_checks=passed_checks,
        failed_checks=failed_checks,
        suggestions=suggestions[:5]  # Limit to top 5 suggestions
    )


# =============================================================================
# CODE REPAIR SUGGESTIONS
# =============================================================================

def get_repair_prompt(code: str, validation: ValidationResult) -> str:
    """
    Generate a prompt to repair code based on validation failures.
    
    Args:
        code: Original code
        validation: Validation result with failed checks
        
    Returns:
        Prompt string for AI to repair the code
    """
    if validation.is_valid:
        return ""
    
    issues = "\n".join(f"- {s}" for s in validation.suggestions)
    
    return f"""Fix the following Python code to address these issues:
{issues}

Original code:
```python
{code}
```

Requirements:
1. Keep all existing functionality
2. Add missing error handling with try/except
3. Use os.getenv() for any API keys
4. Ensure async functions are properly defined
5. Add timeout parameters to HTTP calls
6. Output only the fixed Python code, no markdown or explanation"""


def format_validation_response(validation: ValidationResult) -> Dict[str, Any]:
    """
    Format validation result for API response.
    
    Args:
        validation: ValidationResult object
        
    Returns:
        Dict suitable for JSON response
    """
    return {
        "is_valid": validation.is_valid,
        "score": validation.score,
        "passed_checks": validation.passed_checks,
        "failed_checks": validation.failed_checks,
        "suggestions": validation.suggestions,
        "grade": (
            "A" if validation.score >= 90 else
            "B" if validation.score >= 80 else
            "C" if validation.score >= 70 else
            "D" if validation.score >= 60 else
            "F"
        )
    }
