# Migration Guides

Move your data from Helicone, Portkey, or Lakera to Rakshex without losing history.

---

## Helicone → Rakshex

### What Migrates

| Data              | Status      | Notes                                       |
| ----------------- | ----------- | ------------------------------------------- |
| Request logs      | ✅ Full     | All LLM calls with latency, tokens, cost    |
| Custom properties | ✅ Full     | Mapped to Rakshex metadata fields           |
| Cache metrics     | ⚠️ Partial  | Cache hit rates recomputed on first 30 days |
| User sessions     | ❌ No       | Re-authenticate users in Rakshex            |
| Alerts / webhooks | ⚠️ Recreate | Alert rules must be rebuilt in Rakshex UI   |

### Step-by-Step

**1. Export from Helicone**

```bash
# Use Helicone's export API
curl -H "Authorization: Bearer $HELICONE_API_KEY" \
  "https://api.helicone.ai/v1/request/query?limit=10000" \
  > helicone_export.json
```

**2. Preview in Rakshex**

```bash
curl -X POST https://api.rakshex.in/api/import/preview \
  -H "Content-Type: application/json" \
  -d '{
    "source": "helicone",
    "data": '$(cat helicone_export.json)'
  }'
```

**3. Execute Import**

Use the Rakshex dashboard Import page or:

```bash
curl -X POST https://api.rakshex.in/api/import/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $RAKSHEX_TOKEN" \
  -d '{
    "source": "helicone",
    "data": '$(cat helicone_export.json)'
  }'
```

**4. Verify**

- Check `/dashboard/telemetry` for imported request counts
- Compare token totals against Helicone dashboard
- Run a test scan to confirm collections are functional

**5. Redirect Traffic**

Replace your Helicone base URL (`https://oai.hconeai.com/v1`) with your Rakshex gateway URL or direct provider calls with Rakshex SDK middleware.

```typescript
// Before (Helicone)
const client = new OpenAI({
  baseURL: "https://oai.hconeai.com/v1",
  defaultHeaders: { "Helicone-Auth": "Bearer ..." }
});

// After (Rakshex)
import { Rakshex } from "@rakshex/sdk";
const dp = new Rakshex({ apiKey: "dp_..." });
const result = await dp.llm.invoke({
  model: "gpt-4o",
  messages: [...]
});
```

---

## Portkey → Rakshex

### What Migrates

| Data                | Status     | Notes                                         |
| ------------------- | ---------- | --------------------------------------------- |
| Gateway logs        | ✅ Full    | All routed requests                           |
| Prompts (versioned) | ⚠️ Partial | Export as JSON, import as Rakshex collections |
| Configs / fallbacks | ❌ No      | Rebuild in Rakshex policy engine              |
| Virtual keys        | ❌ No      | Use Rakshex API key system                    |
| Feedback logs       | ⚠️ Partial | Mapped to Rakshex audit log                   |

### Step-by-Step

**1. Export from Portkey**

```bash
# Logs
curl -H "x-portkey-api-key: $PORTKEY_API_KEY" \
  "https://api.portkey.ai/v1/logs?limit=10000" \
  > portkey_logs.json

# Prompts
curl -H "x-portkey-api-key: $PORTKEY_API_KEY" \
  "https://api.portkey.ai/v1/prompts" \
  > portkey_prompts.json
```

**2. Import to Rakshex**

Logs and prompts use different import paths:

```bash
# Import logs
curl -X POST https://api.rakshex.in/api/import/execute \
  -H "Authorization: Bearer $RAKSHEX_TOKEN" \
  -d '{ "source": "portkey", "data": '$(cat portkey_logs.json)' }'

# Import prompts as collections
curl -X POST https://api.rakshex.in/api/collections/create \
  -H "Authorization: Bearer $RAKSHEX_TOKEN" \
  -d '{ "name": "Portkey Prompts", "format": "json", "data": '$(cat portkey_prompts.json)' }'
```

**3. Recreate Gateway Configs**

Portkey's fallback chains map to Rakshex policy rules:

