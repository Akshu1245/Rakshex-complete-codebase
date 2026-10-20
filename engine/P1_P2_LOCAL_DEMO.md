# P1/P2 acceptance demo — local-first, no customer source upload

This is a **working synthetic acceptance flow**, not a claim of provider-verified detection or automatic Self-Repair.

## Prerequisites
- Node.js 20+ and pnpm 10.32.1.
- Work in `engine/` within the RaksHex repository.

## Run the original P1 synthetic Orders event through the canonical RaksHex scanner

```bash
cd engine
pnpm install --frozen-lockfile
cd apps/cli
node --import tsx src/index.ts api event-impact \
  test-fixtures/p1p2-orders/change-event-orders.json \
  test-fixtures/p1p2-orders/src \
  --old-spec test-fixtures/p1p2-orders/orders-old.yaml \
  --new-spec test-fixtures/p1p2-orders/orders-new.yaml \
  --format json > orders-impact-report.json
```

Expected: the JSON document has `schema: "impact-report.v1"`, `privacy_mode: true`, `spec_hashes_verified: true`, `metrics.candidate_matches: 2` and `metrics.dynamic_calls: 1`.

The report has 2 uncertain candidate findings (POST fetch and Axios) and 1 unknown dynamic-method finding. A GET call to the same path and an unrelated POST are not reported as impacted. **All events and API specs in this example are synthetic.**

## See it in the Cloudflare review UI

Open https://rakshex-impact-review-staging.rakshex.workers.dev/ and select **Import JSON report**, then select the generated `orders-impact-report.json`.

The report is processed in the browser; the preview page does not send the selected file to the Worker. Counts should show 0 confirmed affected, 3 needing review (2 uncertain + 1 unknown), 0 other. The UI intentionally hides source paths and snippets.

## Safety and limits

- The scanner operates on files in the local caller's filesystem and does not make provider HTTP requests, upload customer files or create PRs.
- The event spec SHA-256 hashes must exactly match supplied local files. A matching hash does **not** prove provider authenticity.
- Static detections are conservative candidates. No matches cannot prove a repository is safe; dynamic usage and wrappers may be missed.
- No repair is performed or approved by this command. The command reports uncertain findings to prompt human review.
- Do not use this demo to evaluate real customer repositories until their owners consent and the privacy and benchmark gates are met.

## Verification evidence

See [the passing Self-Repair engine acceptance workflow](https://github.com/Akshu1245/Rakshex-complete-codebase/actions/runs/39391215218) and [original Orders acceptance PR #253](https://github.com/Akshu1245/Rakshex-complete-codebase/pull/253).
