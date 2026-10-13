# RaksHex Strategy Lock

**Status:** Authoritative  

**Scope:** Product, engineering, deployment, customer validation, and investor narrative  

**Horizon:** Six months from adoption  

**Evidence snapshot:** 13 October 2026; refresh status classifications before external claims  

**Supersedes:** Earlier product positioning that presents RaksHex primarily as a scanner, LLM gateway, cost dashboard, compliance-certification product, or general AI-governance suite.

This document is the decision record for RaksHex's next six months.

If another roadmap, pitch, document, issue, or proposal conflicts with this strategy, this document takes precedence until it is formally amended by the product owner.

---

## 1. Locked product direction

> **RaksHex is the authorization and execution-control layer for AI agents.
> No consequential action proceeds without valid delegated authority,
> policy enforcement, controlled credential use, and verifiable evidence.**

RaksHex authorizes a semantic action before execution, narrows delegated authority, controls the use of provider credentials, and records signed, tamper-evident evidence.

The central milestone is:

> **One real agent → one Stripe test-mode refund → one enforceable credential
> boundary → one verifiable execution outcome.**

Everything else must either directly support that milestone or remain frozen.

---

## 2. Non-negotiable security invariants

### 2.1 The agent must never receive the raw credential

The provider credential must be held by the trusted RaksHex broker.

The agent receives an authorization decision—not an unrestricted Stripe, banking, cloud, email, database, or other provider key.

The broker may execute only the exact provider operation that was authorized.

### 2.2 Authorization is not execution

An authorization receipt and an execution receipt are different records.

- An authorization receipt proves that RaksHex granted permission for a specific action under a specific authority and policy state.
- An execution receipt proves what the provider actually confirmed after the broker attempted the authorized operation.

An `ALLOW` decision must never be presented as proof that a refund or other provider operation succeeded.

### 2.3 Revalidate immediately before execution

Authorization at request time is not sufficient.

Immediately before broker execution, RaksHex must revalidate:

- workspace status;
- agent status;
- API-key status;
- delegated authority;
- revocation state;
- policy version and effect;
- approval state, when approval is required;
- authorization expiry;
- exact action payload.

If revalidation fails, execution must not proceed.

### 2.4 The executed operation must match the authorized operation

The signed authorization must bind, at minimum:

- workspace;
- agent;
- semantic action;
- provider;
- target resource;
- amount in minor currency units, where applicable;
- currency, where applicable;
- destination or recipient, where applicable;
- idempotency key;
- canonical action-payload hash.

Changing any material field after authorization invalidates execution.

### 2.5 Execution must be idempotent

Retrying an already executed action must not create a second provider operation.

A duplicate request must return or reference the original authorization and execution evidence.

A provider timeout must create an uncertain outcome requiring reconciliation.

It must never trigger a blind retry that could produce a double refund.

### 2.6 Historical evidence must never be rewritten

Authorization and execution records are append-only.

Corrections, reconciliation results, and later provider confirmations must be recorded as new linked evidence. Historical receipts must not be edited to make an uncertain or failed outcome appear successful.

### 2.7 Fail closed

If authority, policy, approval, credential, or execution state cannot be verified, the default outcome is denial or non-execution.

Missing infrastructure, unavailable dependencies, unsupported provider capabilities, and incomplete configuration must not become implicit `ALLOW` decisions.

---

## 3. Required execution flow

The target flow is:

1. An agent proposes a semantic action, such as `financial.refund`.
2. RaksHex canonicalizes the action and calculates its payload hash.
3. RaksHex resolves the workspace, agent, key, delegated authority, revocations, workspace controls, and applicable policy.
4. RaksHex returns `ALLOW`, `DENY`, or `REQUIRE_APPROVAL`.
5. RaksHex writes a signed authorization receipt for the decision.
6. When human approval is required:
   - the approval is bound to the exact action-payload hash;
   - the approval has an expiry;
   - rejection terminates the request;
   - approval can be consumed only once;
   - the approval cannot authorize a modified action.
