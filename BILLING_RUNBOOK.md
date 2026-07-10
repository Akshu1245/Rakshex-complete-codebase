# DevPulse Billing Runbook

## Payment Providers

- **Razorpay**: INR billing (India)
- **Stripe**: USD billing (Sprint 2, scaffolding)

## Currency Units

| Location                   | Unit          | Example                   |
| -------------------------- | ------------- | ------------------------- |
| `getPlans` API response    | Paise         | `829900` = ₹8,299         |
| `getInvoices` API response | INR (from DB) | `8299.00`                 |
| `createOrder` input        | Paise         | User sends `829900`       |
| `createOrder` response     | Paise         | Razorpay returns `829900` |
| `payments` table           | INR (decimal) | `8299.00`                 |
| `processRefund` input      | Paise         | Pass `829900`             |

## Webhook Handling

### Signature Verification

- Secret: `RAZORPAY_WEBHOOK_SECRET` (NOT `RAZORPAY_KEY_SECRET`)
- Algorithm: HMAC-SHA256
- Header: `x-razorpay-signature`

### Idempotency

- Table: `processed_webhook_events`
- Key format: `razorpay:<payment_id>` or `razorpay:<subscription_id>`
- Deduplication on insert (PostgreSQL unique constraint `23505`)

### Webhook Events

| Event                    | Action                           | Idempotent          |
| ------------------------ | -------------------------------- | ------------------- |
| `subscription.activated` | Plan upgrade + status → active   | Yes (by sub ID)     |
| `subscription.charged`   | Create payment record            | Yes (by payment ID) |
| `subscription.cancelled` | Plan → free + status → cancelled | Yes (by sub ID)     |
| `payment.failed`         | Dunning email + past_due status  | Yes (by payment ID) |
| `refund.processed`       | Update payment refund status     | Yes (by refund ID)  |

### Webhook Failure Recovery

```sql
-- Check for missed webhook events
SELECT * FROM subscriptions WHERE status = 'pending' AND created_at < NOW() - INTERVAL '1 hour';

-- Manually activate a subscription
UPDATE subscriptions SET status = 'active' WHERE razorpay_subscription_id = 'sub_xxx';

-- Check idempotency log
SELECT * FROM processed_webhook_events WHERE provider = 'razorpay' ORDER BY processed_at DESC LIMIT 20;
```

## Dunning Flow

1. Payment fails → `payment.failed` webhook
2. First failure: email with retry link
3. Second failure: email with downgrade warning
4. Third failure in 30 days: auto-downgrade to free tier

## Refund Process

1. Manual refund in Razorpay dashboard
2. `refund.processed` webhook arrives
3. `updatePaymentRefundStatus` sets refund amount + status

## Troubleshooting

| Symptom                      | Check                                                    |
| ---------------------------- | -------------------------------------------------------- |
| Webhooks not received        | Razorpay dashboard → Webhooks → Delivery Log             |
| Signature verification fails | `RAZORPAY_WEBHOOK_SECRET` matches Razorpay dashboard     |
| Double charges               | Check `processed_webhook_events` for duplicate event IDs |
| Wrong amounts                | Verify paise/INR unit at each boundary                   |
