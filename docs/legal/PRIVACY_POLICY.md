# RakshEx Privacy Policy

Effective date: 12 July 2026

This Privacy Policy explains how Rashi Technologies, operating RakshEx from Bengaluru, Karnataka, India ("RakshEx", "we", "us"), handles personal data through our websites, applications, extensions, APIs, support channels, and hosted control plane (the "Service").

For account administration, website operation, sales, billing, security, and our own analytics, RakshEx determines why and how personal data is used and acts as a data fiduciary or controller. When we process Customer Data under a Customer's instructions, the Customer is the data fiduciary or controller and RakshEx acts as processor or service provider under the Data Processing Addendum.

## 1. Data We Handle

- Account and identity data: name, work email, password hash, organisation, role, authentication provider identifiers, and sign-in security records.
- Workspace and customer data: projects, policies, inventory, masked findings, subscription and seat records, cloud-resource metadata, audit events, usage records, and support content.
- Credentials: encrypted provider credentials, key prefixes, fingerprints, scope, ownership, expiry, and lifecycle metadata. List APIs do not return plaintext credentials.
- AI telemetry: provider, model, token counts, cost, latency, status, tool names, policy decisions, and hashed or redacted metadata. Raw prompts are not retained by default unless a Customer enables retention or uses a configured workflow that requires content processing.
- Device and log data: IP address, browser or client type, timestamps, request identifiers, security events, diagnostic logs, and cookie or local-storage preferences.
- Billing and commercial data: plan, invoices, tax and billing contact details, payment status, and limited transaction references. Card and bank details are handled by payment providers, not stored by RakshEx.
- Communications: waitlist submissions, support requests, security reports, survey answers, and consent records.

We receive data from you, workspace administrators, connected providers, authorised repositories and cloud accounts, payment and identity providers, and local scanners that are designed to send masked metadata rather than discovered secret values.

## 2. Why We Use Data

We use personal data to provide and secure accounts and workspaces; discover and govern authorised AI resources; enforce policies and budgets; process subscriptions; send operational communications; provide support; investigate abuse and incidents; comply with law; and improve reliability and usability using aggregated or de-identified information where practical.

Where GDPR applies, our legal bases may include performance of a contract, legitimate interests in securing and improving the Service, compliance with legal obligations, and consent for optional communications or non-essential technologies. Where India's DPDP Act applies, we process with valid consent or another permitted use and provide required notices and rights as the relevant provisions commence.

We do not sell personal data, provider credentials, or customer prompts. We do not use Customer Data to train a general-purpose model unless the Customer expressly opts in under separate written terms.

## 3. Prompt and Secret Boundaries

Local discovery fingerprints suspected secrets and sends masked metadata by default. A Customer may explicitly submit a credential to the workspace vault for encrypted storage and provider use. Plaintext is used only for the authorised operation and is not included in frontend list responses, product analytics, or normal application logs.

For gateway traffic, policy checks may inspect prompts transiently to redact personal data, detect prompt injection, enforce tool and model rules, and route the request. The hosted control plane records audit metadata without retaining raw prompts by default. Private-relay and self-hosted options can keep prompts and provider credentials inside the Customer environment.

## 4. Sharing and Subprocessors

We share data only with personnel and service providers that need it to operate the Service, with connected providers at Customer direction, in a corporate transaction subject to safeguards, or when required by law. Categories include cloud hosting, database and cache hosting, content delivery, payment processing, identity, email, support chat, error monitoring, source control, and customer-selected AI providers.

The current register and provider purpose are published at https://rakshex.in/legal#subprocessors. Optional providers process data only when configured. We contractually restrict subprocessors and remain responsible for our processor obligations.

## 5. International Transfers

Data may be processed in India and in regions used by configured infrastructure or providers. Where a restricted transfer mechanism is required, we use contractual and technical safeguards, which may include the EU Standard Contractual Clauses and additional measures described in the DPA. Enterprise Customers may contract for available data-region or private-deployment options.

## 6. Retention

We retain data only for the Service and legal purposes described here. Default targets are:

- active account and workspace records: for the subscription term;
- raw prompts: zero retention by default in hosted audit records;
- security and access logs: generally 180 days, subject to incident, legal, and plan requirements;
- gateway usage and audit metadata: generally 13 months, configurable for enterprise plans;
- billing and tax records: as required by applicable tax and accounting law;
- backups: overwritten on a rolling schedule, generally within 35 days after deletion;
- support records: generally 24 months after closure;
- waitlist records: until consent is withdrawn or 24 months after the last interaction.

Legal hold, fraud prevention, dispute, and security obligations may require longer retention. Customer-configured retention and an Order Form control where they set a shorter permitted period.

## 7. Your Choices and Rights

Depending on location and applicable law, you may request access, correction, completion, deletion or erasure, restriction, objection, portability, withdrawal of consent, information about processing, and nomination or grievance redressal. Workspace administrators can also export and delete workspace data subject to role controls.

Send a request to privacy@rakshex.in from the account email. We may verify identity and authority, and may ask a workspace administrator to handle Customer-controlled data. We will respond within the period required by applicable law. Withdrawing consent does not affect earlier lawful processing. You may complain to the competent regulator, including the Data Protection Board of India when it has jurisdiction or an EU/EEA supervisory authority where GDPR applies.

## 8. Cookies and Similar Technologies

We use essential session, authentication, CSRF, security, and preference technologies. Optional support chat or analytics loads only when configured and after the required consent. We do not use advertising cookies by default. See https://rakshex.in/cookies.

## 9. Security

We use measures designed to protect data, including transport encryption, credential encryption, password hashing, workspace access control, audit logs, rate limits, masked secret discovery, and restricted production access. Security measures evolve and no system is risk-free. Report suspected vulnerabilities to security@rakshex.in.

If a personal-data breach occurs, we will investigate, contain, preserve evidence, and notify affected Customers and authorities as required by applicable law and contract. Customers remain responsible for provider-side incidents outside RakshEx and for maintaining provider revocation access.

## 10. Children

The Service is intended for organisations and developers aged 18 or older. We do not knowingly collect children's personal data. Contact privacy@rakshex.in if you believe a child has provided data.

## 11. Automated Decisions

Risk scores, policy decisions, anomaly alerts, cost estimates, and remediation suggestions support human decisions. RakshEx does not intend these features to make legal or similarly significant decisions about individuals without human review. Customers must configure lawful oversight for their own use cases.

## 12. Changes and Contact

We may update this policy to reflect law, providers, or product changes. We will post the new effective date and provide additional notice for material changes where required.

Privacy and grievance contact: privacy@rakshex.in

Security: security@rakshex.in

Postal contact: Rashi Technologies, Bengaluru, Karnataka, India. Contracting Customers receive the full registered address in their Order Form or invoice.