7. The trusted broker revalidates the complete authorization state immediately before execution.
8. The broker executes only the exact authorized provider operation using a credential that is never exposed to the agent.
9. The provider result is recorded in a separate signed execution receipt.
10. Uncertain provider outcomes enter reconciliation before any further execution attempt.

The security-critical path remains synchronous where authorization freshness, approval consumption, revocation, or idempotency could otherwise become stale.

A refund must never be queued with the assumption that an earlier authorization will still be valid when asynchronous processing eventually runs.

---

## 4. Receipt model

### 4.1 Authorization receipt

An authorization receipt records:

- receipt identifier;
- workspace and agent identifiers;
- semantic action;
- canonical action-payload hash;
- authority reference and scope;
- policy identifier and version;
- approval reference, where applicable;
- `ALLOW`, `DENY`, or `REQUIRE_APPROVAL`;
- issuance and expiry times;
- idempotency key;
- previous-receipt hash;
- receipt hash;
- RaksHex signature.

### 4.2 Execution receipt

An execution receipt records:

- execution-receipt identifier;
- linked authorization-receipt identifier and hash;
- provider;
- provider operation;
- provider idempotency key;
- provider object or transaction reference, when available;
- execution start and completion times;
- one of:
  - `CONFIRMED_SUCCEEDED`;
  - `CONFIRMED_FAILED`;
  - `UNCERTAIN_RECONCILING`;
  - `RECONCILED_SUCCEEDED`;
  - `RECONCILED_FAILED`;
  - `NOT_EXECUTED`;
- sanitized provider error information, where applicable;
- previous-receipt hash;
- receipt hash;
- RaksHex signature.

Provider credentials, raw secrets, unnecessary personal data, and sensitive provider payloads must never be written into receipts or logs.

---

## 5. Current verified status

The product must distinguish the following states:

- **Implemented:** Code exists in source.
- **Tested in staging:** The behavior has been exercised in staging.
- **Unverified:** Implementation may exist, but sufficient evidence does not.
- **Not implemented:** The capability is absent, disabled, or intentionally returns an unsupported state.

Staging success is not production evidence.

| Capability | Current classification | Notes |
|---|---|---|
| Agent action classification | Implemented | `financial.refund` is a recognized semantic action |
| Original TypeScript delegated authority | Implemented | Attenuation must remain protected by tests |
| Cloudflare authorization API | Tested in staging | Includes agent-scoped keys, stored authority, policies, revocation, and signed decisions |
| Signed authorization receipts | Tested in staging | Ed25519 signatures and SHA-256 hash chaining |
| Replay protection for authorization | Partially tested in staging | Identical retries and changed requests require continued coverage |
| Concurrent authorization limits | Tested in staging | Requires release-gate confirmation on the final implementation |
| Cloudflare delegation hierarchy | Not completed | Must not be inferred from the original TypeScript implementation |
| Cloudflare frontend | Deployed in staging | Frontend hosting and API forwarding are not production parity |
| Browser authentication | Not completed | Secure login and memberships remain an engineering priority |
| Tenant isolation through browser flows | Unverified | Must be proven through authenticated end-to-end tests |
| Human approval consumption | Not implemented in the Cloudflare flow | Expiry, rejection, single-use consumption, and revocation are required |
| Credential broker | Not implemented in the Cloudflare flow | The provider operation is not yet executed through the new broker |
| Stripe test-mode refund execution | Not verified | No complete end-to-end broker execution has been demonstrated |
| Execution receipts | Not completed | Provider-confirmed outcome evidence remains required |
| End-to-end refund protection | Not verified | Authorization alone does not prove enforceable execution control |
| Production launch | Not verified | Staging deployment is not production readiness |

No document, webpage, demonstration, pitch, or sales conversation may upgrade these classifications without corresponding test and release evidence.

---

## 6. Deployment decision

### 6.1 Cloudflare-first

The primary product deployment path is Cloudflare-first, subject to passing the required concurrency, durability, security, recovery, and release gates.

