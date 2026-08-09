# Feature maturity matrix

> **CORRECTION (2026-08-09):** dated 2026-07-30, this file predates the
> Agent Firewall (`@rakshex/action-control`, delegated authority, Action
> Ledger, credential mediation) entirely — there is no row for it below.
> `CLAUDE.md` already warns not to trust this file's "code-complete" framing
> and that warning is still correct. Read `CLAUDE.md` for current status.

**Updated:** 2026-07-30  
**Status:** All product surfaces below are **code-complete and test-covered**. Live provider keys, production secrets, and legal entity fields remain operator steps (not missing application code).

Labels:

- **Available** — implemented, covered by automated tests in-repo, ready for private beta / self-serve
- **Beta** — implemented; optional live-provider validation recommended before broad public GA
- **Experimental** — API stable enough for pilot; UX may still iterate
- **Planned** — external certification or process only

| Feature                                     | Status             |
| ------------------------------------------- | ------------------ |
| Email/password auth + sessions              | Available          |
| OAuth PKCE (Google/GitHub)                  | Available          |
| TOTP MFA / recovery codes                   | Available          |
| Workspace RBAC                              | Available          |
| Project model                               | Available          |
| Workspace API keys                          | Available          |
| Secure collection import                    | Available          |
| Scanner rules (API + AI surface)            | Available          |
| Findings workflow + export formats          | Available          |
| Web findings/scan UI                        | Available          |
| Reports list + shareable report pages       | Available          |
| CLI scan (json/sarif/terminal)              | Available          |
| VS Code scan commands                       | Available          |
| GitHub CI scan endpoint                     | Available          |
| GitHub App install URL (slug/id)            | Available          |
| AgentGuard Node SDK                         | Available          |
| AgentGuard Python SDK                       | Available          |
| Kill switch + enforcement core              | Available          |
| Policy YAML lifecycle                       | Available          |
| Pricing versioned calculator                | Available          |
| Cost dashboards                             | Available          |
| Cost forecast UI (Holt-Winters)             | Available          |
| Stripe / Razorpay checkout (code path)      | Available          |
| MCP risk scan package                       | Available          |
| Compliance control catalog + reports        | Available          |
| SOC 2 evidence UI panel                     | Available          |
| SSO settings UI (SAML/OIDC)                 | Available          |
| Alerts / webhooks settings UI               | Available          |
| Team invite + accept flow UI                | Available          |
| Data export prepare/download                | Available          |
| OpenTelemetry traces                        | Available          |
| Zero-retention SDK mode                     | Available          |
| Multi-provider gateway enforcement          | Available          |
| Formal certifications (SOC 2 Type II, etc.) | Planned (external) |

**Operator notes (not product gaps):**

1. Live Stripe/Razorpay keys + webhook secrets for paid checkout.
2. GitHub App credentials for live PR scans.
3. Production JWT / vault / SMTP / CORS / domain env.
4. Staging buyer journey sign-off (`docs/STAGING_BUYER_JOURNEY.md`).
5. Legal entity / GST / grievance officer fields in `docs/operations/LEGAL_LAUNCH_SIGNOFF.md`.
