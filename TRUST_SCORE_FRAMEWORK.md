# Rakshex Trust Score Framework

> Measuring and improving trust systematically.
> Date: 2026-05-17

---

## TRUST PILLARS

| Pillar         | Weight | Description                 |
| -------------- | ------ | --------------------------- |
| Accuracy       | 30%    | Findings are correct        |
| Transparency   | 25%    | Users understand what we do |
| Reliability    | 20%    | Product works consistently  |
| Security       | 15%    | User data is safe           |
| Responsiveness | 10%    | We respond to issues        |

---

## SCORING

### Accuracy Score (0-100)

```
True Positive Rate:     ___% (weight: 60%)
False Positive Rate:    ___% (weight: 30%)
Remediation Success:    ___% (weight: 10%)

Accuracy Score = (TPR × 0.6) + ((100 - FPR) × 0.3) + (RS × 0.1)
```

### Transparency Score (0-100)

```
Users who read privacy policy:     ___% (weight: 20%)
Users who understand data usage:   ___% (weight: 40%)
Users who feel informed:           ___% (weight: 40%)

Transparency Score = (PP × 0.2) + (DU × 0.4) + (FI × 0.4)
```

### Reliability Score (0-100)

```
Uptime (30d):           ___% (weight: 50%)
Scan success rate:      ___% (weight: 30%)
Error rate:             ___% (weight: 20%)

Reliability Score = (Uptime × 0.5) + (SSR × 0.3) + ((100 - ER) × 0.2)
```

### Security Score (0-100)

```
Data encrypted:        ✅/❌ (weight: 30%)
No code uploaded:      ✅/❌ (weight: 30%)
Audit logging:         ✅/❌ (weight: 20%)
Vulnerability program: ✅/❌ (weight: 20%)

Security Score = Σ(check × weight)
```

### Responsiveness Score (0-100)

```
Avg support response:    ___h (weight: 40%)
Bug fix time:            ___d (weight: 30%)
Feature request ack:     ___d (weight: 30%)

Responsiveness Score = based on SLA targets
```

---

## OVERALL TRUST SCORE

```
Trust Score = (Accuracy × 0.3) + (Transparency × 0.25) +
              (Reliability × 0.2) + (Security × 0.15) +
              (Responsiveness × 0.1)
```

| Score  | Level       | Meaning                      |
| ------ | ----------- | ---------------------------- |
| 90-100 | Exceptional | Users recommend unprompted   |
| 80-89  | Strong      | Users trust, minor concerns  |
| 70-79  | Good        | Users trust, some skepticism |
| 60-69  | Fair        | Users cautious               |
| < 60   | Weak        | Users skeptical              |

---

## IMPROVEMENT ROADMAP

### Accuracy

- [ ] Calibrate confidence scores against user feedback
- [ ] Reduce false positives by 20% this quarter
- [ ] Add "why" explanations to every finding

### Transparency

- [ ] Simplify privacy policy
- [ ] Add data usage infographic
- [ ] Publish monthly transparency reports

### Reliability

- [ ] Achieve 99.9% uptime
- [ ] Reduce scan failures to < 0.1%
- [ ] Add status page

### Security

- [ ] SOC2 Type II certification
- [ ] Publish security whitepaper
- [ ] Bug bounty program

### Responsiveness

- [ ] Support response < 4 hours
- [ ] Critical bug fix < 24 hours
- [ ] Feature request ack < 48 hours

---

_Framework maintained by security + product team._
_Scored monthly. Reviewed quarterly._