The intended Cloudflare responsibilities are:

- Workers: API, authorization, broker, and control-plane execution;
- D1: authoritative application state where its guarantees satisfy the relevant authorization and receipt requirements;
- R2: signed evidence exports and durable artifacts;
- Queues: non-critical asynchronous work only;
- service bindings: internal communication between trusted Workers.

D1 must not be treated as sufficient for a security-critical operation until its transactional, concurrency, durability, backup, and recovery behavior has been tested for that operation.

### 6.2 Docker

Docker remains supported for:

- local development;
- reproducible testing;
- optional self-hosting;
- disaster-recovery or enterprise deployment discussions.

Docker is not the primary hosted-product deployment story.

### 6.3 Legacy deployment paths

Other deployment configurations must not be expanded unless they directly support the locked milestone.

A deployment path may be retained for compatibility, but it must not be advertised as production-supported without deployment, rollback, backup, restore, monitoring, and security evidence.

---

## 7. Locked engineering priorities

### Priority 1 — Cloudflare authentication

Implement and verify:

- secure browser login;
- workspace memberships;
- role-based authorization;
- tenant isolation;
- session expiry and revocation;
- authenticated authorization administration;
- protection against cross-workspace access.

Exit condition: authenticated browser workflows pass tenant-isolation and authorization tests in staging.

### Priority 2 — Human approval

Implement:

- approval requests bound to the exact action-payload hash;
- approval expiry;
- approval rejection;
- authorized approver checks;
- single-use consumption;
- approval revocation;
- prevention of approval reuse after action modification;
- signed evidence for approval decisions and consumption.

Exit condition: expired, rejected, revoked, modified, and replayed approvals cannot result in execution.

### Priority 3 — Stripe test-mode broker

Implement a provider-specific broker that:

- retrieves the Stripe test-mode credential from the trusted vault;
- never exposes the credential to the agent;
- executes only the authorized refund operation;
- binds amount, currency, charge or payment reference, and idempotency key;
- revalidates authority immediately before execution;
- returns provider evidence for the execution receipt.

Exit condition: a real Stripe test-mode refund is executed without the agent possessing or receiving the Stripe credential.

### Priority 4 — Execution safety

Implement and test:

- amount and destination binding;
- authorization expiry;
- revocation immediately before execution;
- duplicate-request protection;
- concurrent-execution limits;
- provider-timeout handling;
- reconciliation;
- fail-closed dependency behavior;
- prevention of double refunds.

Exit condition: attack and failure tests prove that a modified, expired, revoked, duplicated, or uncertain request cannot create an unintended second provider operation.

### Priority 5 — Verifiable evidence

Implement independent verification for:

- authorization signatures;
- execution signatures;
- authorization hash chains;
- execution hash chains;
- the link between an execution receipt and its authorization receipt;
- confirmed, failed, uncertain, and reconciled outcomes.

Exit condition: a third party can verify exported evidence without trusting the dashboard display.

### Priority 6 — Customer validation

Validate the completed flow with real agent builders.

Measure:

- integration time;
- authorized actions;
- denied actions;
- approvals requested, approved, rejected, and expired;
- confirmed provider outcomes;
- uncertain outcomes and reconciliation time;
- duplicate-execution attempts blocked;
- authorization and execution latency;
- operational failures;
- continued usage;
- willingness to pay.

Exit condition: external users operate the flow with real agent workflows under agreed pilot limits. Test-mode success alone does not prove commercial demand.

---

## 8. Frozen scope

Until the central milestone is verified, the following are frozen:

- scanner expansion;
- new MCP-security features;
- VS Code extension expansion;
- new gateway providers;
- new cost-dashboard features;
- additional dashboards;
- speculative Rust migration;
- additional cloud migrations;
- unrelated provider integrations;
- new semantic actions beyond those required for the refund milestone;
- simulated production demonstrations;
- synthetic production data;
- unsupported compliance claims;
- public production launch work that does not support the milestone.

