# Vulnerable API — DevPulse Test Lab

> **WARNING:** This repository contains intentionally vulnerable code.
> **DO NOT deploy to production.**
> Used for testing DevPulse security scanning accuracy.

---

## Purpose

This repo contains 15+ known vulnerabilities across common API security categories.
DevPulse should detect ALL of them with high confidence.

## Vulnerabilities Included

| #   | Vulnerability                  | CWE     | OWASP                | Expected Severity |
| --- | ------------------------------ | ------- | -------------------- | ----------------- |
| 1   | Cleartext HTTP endpoint        | CWE-319 | A02: Crypto Failures | High              |
| 2   | Missing auth on POST           | CWE-306 | A07: Auth            | Critical          |
| 3   | Hardcoded API key              | CWE-798 | A07: Auth            | Critical          |
| 4   | SQL injection in query param   | CWE-89  | A03: Injection       | Critical          |
| 5   | Insecure CORS wildcard         | CWE-942 | A05: Misconfig       | Medium            |
| 6   | Verbose error messages         | CWE-209 | A05: Misconfig       | Low               |
| 7   | Missing rate limiting          | CWE-770 | A04: Design          | Medium            |
| 8   | Integer ID in URL (IDOR)       | CWE-639 | A01: Access Control  | Medium            |
| 9   | JWT without expiration         | CWE-613 | A07: Auth            | High              |
| 10  | Debug headers in production    | CWE-489 | A05: Misconfig       | Low               |
| 11  | Open redirect                  | CWE-601 | A01: Access Control  | Medium            |
| 12  | Mass assignment                | CWE-915 | A01: Access Control  | High              |
| 13  | Missing input validation       | CWE-20  | A03: Injection       | Medium            |
| 14  | Sensitive data in query params | CWE-598 | A01: Access Control  | High              |
| 15  | Broken object property auth    | CWE-639 | A01: Access Control  | Critical          |

## Expected Scan Results

When DevPulse scans the `api-collection.json` in this repo, it should find:

- **15 total findings**
- **3 Critical** (auth, injection, secrets)
- **4 High** (crypto, JWT, mass assignment, sensitive data)
- **5 Medium** (CORS, IDOR, redirect, validation, rate limiting)
- **3 Low** (debug headers, verbose errors)

## Running the Test

```bash
# Import this collection into DevPulse
curl -X POST https://api.devpulse.in/trpc/collections.create \
  -H "Content-Type: application/json" \
  -d '{"name":"Vulnerable API Lab","format":"postman","data":@api-collection.json}'

# Run scan
curl -X POST https://api.devpulse.in/trpc/scanning.start \
  -H "Content-Type: application/json" \
  -d '{"collectionId":"<id>","type":"full"}'
```

## Validation Criteria

✅ All 15 findings detected
✅ No false positives on legitimate endpoints
✅ Severity matches expected table
✅ Remediation suggestions are actionable
✅ Confidence scores > 60 for all findings

---

_Maintained by DevPulse security team._
