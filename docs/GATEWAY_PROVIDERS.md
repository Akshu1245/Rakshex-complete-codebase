# Enforcement gateway providers

Last verified against source: 2026-09-03

The RaksHex enforcement gateway applies one fail-closed pipeline to every
provider it supports: workspace API key auth (`gateway:invoke`) → key-bound
principal resolution → kill switches → policy evaluation → atomic budget
reservation → credential mediation → signed action receipt → provider call →
usage extraction → versioned-price settlement → attribution + usage ledger.

Enforcement applies to **RaksHex-routed traffic only**. Traffic that bypasses
the gateway is not blocked by these controls.

## Provider matrix

| Provider     | `x-rakshex-provider`       | Endpoints                               | Upstream origin                                                                                                                                                                               | Auth to provider | Streaming | Settlement truth                                                                                                                     |
| ------------ | -------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| OpenAI       | `openai` (default)         | `/v1/chat/completions`, `/v1/responses` | Pinned `https://api.openai.com`                                                                                                                                                               | Bearer           | Yes       | Verified token usage priced by the versioned registry                                                                                |
| Azure OpenAI | `azure_openai`             | `/v1/chat/completions`, `/v1/responses` | Provider-account `metadata.resourceEndpoint`; HTTPS host must end in `.openai.azure.com`, `.services.ai.azure.com`, or `.cognitiveservices.azure.com` (Azure v1 API, model = deployment name) | `api-key` header | Yes       | Verified token usage priced by the versioned registry; conservative estimate when the deployment/model has no registry row           |
| OpenRouter   | `openrouter`               | `/v1/chat/completions` only             | Pinned `https://openrouter.ai/api`                                                                                                                                                            | Bearer           | Yes       | OpenRouter usage accounting (`usage.cost`, requested automatically) recorded as provider-reconciled cost; registry/estimate fallback |
| Anthropic    | (own route) `/v1/messages` | `/v1/messages`                          | Pinned `https://api.anthropic.com`                                                                                                                                                            | `x-api-key`      | Not yet   | Verified token usage priced by the versioned registry, then the maintained thinking-token table, then the conservative estimate      |

Arbitrary `openai_compatible` upstreams remain **fail-closed**: the gateway
refuses to send a mediated credential to an origin it cannot pin or
domain-validate.

## Budget decisions: ALLOW / WARN / BLOCK

- **BLOCK** — a hard `gateway` budget reservation fails atomically, a scoped
  kill switch is active, or policy denies the request. The provider is never
  contacted.
- **WARN** — the reservation succeeds but pushes the applicable hard budget
  past its `warningPct` soft threshold. The request proceeds and the response
  carries:
  - `x-rakshex-budget-warning: soft-threshold-exceeded`
  - `x-rakshex-budget-used-pct`
  - `x-rakshex-budget-remaining-usd`
- **ALLOW** — everything else.

`monitor_only` budgets never claim a block; they alert only.

## Settlement honesty

Settled cost is chosen in strict precedence order and the choice is recorded
in `gateway_call_attribution.metadata.pricingConfidence`:

1. `provider_reported` — the provider returned an exact cost for this request
   (OpenRouter). Also stored as `provider_reconciled_cost_usd`.
2. `registry` — verified token usage priced by `model_price_versions` at the
   request timestamp.
3. `table_fallback` — a deterministic maintained table (Anthropic
   thinking-token pricing).
4. `estimated_fallback` — the conservative preflight estimate. Never cheaper
   than reality by design.

## Connecting Azure OpenAI

1. Connect an `azure_openai` provider account whose `metadata` includes
   `resourceEndpoint`, for example `https://myresource.openai.azure.com`.
2. Attach an active `api_key`/`inference_api_key` control-plane credential.
3. Call the gateway with `x-rakshex-provider: azure_openai` and set `model`
   to the Azure **deployment name**.

## Connecting OpenRouter

1. Connect an `openrouter` provider account with an active inference
   credential.
2. Call `/v1/chat/completions` with `x-rakshex-provider: openrouter`. The
   gateway opts the request into OpenRouter usage accounting so settlement
   uses the provider-reported USD cost.

## Not supported yet (honest states)

- ElevenLabs and other non-OpenAI-shaped APIs (audio units need their own
  proxy surface and unit-based pricing).
- Anthropic streaming through the gateway.
- OpenRouter `/v1/responses` (OpenRouter does not implement the Responses
  API).
- Provider-native hard limits beyond the capability catalog; unsupported
  operations stay `NOT_IMPLEMENTED`/`NOT_CONFIGURED`.
