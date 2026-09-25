# Metering → Billing Wiring Notes

**Purpose:** how the salvaged DevPulse metering internals (commit `4234dcd`, "salvage DevPulse thinking-token, runaway-detector, metering internals") connect to Razorpay + Paddle. **Doc only — no code changes.** Team A owns provider go-live; this is the seam they build against.

**Pricing basis (draft, NOT boss-approved yet):** per gated action, never per seat. Free $0 / Solo $29 / Team $99 / Enterprise custom; overage $8/100k gated actions; INR anchors ₹499/₹999/₹2,499 + 18% GST. Receipt signing/verification stays free (trust moat, not paywall).

---

## 1. What already exists (salvaged, in commit 4234dcd)

| Piece | Location (in 4234dcd) | What it does |
|---|---|---|
| Usage ledger | `apps/api/services/billing/metering.ts` → `recordBillableEvent()` | Writes one canonical `usage_events` row per meter tick: workspace, event type (`api_calls` / `tokens` / `bandwidth_gb` / `minutes`), quantity, optional USD cost, metadata, timestamp |
| Period aggregation | `metering.ts` → `sumPeriodUsage()` + `checkPlanQuota()` | "How much did this workspace use in this period?" Reuses `computeOverageCents()` and `PLAN_CATALOG` from `apps/api/services/billing/provider.ts` |
| Billing event bus | `apps/api/services/billing/billingEvents.ts` | Provider-neutral outbound events (`usage.threshold_exceeded`, `billing.cycle_closed`, …), HMAC-SHA256 signed (`x-rakshex-signature`), exponential-backoff retries (3 attempts, 8s timeout; 5xx/429 retried, other 4xx terminal) |
| Reasoning-spend attribution | `apps/api/services/thinkingTokens.ts` | Thinking/reasoning tokens as first-class `reasoning_token` usage units, never double-counted against output tokens — flows into the same usage envelope, so reasoning spend shows up on receipts and in billing |
| Entitlements | `apps/api/services/billing/entitlements.ts` (HEAD) | Plan → feature/quota grants; the gate consults this before ALLOW |
| Reconciliation | `apps/api/services/billing/reconciliationWorker.ts` + provider reconcilers (HEAD, Team B) | Provider usage APIs correct our estimates after the fact; every signal carries Exact / Observed / Estimated labels (`signalLabels.ts`) — billing must never charge on an Estimated signal without disclosure |

## 2. The wiring (what Team A builds)

```
agent action → policy gate → recordBillableEvent() → usage_events (source of truth)
        → sumPeriodUsage() / checkPlanQuota() → entitlements (gate: ALLOW vs LIMIT)
        → billingEvents dispatch → Razorpay (INR/UPI) + Paddle (global MoR)
        → reconciliation worker corrects estimates → credit/adjust next cycle
```

**Key design decisions (locked):**
- `usage_events` is the single source of truth. No second metering store, no provider-side numbers as primary.
- The gate meters on **estimated worst-case cost at decision time** (tokenizers + `max_tokens` bound + versioned model price table), then reconciliation trues it up. Provider APIs are reconciliation-grade only (OpenAI hours-late, Anthropic ~5 min, Google 24–48h, all admin-key-only).
- Overage is computed by the existing `computeOverageCents()` — Team A maps its output to provider line items, not new math.
- Webhook delivery is signed and retried by `billingEvents.ts` — providers are sinks, not the bus.

## 3. Razorpay (INR + UPI, day 1)

- Create one Razorpay **Plan per tier** (Free is $0/no-plan; Solo ₹999; Team ₹2,499 — draft anchors; boss approves).
- Razorpay **Subscriptions** handle the recurring charge; `razorpayWebhook.ts` (already in `apps/api/services/billing/`) receives `subscription.charged` / `subscription.halted` → update entitlements.
- **Overage:** computed monthly from `sumPeriodUsage()`; billed as a Razorpay **invoice/addon charge** against the subscription, or a manual invoice for large overages. Never auto-charge overage without the customer seeing the usage breakdown first (send the receipt-bundle-style usage statement).
- UPI AutoPay covers most domestic Solo/Team collection; ~2% domestic card fee, UPI ~0% (per research).
- Webhook secrets in vault, signature-verified — same posture as our outbound HMAC.

## 4. Paddle (global merchant-of-record)

- Paddle = MoR: they handle global tax/VAT, chargebacks, invoicing. Required for non-INR customers.
- One Paddle **Product per tier** (+ metered **usage line item** for overage at $8/100k gated actions).
- Paddle webhooks (`subscription.created/updated/canceled`, `transaction.completed`) → entitlements, same as Razorpay.
- Cost: 5% + $0.50/transaction — acceptable because tax compliance is absorbed.
- Do NOT use Stripe India (onboarding-blocked for sole props, no UPI) — revisit after incorporation. Skip Lemon Squeezy (stagnation risk).

## 5. Edge cases the wiring must handle

- **Reconciliation corrections:** when provider actuals differ from gate estimates, issue usage **credits**, not silent adjustments — the workspace sees a "corrected" line item labeled with its signal honesty (Observed vs Estimated).
- **Demo/free-tier abuse:** per-workspace ceilings + rate limits from day one; demo mode never touches real money.
- **Proration:** mid-cycle upgrades prorate via the provider's native proration; our `usage_events` stay untouched (money math lives in the provider, usage math lives with us).
- **Disputes:** every charge maps to signed receipts — the receipt bundle IS the invoice evidence. This is the moat: billing disputes get answered with cryptography, not support tickets.

## 6. Boss-side blockers for billing go-live

Razorpay account (KYC + settlement bank account); Paddle account; pricing-tier approval (§b draft); billing-entity decision (RaksHex vs Rashi Technologies on invoices); Terms + Privacy Policy before first signup.
