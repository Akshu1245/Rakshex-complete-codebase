# Live Site Replacement Notice

**Release date:** 2026-07-30
**Owner:** Product and Legal
**Required before broad launch:** Yes

The production site must be redeployed from this release before paid public
launch. The site observed on 2026-07-30 contained proof and positioning claims
that are not backed by evidence stored in this repository, including patent,
market-first, benchmark, audit, usage-statistic, and testimonial claims.

## Required action

1. Deploy the web application from this release.
2. Purge CDN and browser caches for public marketing pages.
3. Verify `/`, `/pricing`, `/register`, `/legal/privacy`, `/legal/terms`, and
   `/status` in an incognito browser.
4. Confirm that no customer-facing page contains:
   - patent counts or patent-status claims without counsel-approved evidence;
   - “first”, “best”, or benchmark claims without dated, reproducible evidence;
   - customer names, logos, quotations, or metrics without written consent;
   - certifications that have not actually been awarded.
5. Record the deployed commit SHA, deployment URL, reviewer, and timestamp in
   `LAUNCH_SIGNOFF_MATRIX.md`.

The automated `runtimeClaims.test.ts` check protects several known strings from
being reintroduced. It does not replace human marketing and legal review.