Existing code in frozen areas may receive security fixes and changes required to keep the release gates passing. It must not receive speculative product investment.

---

## 9. Pull-request and release discipline

Open Cloudflare and cleanup work must be reconciled in a dependency-aware manner. Pull requests must not be merged merely because they are old, large, or individually described as complete.

The integration order must account for the fact that:

- the Cloudflare authorization work establishes backend capabilities;
- the removal of synthetic runtime data establishes claim and safety boundaries;
- the Cloudflare frontend depends on compatible backend and cleanup work.

Before merging an integration candidate:

1. identify dependencies between the pull requests;
2. reconcile overlapping files and migrations;
3. preserve existing production data;
4. preserve existing signed receipts and append-only evidence;
5. verify that no migration rewrites historical evidence;
6. run formatting, lint, and type checks;
7. run unit and integration tests;
8. run security and tenant-isolation tests;
9. verify database migrations and rollback or recovery behavior;
10. verify Worker bundling and deployment configuration;
11. run relevant end-to-end smoke tests;
12. confirm that unsupported capabilities remain explicitly unsupported;
13. run the release and security gates on the exact final commit.

A staging deployment does not replace these gates.

No commit may be called release-ready unless the required release and security gates are green on that exact commit.

---

## 10. Testing requirements for the milestone

The Stripe test-mode refund milestone must pass at least the following tests:

### Authorization tests

- amount within authority succeeds;
- amount above authority is denied;
- authority revoked before authorization is denied;
- authority revoked after authorization but before execution is denied;
- expired authorization cannot execute;
- workspace freeze blocks execution;
- disabled agent cannot execute;
- revoked API key cannot execute;
- policy change is evaluated according to the locked policy-version rules;
- cross-workspace authorization cannot be used.

### Approval tests

- action above the approval threshold requires approval;
- approved action can proceed once;
- approval cannot be consumed twice;
- expired approval cannot execute;
- rejected approval cannot execute;
- revoked approval cannot execute;
- approval for one amount cannot authorize another amount;
- approval cannot be transferred to another agent or workspace.

### Broker tests

- the agent never receives the provider credential;
- the broker executes only the authorized provider operation;
- changing the amount after authorization invalidates execution;
- changing the refund target invalidates execution;
- changing the currency invalidates execution;
- broker revalidation occurs immediately before execution;
- an unavailable authority or policy service fails closed.

### Idempotency and reconciliation tests

- repeating the same request does not create two refunds;
- concurrent duplicate requests create at most one provider operation;
- a provider timeout produces `UNCERTAIN_RECONCILING`;
- an uncertain outcome does not trigger a blind retry;
- reconciliation can confirm provider success;
- reconciliation can confirm provider failure;
- reconciliation produces new evidence without changing historical receipts.

### Evidence tests

- modified authorization receipts fail verification;
- modified execution receipts fail verification;
- broken hash chains fail verification;
- an execution receipt cannot be attached to a different authorization;
- an `ALLOW` receipt cannot be presented as provider success;
- provider failure is preserved as failure evidence;
- uncertain outcomes are not displayed as successful executions.

---

## 11. Product-claim rules

### Permitted claims

RaksHex may claim only capabilities supported by current source, test, staging, or production evidence, with the environment clearly identified.

Examples:

- “RaksHex evaluates delegated authority before a governed action.”
- “The Cloudflare authorization service has been tested in staging.”
- “RaksHex produces signed authorization receipts.”
- “Credential execution is under development.”

### Prohibited claims

Until separately proven, RaksHex must not claim:

- production readiness;
- complete end-to-end refund protection;
- universal control over agent traffic;
- interception of actions that bypass RaksHex;
- SOC 2, ISO 27001, GDPR, EU AI Act, or PCI certification;
- patent status;
- that an authorization receipt proves provider execution;
- that staging results prove production scale or reliability;
- that design-partner targets are existing customers;
- that RaksHex is the first or only agent-authorization platform;
- unsupported latency, scale, savings, or security guarantees.

