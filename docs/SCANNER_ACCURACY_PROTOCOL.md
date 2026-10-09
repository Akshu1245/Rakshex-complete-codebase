# Quick Scan accuracy protocol (not results)

**Scope:** static detections available from OpenAPI files, Postman collections and supported secret-bearing files; not live exploitation of endpoints.

## Benchmark preparation

1. Obtain fixed, documented versions of crAPI and VAmPI _with permission_, their available OpenAPI specs/Postman collections, and precise hashes of those input files.
2. Independently label each input `file / method / path / rule / expected evidence / in-scope?` without consulting RaksHex's output.
3. For runtime-only vulnerabilities such as broken ownership checks requiring a live user request, label `out_of_scope_static`, not a false negative.
4. Freeze the scorer, scanner version and input hashes before calculating the baseline.
5. For each in-scope issue: match on rule ID and operation identity, adjudicate TP/FP/FN in a CSV; annotate ambiguous heuristic flags separately.
6. Report per-rule **precision = TP/(TP+FP)** and **recall = TP/(TP+FN)** with numerator/denominator; disclose if denominator is zero. Overall metrics use micro-aggregated counts.
7. Count benign Postman/OpenAPI controls as negative examples for false-positive rates (FPR=FP/(FP+TN)); disclose size and selection of negative set.
8. Repeat deterministically three times and publish any differing fingerprints/results.

## Required report

| Dataset | Version & SHA256 |  TP |  FP |  FN |  TN | Precision | Recall | FPR | Out-of-scope runtime vulnerabilities |
| ------- | ---------------- | --: | --: | --: | --: | --------: | -----: | --: | -----------------------------------: |
| crAPI   | NOT RUN          |   — |   — |   — |   — |         — |      — |   — |                                    — |
| VAmPI   | NOT RUN          |   — |   — |   — |   — |         — |      — |   — |                                    — |

**Do not publish invented accuracy numbers or treat missing runtime exploitation as static misses.** Preserve full adjudication logs for reproduction and disclose any test targets that used generated documentation instead of original vulnerable service specs.
