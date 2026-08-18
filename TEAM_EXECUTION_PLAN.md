# RaksHex Autonomous Developer Team

## Mission

Bring the RaksHex repository from its current state to a verified private beta release candidate by repairing release health, proving the credential enforcement boundary, improving the Agent Firewall control plane, and documenting operational launch safeguards.

## Workstreams

### Engineering Reliability

Owner: `engineering-reliability`

Scope: frozen lockfile consistency, Node and pnpm alignment, obsolete type stubs, formatting, typecheck, build, CI workflow correctness, branch protection readiness, and clean checkout reproducibility.

Acceptance criteria: clean install, format check, lint, typecheck, build, package tests, API tests, security tests, and CI workflow all pass on the resulting commit. No generated files or unrelated dependency churn are included.

### Security Verification

Owner: `security-verification`

Scope: authenticated Agent Firewall broker journey, runtime key scope, delegated authority, allow and deny decisions, credential secrecy, replay, origin pinning, redirects, SSRF, concurrency, and egress ledger evidence.

Acceptance criteria: deterministic tests cover the complete supported broker path and explicitly document any environment bound limitation that cannot be tested locally.

### Product Experience

Owner: `product-experience`

Scope: Agent Firewall onboarding, separation of setup from operations, readiness blockers, credential setup guidance, decision trace clarity, empty states, accessibility, and control plane information architecture.

Acceptance criteria: a first time user can understand and complete a bounded setup journey without needing to understand every internal security primitive, while the security limitations remain honest and visible.

### Release Operations

Owner: `release-operations`

Scope: release evidence templates, launch checklists, backup and restore evidence placeholders, worker and API deployment proof, monitoring, payment gate language, legal gate language, rollback ownership, and private beta guardrails.

Acceptance criteria: a release evidence bundle can be completed for each candidate and the repository does not imply public GA readiness before the required evidence exists.

## Integration rules

Each workstream must work in its own git worktree and commit only its scoped changes. No workstream may weaken security tests, remove release gates, suppress warnings, or rewrite claims merely to make checks green. Integration happens only after each workstream reports its acceptance criteria and the main worktree is validated from a clean install.

## Execution order

Engineering Reliability starts first because all other work depends on a reproducible checkout. Security Verification and Product Experience can then proceed against the repaired baseline. Release Operations runs in parallel on documentation and evidence templates. Integration runs the complete validation matrix and resolves conflicts before any release claim is made.