All demonstrations must use clearly identified test-mode data.

Simulated transactions must never be presented as production activity.

---

## 12. Commercial direction

The first commercial wedge is authorization and controlled execution for agents that can perform consequential financial or data-sensitive actions.

The first proof is a Stripe test-mode refund. Production financial execution requires separate legal, security, operational, and customer approval gates.

The initial target users are teams that:

- already operate or are actively building AI agents;
- give those agents access to consequential tools;
- are concerned about excessive delegated authority;
- need controlled credentials;
- need evidence for internal review, customers, auditors, or regulators.

Design partners and paid pilots are customer-adoption targets, not internal engineering commitments. Engineering completion does not guarantee adoption.

Commercial claims must be based on:

- external usage;
- retained pilots;
- verified execution outcomes;
- measured willingness to pay.

The existing MIT licensing position must be reviewed before making claims about proprietary exclusivity, open-core boundaries, or investor protections.

No licensing change is authorized by this strategy document.

---

## 13. Six-month decision sequence

### Phase 1 — One honest product path

- reconcile the open Cloudflare and cleanup pull requests;
- lock Cloudflare staging;
- complete authenticated browser access;
- verify tenant isolation;
- remove unsupported production claims;
- preserve existing production data and signed evidence;
- maintain a reproducible test-mode sandbox.

### Phase 2 — Prove real enforcement

- complete human approval consumption;
- implement the trusted Stripe test-mode credential broker;
- execute a real Stripe test-mode refund;
- implement idempotency and provider-outcome settlement;
- record separate execution evidence;
- pass modification, replay, revocation, timeout, and concurrency tests.

### Phase 3 — Prove customer demand

- recruit real agent builders as design partners;
- validate their actual agent frameworks and integration constraints;
- run tightly scoped pilots;
- measure usage, blocked attempts, execution outcomes, latency, reconciliation, retention, and willingness to pay;
- use customer evidence to decide whether the next action after refunds is another financial action, data export, or audit-first authorization.

Failure to recruit financial-action customers does not automatically prove that the authorization technology has failed. It may indicate that the wedge, integration cost, buyer, or distribution channel is wrong.

Before pivoting, interview prospective customers and document why they refused:

- insufficient pain;
- integration difficulty;
- credential-trust concern;
- framework incompatibility;
- procurement barrier;
- competing internal controls;
- pricing;
- lack of production readiness;
- wrong initial action.

---

## 14. Success criteria

The six-month strategy is succeeding when RaksHex can demonstrate:

1. one real external agent;
2. one real Stripe test-mode refund;
3. no raw provider credential exposed to the agent;
4. one enforceable authority limit;
5. one authorization receipt independently verified;
6. one provider-confirmed execution receipt independently verified;
7. duplicate execution demonstrably prevented;
8. revoked or modified authorization demonstrably blocked;
9. external design partners using the flow;
10. evidence that at least some customers are willing to pay.

Feature count is not a success criterion.

---

## 15. Amendment rule

This strategy may be amended only through an explicit owner-approved change that records:

- the decision being changed;
- the evidence supporting the change;
- the product and security consequences;
- the effect on the central milestone;
- the date the amendment takes effect.

No pull request, marketing requirement, investor request, partnership, or framework trend automatically amends this strategy.

In particular, no team member is authorized by this document to:

- expose raw provider credentials to an agent;
- convert authorization evidence into claimed execution evidence;
- rewrite historical receipts;
- silently replace Cloudflare-first deployment;
- begin a speculative platform rewrite;
- present staging as production;
- launch additional product surfaces ahead of the central milestone.

---

## Final locked decision

For the next six months, RaksHex will become credible by proving one narrow claim completely:

> **An AI agent can request a consequential refund without holding the
> provider credential, RaksHex can enforce the agent's delegated authority,
> and an independent party can verify both the authorization decision and
> the provider-confirmed execution outcome.**

That proof comes before additional actions, providers, dashboards, integrations, rewrites, or product surfaces.