| Portkey Config | Rakshex Equivalent                                  |
| -------------- | --------------------------------------------------- |
| Retry strategy | Policy rule: `retry_count` condition                |
| Timeout        | Policy rule: `max_latency_ms` action: `alert_only`  |
| Fallback model | Policy rule: `model` condition + `require_approval` |
| Load balancing | Use Rakshex `routeLLM()` with weighted providers    |

**4. Update SDK**

```typescript
// Before (Portkey)
import Portkey from "portkey-ai";
const portkey = new Portkey({ apiKey: "..." });

// After (Rakshex)
import { Rakshex } from "@rakshex/sdk";
const dp = new Rakshex({ apiKey: "dp_..." });
// Rakshex handles routing, security scanning, and cost tracking automatically
```

---

## Lakera Guard → Rakshex

### What Migrates

| Data                    | Status     | Notes                                |
| ----------------------- | ---------- | ------------------------------------ |
| Prompt injection logs   | ✅ Full    | All detected attempts                |
| PII detection logs      | ✅ Full    | Mapped to Rakshex findings           |
| Custom classifier rules | ⚠️ Partial | Rewrite as Rakshex policy conditions |
| API keys                | ❌ No      | Generate new Rakshex API keys        |

### Step-by-Step

**1. Export from Lakera**

Lakera provides CSV export via the dashboard:

- Navigate to **Logs** → **Export**
- Select date range (recommend: last 90 days)
- Download CSV

**2. Convert and Import**

```bash
# Convert CSV to JSON
csvjson lakera_export.csv > lakera_export.json

# Import
curl -X POST https://api.rakshex.in/api/import/execute \
  -H "Authorization: Bearer $RAKSHEX_TOKEN" \
  -d '{ "source": "lakera", "data": '$(cat lakera_export.json)' }'
```

**3. Map Lakera Classifiers to Rakshex Policies**

| Lakera Classifier  | Rakshex Policy Rule                                |
| ------------------ | -------------------------------------------------- |
| `prompt_injection` | Built-in — no config needed                        |
| `pii`              | Built-in PII redaction + `alert_only` or `block`   |
| `custom_topic`     | Policy rule: `prompt` contains `<topic>` → `block` |
| `jailbreak`        | Built-in — part of prompt injection engine         |

Create the custom topic rules:

```bash
curl -X POST https://api.rakshex.in/api/trpc/policies.createRule \
  -H "Authorization: Bearer $RAKSHEX_TOKEN" \
  -d '{
    "name": "Block competitor mentions",
    "priority": 2,
    "conditions": {
      "operator": "AND",
      "rules": [
        { "field": "prompt", "op": "contains", "value": "competitor_name" }
      ]
    },
    "action": "block"
  }'
```

**4. Update Client Code**

```typescript
// Before (Lakera)
const response = await fetch("https://api.lakera.ai/v1/prompt_injection", {
  method: "POST",
  headers: { Authorization: "Bearer $LAKERA_API_KEY" },
  body: JSON.stringify({ input: userPrompt }),
});
const { results } = await response.json();
if (results[0].flagged) {
  /* block */
}

// After (Rakshex)
// Just send through Rakshex gateway — scanning happens automatically
const result = await dp.llm.invoke({
  model: "gpt-4o",
  messages: [{ role: "user", content: userPrompt }],
});
// If prompt injection is detected, Rakshex returns a blocked response
// with the matched rule in the metadata
```

---

## Verification Checklist

After any migration:

- [ ] Imported data count matches source export
- [ ] Token usage totals are within 5% of source
- [ ] All active users can log in to Rakshex
- [ ] API keys are rotated and tested
- [ ] Alert rules are recreated and firing correctly
- [ ] Webhook endpoints are re-registered
- [ ] First scan runs successfully on imported collections
- [ ] Kill switch is configured and tested
- [ ] Billing is active (if on paid plan)

## Support

Migration questions? Email migrate@rakshex.in or open a GitHub issue with `[Migration]` in the title.
