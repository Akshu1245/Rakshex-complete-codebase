# Launch Sign-Off Matrix

No single green test proves market readiness. Production promotion requires the accountable owner
for each row to attach evidence and sign.

| Gate                      | Accountable owner        | Required evidence                        | Status |
| ------------------------- | ------------------------ | ---------------------------------------- | ------ |
| Code and dependency gates | Engineering              | CI release gate, SBOM, scans             | Open   |
| Database recovery         | Engineering              | successful backup/restore exercise       | Open   |
| API and worker deployment | Engineering              | health checks and canary scan            | Open   |
| Email delivery            | Operations               | invite/reset/alert delivery evidence     | Open   |
| Paid billing              | Finance/Product          | payment, failure, refund, reconciliation | Open   |
| Buyer journey             | Product                  | signed staging journey                   | Open   |
| Security operations       | Security                 | incident tabletop and on-call test       | Open   |
| Privacy operations        | Privacy owner            | request/deletion exercise                | Open   |
| Legal publication         | Business owner + counsel | executed legal sign-off                  | Open   |
| Claims and marketing      | Business owner           | evidence register review                 | Open   |
| Tax and invoicing         | Finance/counsel          | GST/tax and invoice approval             | Open   |

Approvals:

- Engineering: __________________ Date: __________
- Security/Privacy: ______________ Date: __________
- Finance/Operations: ____________ Date: __________
- Business owner: ________________ Date: __________
- Qualified counsel: _____________ Date: __________
