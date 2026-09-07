# Portkey Models pricing ingestion

RaksHex uses Portkey Models as an upstream pricing candidate source, not as a runtime dependency.

## Trust boundary

Runtime settlement precedence remains:

1. provider-reported cost when available
2. RaksHex-local versioned model price
3. deterministic provider-specific fallback
4. conservative estimate

The gateway never calls Portkey during an AI request.

## Units

Portkey publishes cents per token. RaksHex stores USD per 1M tokens.

```text
USD_per_1M = cents_per_token × 10,000
```

Example: `0.00025` cents/token = `$2.50 / 1M` tokens.

## Sync behavior

`syncPortkeyPricing()`:

- fetches provider JSON with a 15s timeout
- rejects incomplete token-rate records rather than guessing
- compares against the newest local version for each model
- is dry-run unless `apply: true`
- appends changed rows with a new effective timestamp
- stores source metadata and URL
- never rewrites historical rows

The first supported upstream feeds are OpenAI, Anthropic, Azure OpenAI, and OpenRouter. Gemini/Google can be added once the RaksHex control-plane provider naming for Gemini vs Vertex is finalized.
