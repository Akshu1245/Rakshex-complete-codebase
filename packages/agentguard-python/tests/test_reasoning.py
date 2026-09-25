from rakshex_agentguard.reasoning import (
    detect_reasoning_tokens,
    differential_reasoning_tokens,
    is_reasoning_anomaly,
    reasoning_spend_line_item,
)


def test_direct_openai_field_wins():
    usage = {
        "prompt_tokens": 500,
        "completion_tokens": 300,
        "total_tokens": 2000,
        "completion_tokens_details": {"reasoning_tokens": 1200},
    }
    assert detect_reasoning_tokens("o3", usage) == {"tokens": 1200, "method": "direct"}


def test_direct_anthropic_field():
    usage = {"input_tokens": 100, "output_tokens": 50, "thinking_tokens": 400}
    assert detect_reasoning_tokens("claude-3-7-sonnet", usage) == {
        "tokens": 400,
        "method": "direct",
    }


def test_differential_fallback():
    usage = {"prompt_tokens": 500, "completion_tokens": 300, "total_tokens": 2000}
    assert detect_reasoning_tokens("o3", usage) == {"tokens": 1200, "method": "differential"}


def test_none_when_reconciled():
    usage = {"prompt_tokens": 500, "completion_tokens": 300, "total_tokens": 800}
    assert detect_reasoning_tokens("gpt-4o", usage) == {"tokens": 0, "method": "none"}


def test_differential_needs_all_parts():
    assert differential_reasoning_tokens(1000, 0, 100) == 0
    assert differential_reasoning_tokens(None, 100, 100) == 0


def test_anomaly_threshold():
    assert is_reasoning_anomaly(901, 300) is True
    assert is_reasoning_anomaly(900, 300) is False
    assert is_reasoning_anomaly(10, 0) is True


def test_line_item_priced_and_flagged_as_breakout():
    usage = {
        "prompt_tokens": 500,
        "completion_tokens": 500,
        "completion_tokens_details": {"reasoning_tokens": 1000},
    }
    item = reasoning_spend_line_item("o3", usage, output_per_million_usd=40.0)
    assert item is not None
    assert item["kind"] == "reasoning_spend"
    assert item["reasoning_tokens"] == 1000
    assert item["cost_usd"] == round((1000 / 1_000_000) * 40.0, 6)
    assert item["confidence"] == "exact"
    assert item["overhead_multiplier"] == 2.0
    assert item["is_anomaly"] is False
    assert item["breakout_of_output_tokens"] is True


def test_line_item_none_without_detection():
    usage = {"prompt_tokens": 500, "completion_tokens": 300, "total_tokens": 800}
    assert reasoning_spend_line_item("gpt-4o", usage) is None
