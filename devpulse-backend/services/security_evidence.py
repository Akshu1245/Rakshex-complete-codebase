"""Remove source-bearing evidence fields before storage or serialization."""
import json


def redact_scan_evidence(value):
    """Return a redacted copy; never mutate historical records or caller data.

    ponytail: this covers known scan-schema source fields, not arbitrary prose.
    New source-bearing fields must join this set or move to a typed safe DTO.
    """
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (ValueError, TypeError):
            return "[REDACTED]"
    if not isinstance(value, (dict, list)):
        return "[REDACTED]"

    def redact(item):
        if isinstance(item, dict):
            return {
                key: "[REDACTED]" if key in {"matched_text", "snippet", "code", "original_code", "fix_code"} else redact(val)
                for key, val in item.items()
            }
        if isinstance(item, list):
            return [redact(val) for val in item]
        return item

    return redact(value)
