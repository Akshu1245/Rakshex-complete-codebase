# RaksHex public marketing-site SEO implementation handoff (2026-11-04)

**STATUS: Ready-to-integrate templates, NOT deployed.** This directory is not
part of the build output. `www.rakshex.in` belongs to a separate Vercel
marketing-site project with disconnected Git integration. The available main
GitHub repo is the DevPulse dashboard/API, so do NOT deploy these files from
the dashboard project, overwrite its `vercel.json`, or point the apex domain
at the application.

## A. Google Search Console, DNS, Bing (account-only)

1. In [Google Search Console](https://search.google.com/search-console), add
   a **Domain** property: `rakshex.in` (without scheme or www).
2. Copy Google's ACTUAL `google-site-verification=...` TXT value. Never
   fabricate a verification token.
3. In the authoritative DNS provider (GoDaddy per the audit), add TXT name
   `@` with that full value, while preserving existing TXT records.
4. Verify ownership in Search Console. After the site sitemap is corrected,
   submit `https://www.rakshex.in/sitemap.xml`.
5. Link GA4 from GA4 Admin > Product links > Search Console links.
6. Import the property to Bing Webmaster Tools using its GSC import option.

These steps require the domain/Google account owner. No DNS record was added
by this PR, and no Search Console/Bing property has been verified.

## B. GA4 (marketing frontend ONLY)

1. Create GA4 property `RaksHex Web`, web stream
   `https://www.rakshex.in`. Copy the real Measurement ID (`G-...`).
2. In the MARKETING Vercel project's Production environment, set
   `NEXT_PUBLIC_GA_ID` to the actual measurement ID (never a placeholder).
3. Copy `GoogleAnalytics.tsx` into the marketing site's components directory,
   then render `<RaksHexGoogleAnalytics />` inside its root layout's
   `<body>`. This uses built-in `next/script`; no extra package is needed.
4. Review and implement applicable analytics notice/consent requirements
   before enabling collection. Never send authentication tokens, API keys,
   source code, or private customer data to GA4. Don't put GA4 on the
   authenticated dashboard or API.
5. Deploy the MARKETING project and inspect GA4 Realtime, browser network
   requests and console errors. A missing measurement ID disables scripts.

## C. 307-to-308 apex redirect (marketing host)

1. Check Vercel > MARKETING project > Settings > Domains for any existing
   `rakshex.in` domain-level redirect. **Do not run both configurations**.
2. If the domain-level redirect cannot be made permanent, remove that redirect
   but KEEP the apex domain attached so project routing can see the request.
3. Merge this directory's `vercel.json` *redirect entry* into the
   MARKETING project's existing `vercel.json` (preserve all unrelated
   routes, rewrites, headers and build settings).
4. Deploy and verify:
   ```bash
   curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://rakshex.in/
   # Expected: 308 https://www.rakshex.in/
   curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://rakshex.in/pricing
   # Expected: 308 https://www.rakshex.in/pricing
   ```

The configuration here is a **template**, not active in the dashboard project.

## D. Sitemap/compare pages (marketing backend route output)

The marketing project's actual sitemap source has not been supplied.

1. Copy `sitemap-filter.ts` into the marketing site. In its existing
   `app/sitemap.ts`, apply
   `return removeNoindexComparisons(existingEntries);` to the generated
   sitemap entries and preserve other URLs/metadata.
2. Confirm the seven comparison routes remain excluded from the sitemap and
   have `noindex` if they are still reachable.
3. With the planned Self-Repair repositioning, review the stale firewall and
   competitor-comparison content. Delete/redirect obsolete pages based on
   whether there is a genuinely relevant replacement; use 404/410 otherwise.
   Do not automatically redirect all deleted pages to the home page.
4. Confirm only canonical, 200-status, indexable URLs appear in the sitemap.
   Keep `robots.txt` pointing to the marketing sitemap.

## Release checklist

- [ ] Owner completes GSC Domain property + valid DNS TXT
- [ ] Correct the marketing positioning before driving traffic
- [ ] Owner creates GA4 measurement ID and approves consent handling
- [ ] Apply GA4 only in marketing root layout and verify GA4 Realtime
- [ ] Apply exactly one apex -> www 308 rule in marketing Vercel project
- [ ] Filter seven noindex comparison pages from sitemap
- [ ] Deploy MARKETING site and recheck 200/canonical/sitemap/robots/308
- [ ] Submit corrected sitemap to GSC, link GA4, import to Bing
- [ ] Do not treat this main app PR as a marketing-site deployment

**Backend note:** Site SEO generally belongs to public frontend/server output.
The separate FastAPI/Cloudflare API should be marked noindex (done in the
application PR); it should not serve the marketing sitemap or perform the
public-site apex redirect.
