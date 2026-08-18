# RaksHex Release Evidence Template

This document is copied for each release candidate. A green automated test suite is necessary but not sufficient for public launch. Every required row must have an evidence link, an accountable owner, and a date. An unchecked row means the release remains a private beta candidate.

| Evidence area                        | Required evidence link                                                                   | Owner                | Status | Date |
| ------------------------------------ | ---------------------------------------------------------------------------------------- | -------------------- | ------ | ---- |
| Exact release commit                 | Git SHA and release tag                                                                  | Engineering          | Open   |      |
| Frozen install                       | CI install job URL on the exact SHA                                                      | Engineering          | Open   |      |
| Format, lint, typecheck, build       | CI job URLs and local clean checkout log                                                 | Engineering          | Open   |      |
| Unit, integration, security, and E2E | CI job URLs and test artifacts                                                           | Engineering          | Open   |      |
| Dependency audit and SBOM            | Audit output, SBOM artifact, container scan                                              | Engineering          | Open   |      |
| Broker enforcement proof             | Authenticated allow, deny, replay, origin, redirect, SSRF, and secret isolation evidence | Security             | Open   |      |
| Database recovery                    | Successful backup and restore record from a production shaped environment                | Engineering          | Open   |      |
| API and worker deployment            | Health checks, worker canary, queue drain, and rollback record                           | Operations           | Open   |      |
| Email delivery                       | Invite, password reset, alert, and failure delivery evidence                             | Operations           | Open   |      |
| Monitoring and incident response     | Error, uptime, queue, and incident tabletop evidence                                     | Operations           | Open   |      |
| Buyer journey                        | Signed staging journey from setup through ledger evidence                                | Product              | Open   |      |
| Billing                              | Payment, failure, refund, cancellation, reconciliation, and webhook evidence             | Finance              | Open   |      |
| Privacy operations                   | Data access, deletion, retention, and export exercise                                    | Privacy              | Open   |      |
| Legal publication                    | Executed Terms, Privacy, Cookie, AUP, DPA, SLA, Refund, and Subprocessor review          | Business and counsel | Open   |      |
| Claims register                      | Evidence for every public performance, security, and adoption claim                      | Business             | Open   |      |
| Rollback owner                       | Named person and tested rollback command                                                 | Engineering          | Open   |      |

## Launch decision

**Private beta approved:** No  
**Paid public launch approved:** No  
**Approvers:** Engineering, Security or Privacy, Finance or Operations, Business owner, and qualified counsel.

## Guardrail

Do not change an Open status to Complete because a document exists. Attach the result of the exercise or the signed review. Do not claim that an Agent Firewall DENY is an enforceable provider control unless the real provider secret is removed from the agent runtime and the call is routed through a brokered credential.
