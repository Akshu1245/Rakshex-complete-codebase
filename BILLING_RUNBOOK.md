# Rakshex Billing Runbook

## Payment Providers

- **Razorpay**: INR billing (India)
- **Stripe**: USD billing (scaffolding + webhook verification present)

## Code status (2026-07-30)

Checkout paths, webhook signature tests, and subscription state machine are **Available** in code. Live keys and product/price IDs are operator configuration — not missing application code.

## Common operations

### Failed payment / past_due

1. Check `payments` + `subscriptions` rows for the user.
2. Confirm webhook delivery in provider dashboard (signature must match `RAZORPAY_WEBHOOK_SECRET` / Stripe secret).
3. Re-send invoice or trigger customer portal update from dashboard.

### Refund

1. Prefer provider dashboard refund so webhook updates `refundStatus`.
2. Verify amount stored in major currency units (INR/USD) matches dashboard after conversion from paise/cents where applicable.

### Test mode vs live

- Never mix test keys with production `DATABASE_URL`.
- Run one real charge + refund in staging before public paid launch.

## Contacts

- Product / billing owner: set in `docs/operations/LEGAL_LAUNCH_SIGNOFF.md`
- Support: support@rakshex.in
