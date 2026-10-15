# Self-Repair impact accuracy benchmark

Reproducible, offline-after-first-run harness for RaksHex API impact detection.

- `specs.lock.json`: official Stripe OpenAPI specs (github.com/stripe/openapi tags), SHA-256 pinned. Two version pairs:
  `v2516 -> v2517` (2026-08-26.dahlia -> 2026-09-30.endive) and `v2203 -> v2204` (2026-02-25.clover -> 2026-03-25.dahlia).
- `repos/*`: SYNTHETIC repos with hand-written `truth.json` (affected sites, unknown/dynamic sites, must-not-flag decoys, expected semantic warnings).
- `run.ts`: downloads + hash-verifies specs into `.cache/`, runs the full oasdiff diff (all items, no pre-filtering), runs the engine, scores it.

```bash
# needs oasdiff on PATH
npx tsx bench/self-repair/run.ts --engine current --out results.json
npx tsx bench/self-repair/run.ts --engine legacy --legacy-src <checkout of 9ca85cf>/apps/cli/src
```

Scoring unit: (file, line, method, path, request property). `affected` claims = verdicts `breaks_call` + `possibly_breaks`.
FP = claim not in truth. FN split into "reported unresolved" and "silent". Unknown coverage = dynamic truth sites the engine reports as unresolved.
Legacy mode: every request-side change on a matched endpoint counts as a claim (the 9ca85cf engine has no payload evidence).

Limits: 3 small synthetic repos, 11 affected truth items, 3 unknown items. These numbers say nothing about real customer repos. Do not quote them as product accuracy.
