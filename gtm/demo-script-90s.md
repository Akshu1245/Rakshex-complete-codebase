# RaksHex 90-Second Faceless Demo Script

**Format:** screen recording + voiceover only. No face, no talking head — per standing rule.
**Subject:** the Flow B one-click onboarding (hosted). Until `api.rakshex.in` is live, record against the local demo (`rakshex demo`) with the same shots.
**Target viewer:** a non-engineer founder who has an AI agent touching real money or real APIs.

---

## Shot list + voiceover (total ~90s)

**[0:00–0:08] Shot 1 — Signup.** Browser lands on rakshex.in, clicks "Get started", email signup, workspace auto-creates.
Voiceover: *"You give your agent a name. That's it — no terminal, no config files."*

**[0:08–0:20] Shot 2 — The three questions.** Agent name typed in. Checkboxes: send email, move money. Spending limit: ₹5,000 typed.
Voiceover: *"Three questions. What it's allowed to do, and a spending limit in rupees. Everything else — keys, policies, permission slips — gets generated for you."*

**[0:20–0:38] Shot 3 — The ₹10,000 refund attempt.** A test agent tries to issue a ₹10,000 refund. Screen shows the gate: **DENY**. A receipt appears — hash, signature, timestamp.
Voiceover: *"Now watch. The agent tries a ten-thousand-rupee refund — over its limit. RaksHex kills it before anything executes. And it leaves proof: a signed receipt you can verify offline, even years later."*

**[0:38–0:55] Shot 4 — The ₹100 attempt → approval card.** Same agent tries a ₹100 refund. Screen shows **APPROVAL_REQUIRED**; a Slack-style approval card pops up on screen. Cursor clicks Approve. Action proceeds.
Voiceover: *"A hundred rupees is inside the limit, so it asks a human instead. One tap on your phone, the action goes through. Your agent never holds the actual key — RaksHex hands it over for that one action, then takes it back."*

**[0:55–1:15] Shot 5 — The receipt bundle.** Downloads a receipt bundle; opens the "verify this proof" link; green checkmarks: signature valid, hash chain intact.
Voiceover: *"Every decision leaves a receipt. This is the part nobody else gives you: proof your agent was allowed to do that. Not a log entry you have to trust — math you can check."*

**[1:15–1:30] Shot 6 — Closing card.** Text on screen: *"RaksHex — the action control plane. Private beta. Free while we learn."* + signup link.
Voiceover: *"RaksHex. We are not a vault — we are the action control plane. Join the private beta."*

---

## Production notes

- Record at 1080p, browser zoom 125% so text reads on phones.
- Cursor movements slow and deliberate; add a subtle highlight ring on clicks in post.
- Voiceover: one continuous take, conversational, no hype words. If a line stumbles, re-record just that line.
- Captions burned in — most viewers watch muted.
- Do NOT show any real API keys, real customer names, or real money moving. Demo mode only; the ₹10,000 refund is against a sandbox.
- Do NOT claim the hosted gateway is live until `api.rakshex.in` actually is. Until then, the end card says "private beta — request access".
