# DevPulse — PMF Interview Prompts
## For first 10–25 user conversations

**Goal:** Understand if DevPulse is solving a real, recurring pain — not just a nice-to-have.

---

### Recruiting the interview

DM or email within 48 hours of install:

> "Hey [name] — thanks for trying DevPulse. Would you be up for a 15-minute call this week? I'm trying to understand what security/cost problems actually matter to developers building with AI. No sales pitch, just learning. Happy to share what we're building in return."

---

### The interview script

**Opening (2 min)**
"Tell me what you're building. What does your AI stack look like right now?"
*Listen for:* LLM providers, agent frameworks, API surface area, team size.

**The pain discovery (5 min)**
"Have you ever had a security or cost incident related to an AI agent or API? Walk me through what happened."

*If yes:* "How did you find out? How long did it take to fix? What would you have done differently?"
*If no:* "Do you ever think about whether your API keys or configs could be exposed? How do you check for that today?"
*Listen for:* Incident severity, how they currently handle this (if at all), emotional weight of the problem.

**The product reaction (5 min)**
"What did you find in your first scan with DevPulse? Did anything surprise you?"

*If findings appeared:* "How did you react to that? Is that something you'd want to fix now or later?"
*If no findings:* "Did you feel like the scan was working? What would make you more confident it was catching things?"
*Listen for:* Trust signals, reaction to findings, what they'd do next.

**The retention question (2 min)**
"If DevPulse disappeared tomorrow, what would you do instead?"

*The answer to this is the most important signal:*
- "Nothing, I'd just not worry about it" → weak PMF signal
- "I'd go back to manually checking" → pain exists, DevPulse isn't differentiated enough
- "That would actually be a problem" → strong PMF signal

**The network question (1 min)**
"Is there someone else on your team or in your network building AI agents who might run into these issues?"
*This is your referral signal.*

---

### What to do with the answers

**Strong PMF signal:**
- They found real findings on first scan
- They describe a past incident or near-miss unprompted
- They ask about team/org features
- They can't describe a good alternative

**Weak PMF signal:**
- "Interesting tool but not urgent"
- "I'd just use [other thing]"
- "I don't really have API collections to import"
- No findings, unsure if working

**Pivot signals:**
- Multiple users say the same thing is missing
- Everyone mentions a use case you haven't built
- "I'd use this if it worked with [X]"

---

### Tracking (log after each interview)

```
User: [name/handle]
Date:
Stack: [LLM providers + agent framework]
First scan findings: [count + severity]
Incident history: [yes/no + brief]
Retention answer:
Referral: [yes/no]
Key quote:
PMF signal: [strong/neutral/weak]
Follow-up needed:
```
