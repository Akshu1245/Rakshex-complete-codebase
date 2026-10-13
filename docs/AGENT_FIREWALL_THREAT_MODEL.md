# RaksHex Agent Firewall — threat model (draft for review)

**Status:** Threats and required controls documented; **not** an assertion that every control is implemented or tested.
**Assets:** provider credentials, workspace policy, policy decision integrity, action authority, approval signatures, append-only audit receipts, user/account boundaries, and egress configuration.
**Trust boundaries:** untrusted agent prompt/tool output → client/SDK/MCP → authenticated RaksHex gateway → policy+tenant resolution → credential broker → external provider; human approver UI → approvals API; DB+audit storage; CI/CLI integrations.

| Threat                       | Failure scenario                                                    | Minimum control required                                                                                                                          | Evidence / attack test before beta                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Credential bypass            | Agent retains unrestricted provider key and calls provider directly | Agents get **no** raw unrestricted key; gateway/broker alone owns key, network egress constrained when feasible, clear unsupported-client warning | Try direct provider API call from agent with denied action; it must fail without the provider key. Document cases outside RaksHex's network control |
| Prompt injection             | Tool output convinces agent/human to approve unsafe action          | Treat prompts/tool output as untrusted, approval shows canonical target/amount/identity from parsed action, not freeform agent claim              | Inject fake “SYSTEM APPROVED” and mismatched amount into tool response; policy and approval remain unchanged                                        |
| Approval fatigue             | Many approvals numb operator                                        | Group/deduplicate safely, rate limit, show risk and expiry, high-risk actions require explicit confirm                                            | Flood with 100 replayed approval requests; ensure operator can reject and kill switch works                                                         |
| Time-of-check vs time-of-use | Parameters change between policy evaluation and provider execution  | Bind signed/hashed action digest, principal, target, amount, TTL and policy revision to one executable authorization; re-check at execution       | Approve amount 50, execute amount 500 or changed destination: DENY                                                                                  |
| Replay/double-spend          | Same decision reused                                                | Persist unique idempotency key, short-lived single-use receipts, DB transaction/unique constraint                                                 | Concurrent duplicate requests execute at most once                                                                                                  |
| Cross-tenant access          | A reads/approves B's requests                                       | Server-side workspace membership, RBAC, workspace-scoped SQL, filtered audit                                                                      | Two-workspace end-to-end matrix for list/approve/reject/ledger                                                                                      |
| Kill-switch race             | Disable requested but ongoing actions continue                      | Consult authoritative state at execution, not stale cache; define bounded propagation time                                                        | Kill switch during concurrent authorizations, record any allowed window                                                                             |
| Fail-open outage             | Cache/DB unavailable → allow                                        | Enforcement path must DENY if policy or credential state unavailable; separate telemetry-only paths in docs                                       | Kill DB, Redis (if needed), API; denied action never reaches provider                                                                               |
| Audit tampering              | Operator overwrites/deletes audit receipt                           | Append-only storage constraints, cryptographic linking/signing, independent export & tamper alerts                                                | Remove/alter one receipt and show validation fails                                                                                                  |
| Tenant secret leakage        | Logs and errors expose tokens                                       | No raw credential logging; encrypt storage if broker used; redact errors, scoped keys and least privilege                                         | Inject marker secret and scan logs, traces, reports and client responses                                                                            |
| SSRF / exfiltration          | Agent passes internal metadata URL as destination                   | Enforce origin allowlist, DNS re-resolve, block private/loopback destinations where applicable                                                    | Test loopback, link-local, metadata IP and DNS rebinding paths                                                                                      |
| Policy downgrade             | Caller overrides enforcement mode                                   | Server-side, RBAC-guarded configuration with audit; hard fail-closed for enforced routes                                                          | Caller sends `shadow=true`, `failOpen=true` or altered workspace id: DENY                                                                           |

## Deployment scope contract

- The firewall governs **only actions executed through its authenticated, enforced path**. Telemetry/reporting alone cannot stop provider actions.
- A raw key held by an agent or parallel direct API route is a bypass by design; it must be removed or documented, not obscured by a marketing claim.
- V1 environment variables can protect secrets only if they reside in the trusted gateway process, not in the agent's environment.
- Never assert zero incidents, uncompromisable audit, or complete containment without independent testing.

## Required sign-off checklist

- [ ] All enforceable-path tests pass (ALLOW, DENY, REQUIRE_APPROVAL, timeout, kill switch)
- [ ] Independent adversarial user A/workspace B tests, including concurrent race cases
- [ ] Real brokered action from an agent that has no raw provider key
- [ ] DB-outage fail-closed exercise
- [ ] Human-approval prompt injection and fatigue exercise
- [ ] Credential exfiltration, replay, SSRF and audit-tampering tests
- [ ] Backup restore + incident response playbook validated
- [ ] Beta terms list exclusions and bypass caveats, reviewed by testers
