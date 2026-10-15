# Held-out benchmark repos (frozen before evaluation)
Written 2026-10-15 ~20:20 IST, modelled on Stripe documentation/quickstart code patterns (Express server,
`require('stripe')(key)` one-liner, Next.js route handlers, service classes), NOT on the engine's code paths.
Ground truth: Stripe changelog entries (URLs in truth.json) + the property names as they appear in the official spec diff.
The engine had NOT been run on these files when they were committed. The freeze commit hash is recorded in
engineering/SELF-REPAIR-ACCURACY-BENCHMARK.md. Any engine change after the freeze must be reported separately.
