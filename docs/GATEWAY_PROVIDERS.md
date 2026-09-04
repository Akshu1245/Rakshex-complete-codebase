# Enforcement gateway providers

Last verified against source: 2026-09-04

The RaksHex enforcement gateway applies one fail-closed pipeline to every
provider it supports: workspace API key auth (`gateway:invoke`) → key-bound
principal resolution → kill switches → policy evaluation → atomic budget
reservation (including adaptive team pool borrowing when enabled) → credential
mediation → signed action receipt → provider call → usage extraction →
versioned-price settlement → universal usage envelope → attribution + usage
ledger.

Enforcement applies to **RaksHex-routed traffic only**. Traffic that bypasses
the gateway is not blocked by these controls.

## Provider matrix

| Provider     | Route / header                         | Endpoints                               | Settlement truth                                                                                                      |
| ------------ | -------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| OpenAI       | default / `x-rakshex-provider: openai` | `/v1/chat/completions`, `/v1/responses` | Verified token usage priced by the versioned registry                                                                 |
| Azure OpenAI | `x-rakshex-provider: azure_openai`     | `/v1/chat/completions`, `/v1/responses` | Registry or conservative estimate; `metadata.resourceEndpoint` must be a Microsoft-operated HTTPS host                |
| OpenRouter   | `x-rakshex-provider: openrouter`       | `/v1/chat/completions` only             | OpenRouter `usage.cost` (auto-requested) as provider-reconciled cost                                                  |
| Anthropic    | `/v1/messages`                         | `/v1/messages` (JSON + SSE streaming)   | Registry, thinking-token table fallback, or estimate                                                                  |
| ElevenLabs   | `/v1/text-to-speech/:voiceId`          | TTS                                     | Character accounting via `x-character-count` header; voice envelope uses `credit` units (characters), not fake tokens |

Arbitrary `openai_compatible` upstreams remain **fail-closed**.

## Dynamic team AI pool

Enable on the **workspace default budget** (`identityId = null`) by setting
`metadata.pool` when calling `teamGovernance.setBudget`:

```json
{
  "pool": {
    "enabled": true,
    "mode": "shareable",
    "maxBorrowUsd": 25,
    "approvalThresholdUsd": 20,
    "emergencyMinPriority": "critical",
    "emergencyReserveUsd": 100
  }
}
```

Per-identity budgets can expose shareable capacity:

```json
{
  "shareable": true,
  "protectedUsd": 20
}
```

When pool mode is active and the caller has an `identityId`, `reserveGatewayBudget`
plans capacity across personal → team shared → member shareable → emergency
reserve, then atomically reserves each slice in one transaction. Borrowed
amounts appear in `x-rakshex-pool-borrowed-usd` on allowed responses.

## Budget decisions: ALLOW / WARN / BLOCK

- **BLOCK** — reservation fails, kill switch active, pool shortfall, or policy deny.
- **WARN** — reservation succeeds past `warningPct`; headers:
  `x-rakshex-budget-warning`, `x-rakshex-budget-used-pct`, `x-rakshex-budget-remaining-usd`.
- **ALLOW** — everything else.

## Universal usage normalization

Every settled gateway call writes a `usageEnvelope` into
`team_ai_usage_events.metadata` via `buildUsageEnvelope`. Text providers record
tokens; ElevenLabs records characters as `credit` units in the `voice` domain.
USD remains the cross-provider budget control unit.

## Settlement precedence

1. `provider_reported` (OpenRouter)
2. `registry` (`model_price_versions`)
3. `table_fallback` (Anthropic thinking tokens, ElevenLabs character table)
4. `estimated_fallback` (conservative preflight)

## Not supported yet (honest states)

- OpenRouter `/v1/responses`.
- Provider-native hard limits beyond the capability catalog.
- Customer validation / paid pilots (operational, not code).
