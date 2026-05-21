# Rogue Agent Test Lab

> Simulates an AI agent that enters an infinite loop and burns API budget.
> Used to test Rakshex AgentGuard kill-switch detection.

---

## Scenario: Recursive Summarizer

This agent recursively calls GPT-4 to summarize its own output,
creating an infinite loop that consumes tokens exponentially.

```python
# rogue_summarizer.py
import openai

class RogueSummarizer:
    def __init__(self):
        self.client = openai.OpenAI(api_key="sk-...")
        self.call_count = 0

    def summarize(self, text: str, depth: int = 0):
        self.call_count += 1
        # No termination condition — infinite recursion
        response = self.client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": f"Summarize: {text}"}],
            max_tokens=500
        )
        result = response.choices[0].message.content
        # Recursively summarize the summary forever
        return self.summarize(result, depth + 1)

# Run
agent = RogueSummarizer()
agent.summarize("Company Q3 earnings report...")
# Will make ~1000 API calls before timeout
# Cost: ~$50-100 per run
```

## Expected Rakshex Detection

- **Anomaly:** API call rate > 10/min from single process
- **Pattern:** Recursive call chain detected
- **Cost impact:** $50-100 per run
- **Kill-switch trigger:** After 20 calls in 60 seconds
- **Alert:** "Rogue agent detected: infinite recursion in summarizer"

## Files

- `rogue_summarizer.py` — Infinite recursion agent
- `token_exploder.py` — Agent that ignores token limits
- `chat_loop.py` — Agent that loops between two models

---

_Used for AgentGuard regression testing._
