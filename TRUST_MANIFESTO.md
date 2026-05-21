# Rakshex Trust Manifesto

> Security tools are trust products. This is how we earn it.
> Date: 2026-05-17

---

## 1. DATA TRANSPARENCY

### What We Collect

| Data            | Why                 | Can You See It?                    |
| --------------- | ------------------- | ---------------------------------- |
| Email           | Account, billing    | ✅ Settings → Account              |
| API collections | Security scanning   | ✅ Dashboard → Collections         |
| Scan results    | Show findings       | ✅ Dashboard → Findings            |
| Feature usage   | Product improvement | ✅ Settings → Privacy → Usage Data |
| Error reports   | Fix bugs            | ✅ Settings → Privacy → Reports    |

### What We NEVER Collect

- ❌ Your source code
- ❌ Your LLM prompts or responses
- ❌ Your API keys (we detect them, but never store the values)
- ❌ Browser history or cookies
- ❌ Personal files outside imported collections

### How to Verify

```bash
# Check what data we have about you
curl https://api.rakshex.in/trpc/user.exportData \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

## 2. SCAN EXPLAINABILITY

Every finding must answer:

### What happened?

> "Endpoint `/users/123` uses HTTP instead of HTTPS."

### Why it matters?

> "Unencrypted traffic exposes sensitive data to anyone on the same network."

### How confident are we?

> "Confidence: 92% (exact match, rich context)"

### How to fix?

> "1. Enable HTTPS on your server. 2. Add HTTP→HTTPS redirect. 3. Update collection to use `https://`."

### What if you're wrong?

> "Click 'Not relevant' — we'll learn and improve. Your feedback never leaves your account."

---

## 3. PERMISSION TRANSPARENCY

### VS Code Extension Permissions

| Permission      | Why We Need It         | Can You Deny?                |
| --------------- | ---------------------- | ---------------------------- |
| Workspace files | Scan API collections   | ❌ Required for core feature |
| Network access  | Connect to Rakshex API | ❌ Required for sync         |
| Secret storage  | Store API key securely | ❌ Required for auth         |

### What We DON'T Need

- ❌ Read all files (only collections you import)
- ❌ Execute shell commands
- ❌ Access other extensions
- ❌ Track cursor position or keystrokes

---

## 4. LOCAL-FIRST PRINCIPLES

Wherever possible, processing happens locally:

| Feature            | Local | Remote | Notes                                                      |
| ------------------ | ----- | ------ | ---------------------------------------------------------- |
| Collection parsing | ✅    | ❌     | Your collection never leaves your machine until you import |
| Secret detection   | ✅    | ✅     | Basic scan local, deep scan remote                         |
| Cost calculation   | ✅    | ✅     | Local estimate, remote accurate                            |
| Report generation  | ❌    | ✅     | PDF generation server-side                                 |

### Offline Capability

- Extension works without internet (cached data)
- Scans queue locally, sync when online
- No data lost during outages

---

## 5. AUDIT TRAIL

Every security event is logged:

```
2026-05-17T14:32:01Z  User akshay@rakshex.in  Scan started  Collection: prod-apis
2026-05-17T14:32:08Z  User akshay@rakshex.in  Finding found  Secret leak (Critical)
2026-05-17T14:35:22Z  User akshay@rakshex.in  Finding marked valid
2026-05-17T14:40:00Z  User akshay@rakshex.in  API key rotated
```

**You can:**

- Export your full audit log (Settings → Privacy → Export)
- Request deletion of all logs (Settings → Privacy → Delete Account)
- View last 30 days in dashboard

---

## 6. SECURITY ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│  Your Machine                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ VS Code Ext  │  │ Local Cache  │  │ SecretStore  │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│         │                                                │
│    TLS 1.3                                               │
│         │                                                │
└─────────┼──────────────────────────────────────────────────┘
          │
┌─────────┼──────────────────────────────────────────────────┐
│         ▼                                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Rakshex API (Render)                            │   │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌──────┐  │   │
│  │  │ Auth   │  │ Scanner│  │ Queue  │  │ Vault│  │   │
│  │  └────────┘  └────────┘  └────────┘  └──────┘  │   │
│  └──────────────────────────────────────────────────┘   │
│         │                                               │
│    Encrypted                                           │
│         │                                               │
│  ┌──────┴──────┐  ┌────────────┐  ┌────────────┐     │
│  │ MySQL (AES) │  │ Redis      │  │ BullMQ     │     │
│  └─────────────┘  └────────────┘  └────────────┘     │
└──────────────────────────────────────────────────────────┘
```

### Encryption

- **In transit:** TLS 1.3
- **At rest:** AES-256-GCM
- **Secrets vault:** AES-256-GCM + separate key
- **Backups:** Encrypted, 30-day retention

---

## 7. COMMITMENTS

### To Developers

1. **We will never sell your data.**
2. **We will always explain our findings.**
3. **You can delete everything instantly.**
4. **We open-source our scanners.**
5. **We publish our security posture.**

### To Enterprises

1. **SOC2 Type 2 by Q4 2026.**
2. **GDPR/CCPA compliant.**
3. **Audit logs retained 1 year.**
4. **On-premise deployment available.**
5. **Data residency options (EU, US, APAC).**

---

## 8. VERIFYING TRUST

### Independent Verification

- [ ] Source code available on GitHub
- [ ] Security audit by third party (annual)
- [ ] Bug bounty program on HackerOne
- [ ] Penetration test report published
- [ ] Dependency vulnerability scan (weekly)

### Self-Service Verification

```bash
# Check our security headers
curl -I https://api.rakshex.in

# Verify our SSL certificate
echo | openssl s_client -connect api.rakshex.in:443 2>/dev/null | openssl x509 -noout -text

# Check our DNS security
dig +short TXT _dmarc.rakshex.in
```

---

_Trust is our only product. This manifesto is a living document._
_Last reviewed: 2026-05-17._
