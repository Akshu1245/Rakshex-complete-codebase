# Data Retention and Deletion Schedule

Owner: Security and Privacy Lead

| Record                         | Default target                                | Deletion method                     | Exceptions                                       |
| ------------------------------ | --------------------------------------------- | ----------------------------------- | ------------------------------------------------ |
| Account and workspace data     | Subscription term                             | Account/workspace deletion workflow | Legal hold, billing, fraud, dispute              |
| Encrypted credentials          | Until revoked, rotated, or workspace deletion | Cryptographic and database deletion | Audit metadata required for security record      |
| Raw prompts                    | Zero retention by default                     | Do not persist in hosted audit log  | Customer-enabled retention or private deployment |
| Gateway audit metadata         | 13 months                                     | Scheduled retention deletion        | Customer plan, legal hold, incident evidence     |
| Security and access logs       | 180 days                                      | Scheduled retention deletion        | Incident, legal, regulatory obligations          |
| Scans, findings, and reports   | Subscription term                             | Workspace deletion workflow         | Customer export, legal hold                      |
| Billing and tax records        | Applicable statutory period                   | Restricted retention store          | Required accounting and tax retention            |
| Support records                | 24 months after closure                       | Support-system deletion             | Legal hold, abuse investigation                  |
| Backups                        | 35-day rolling target                         | Expire and overwrite                | Disaster recovery and legal hold                 |
| Waitlist and marketing consent | 24 months after last interaction              | CRM/email deletion                  | Consent proof and legal requirements             |

Changes require privacy-owner approval and an update to the public Privacy Policy if material. Test deletion workflows quarterly with non-production data and record results.
