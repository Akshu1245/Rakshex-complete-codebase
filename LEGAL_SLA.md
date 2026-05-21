# Enterprise Service Level Agreement (SLA)

**Effective Date:** May 17, 2026
**Version:** 1.0

This Service Level Agreement ("SLA") governs the availability and support of the Rakshex Enterprise platform ("Service") provided by Rakshex Technologies Pvt. Ltd. ("Provider") to the customer ("Customer").

## 1. Definitions

- **"Uptime"** means the percentage of time the Service is available and responding to requests, excluding Scheduled Maintenance and Exclusions.
- **"Scheduled Maintenance"** means planned downtime communicated at least 48 hours in advance.
- **"Exclusions"** means downtime caused by: (a) Customer's network or equipment; (b) force majeure; (c) third-party services not controlled by Provider; (d) Customer's violation of Terms of Service.
- **"Monthly Uptime Percentage"** = (Total Minutes in Month − Downtime Minutes) / Total Minutes in Month × 100.

## 2. Service Availability

| Plan                 | Uptime Commitment | Maximum Downtime / Month |
| -------------------- | ----------------- | ------------------------ |
| Pro                  | 99.5%             | ~3.6 hours               |
| Enterprise           | 99.9%             | ~43 minutes              |
| Enterprise+ (Custom) | 99.95%            | ~22 minutes              |

## 3. Service Credits

If Provider fails to meet the Uptime Commitment in a given month, Customer is eligible for a service credit applied to the next invoice:

| Uptime Missed By | Service Credit     |
| ---------------- | ------------------ |
| 0.1% – 0.5%      | 5% of monthly fee  |
| 0.5% – 1.0%      | 10% of monthly fee |
| 1.0% – 2.0%      | 25% of monthly fee |
| > 2.0%           | 50% of monthly fee |

**Credit Request:** Customer must request the credit within 30 days of the month-end. Credits are the sole remedy for uptime failures and may not exceed one month of fees.

## 4. Scheduled Maintenance

- **Frequency:** No more than 4 hours per month
- **Notice:** Minimum 48 hours advance email notice
- **Window:** Preferably 02:00–06:00 IST (low-traffic hours)
- **Emergency maintenance:** Provider may perform urgent patches with 4 hours notice

## 5. Support Response Times

| Severity      | Definition                               | Initial Response | Resolution Target |
| ------------- | ---------------------------------------- | ---------------- | ----------------- |
| P1 — Critical | Service completely unavailable           | 15 minutes       | 4 hours           |
| P2 — High     | Major feature degraded                   | 1 hour           | 24 hours          |
| P3 — Medium   | Minor feature issue or workaround exists | 4 hours          | 72 hours          |
| P4 — Low      | General question or feature request      | 1 business day   | Best effort       |

**Support Hours:**

- Standard: Monday–Friday, 09:00–18:00 IST
- Enterprise: 24×7 for P1/P2 incidents

## 6. Data Durability

- **Database:** Daily automated backups retained for 30 days
- **Object Storage:** 99.999999999% (11 nines) durability
- **Recovery Time Objective (RTO):** 4 hours
- **Recovery Point Objective (RPO):** 1 hour

## 7. Security Commitments

- **Patching:** Critical security patches within 72 hours of public disclosure
- **Vulnerability Disclosure:** Acknowledged within 24 hours
- **Penetration Testing:** Annual third-party penetration test (Enterprise+)
- **Compliance:** SOC 2 Type 1 controls maintained (audit in progress)

## 8. Termination

Either party may terminate the Enterprise agreement with 30 days written notice. Upon termination:

- Customer data is exported and returned within 7 days
- All Customer data is deleted from Provider systems within 30 days
- Backups are purged within 90 days

## 9. Limitations

- SLA credits are not cash refunds
- Maximum aggregate liability for SLA breaches is limited to 3 months of fees
- Force majeure events (natural disasters, internet backbone failures, acts of war) are excluded from uptime calculations

## 10. Contact

- **Support:** support@rakshex.in
- **Escalation:** enterprise@rakshex.in
- **Emergency Hotline:** Enterprise+ customers receive a dedicated phone line

---

**Rakshex Technologies Pvt. Ltd.**
Bangalore, India
