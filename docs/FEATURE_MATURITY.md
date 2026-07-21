# Feature maturity matrix

Labels:

- **Available** — implemented and covered by automated tests in-repo
- **Beta** — implemented but incomplete ops/UI/live-provider validation
- **Experimental** — code present; API or UX may change
- **Planned** — documented intent only; not shippable

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
| Web findings/scan UI                        | Beta               |
| Reports list + shareable report pages       | Beta               |
| CLI scan (json/sarif/terminal)              | Available          |
| VS Code scan commands                       | Beta               |
| GitHub CI scan endpoint                     | Beta               |
| GitHub App install URL (slug/id)            | Beta               |
| AgentGuard Node SDK                         | Available          |
| AgentGuard Python SDK                       | Available          |
| Kill switch + enforcement core              | Beta               |
| Policy YAML lifecycle                       | Available          |
| Pricing versioned calculator                | Available          |
| Cost dashboards                             | Beta               |
| Cost forecast UI (Holt-Winters)             | Beta               |
| Stripe / Razorpay live checkout             | Beta               |
| MCP risk scan package                       | Beta               |
| Compliance control catalog + reports        | Available          |
| SOC 2 evidence UI panel                     | Beta               |
| SSO settings UI (SAML/OIDC scaffolding)     | Beta               |
| Alerts / webhooks settings UI               | Beta               |
| Team invite + accept flow UI                | Beta               |
| Data export prepare/download                | Beta               |
| OpenTelemetry traces                        | Beta               |
| Zero-retention SDK mode                     | Available          |
| Full multi-provider gateway proxy           | Experimental       |
| Formal certifications (SOC 2 Type II, etc.) | Planned (external) |
