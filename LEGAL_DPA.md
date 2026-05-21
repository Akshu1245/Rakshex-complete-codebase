# Data Processing Agreement (DPA)

**Effective Date:** May 17, 2026

This Data Processing Agreement ("DPA") forms part of the Terms of Service between Rakshex ("Processor") and the customer ("Controller") using Rakshex services.

## 1. Definitions

- **Controller** means the entity that determines the purposes and means of processing Personal Data.
- **Processor** means Rakshex, which processes Personal Data on behalf of the Controller.
- **Personal Data** means any information relating to an identified or identifiable natural person.
- **Data Subject** means the natural person to whom Personal Data relates.
- **Subprocessor** means any third-party engaged by Processor to process Personal Data.
- **Applicable Law** means GDPR (EU), DPDP Act 2023 (India), and any other data protection laws applicable to the processing.

## 2. Scope and Purpose

Processor will process Personal Data only:

- As necessary to provide the Rakshex platform services
- In accordance with Controller's documented instructions
- For the duration of the service agreement

Categories of Personal Data processed:

- Account data (name, email, hashed password)
- Product usage data (dashboard interactions, feature flags)
- API traffic metadata (endpoint paths, HTTP methods, timestamps)
- Security findings (vulnerability titles, severity levels)

## 3. Processor Obligations

### 3.1 Lawful Processing

Processor shall process Personal Data in compliance with Applicable Law.

### 3.2 Confidentiality

Personnel with access to Personal Data are bound by confidentiality obligations.

### 3.3 Security Measures

Processor implements:

- AES-256 encryption at rest
- TLS 1.3 in transit
- Role-based access control
- Regular security audits and penetration testing
- SOC 2 Type 1 controls (in progress)

### 3.4 Data Breach Notification

Processor will notify Controller within 24 hours of discovering a Personal Data breach.

### 3.5 Data Subject Rights

Processor will assist Controller in responding to Data Subject requests (access, rectification, erasure, portability).

### 3.6 Data Deletion

Upon termination, Processor will delete or return all Personal Data within 30 days, except where retention is required by law.

## 4. Subprocessors

Current subprocessors:
| Subprocessor | Purpose | Location |
|--------------|---------|----------|
| AWS / Cloudflare | Infrastructure hosting | India, Singapore |
| Stripe / Razorpay | Payment processing | US, India |
| SendGrid / AWS SES | Email delivery | US |
| Redis Cloud | Caching and queues | EU |

Processor will provide 30 days notice before adding new subprocessors.

## 5. International Transfers

Personal Data may be transferred to:

- India (primary processing location)
- Singapore (disaster recovery)
- EU (Redis cache, if configured)

All transfers use Standard Contractual Clauses (SCCs) where required by GDPR.

## 6. Audit Rights

Controller may request an annual audit of Processor's security controls. Processor will cooperate and provide relevant documentation.

## 7. Termination

This DPA terminates automatically upon termination of the main service agreement.

## 8. Contact

For DPA-related inquiries: dpa@rakshex.in

---

**Rakshex Technologies Pvt. Ltd.**
Bangalore, India
