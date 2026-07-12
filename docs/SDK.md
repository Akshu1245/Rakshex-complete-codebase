# AgentGuard SDKs

## Node

Package: `@rakshex/agentguard-sdk` (`packages/agentguard-sdk`)

```ts
import { createAgentGuardClient, wrapOpenAI } from "@rakshex/agentguard-sdk";

const guard = createAgentGuardClient({
  apiKey: process.env.RAKSHEX_API_KEY!,
  privacyMode: "metadata_only",
  failOpen: true,
});
```

Providers: OpenAI, Anthropic, Gemini, Azure OpenAI, Bedrock, OpenRouter wrappers.

See package `README.md` and `examples/`.

## Python

Package: `rakshex-agentguard` (`packages/agentguard-python`)

```bash
pip install -e packages/agentguard-python
pytest packages/agentguard-python/tests
```

## Guarantees (tested)

- Default no prompt content capture
- Fail-open offline queue when gateway down
- Provider keys not forwarded in telemetry bodies
