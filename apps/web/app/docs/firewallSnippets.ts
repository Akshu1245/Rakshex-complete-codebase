/**
 * Public docs snippets for the Agent Firewall hello-world.
 * Copied from packages/sdk/README.md and docs/SDK.md — do not invent a
 * different client API. @rakshex/sdk is not on the public npm registry.
 */

export const REPO_CLONE_URL = "https://github.com/Akshu1245/Rakshex-complete-codebase.git";

export const FIREWALL_INSTALL = `git clone ${REPO_CLONE_URL}
cd Rakshex-complete-codebase
pnpm install
pnpm --filter @rakshex/sdk build`;

export const FIREWALL_ADD_WORKSPACE = `pnpm add ./packages/sdk`;

export const FIREWALL_ADD_LOCAL = `pnpm add /path/to/Rakshex-complete-codebase/packages/sdk`;

/** Client constructor — matches packages/sdk/README.md */
export const FIREWALL_CLIENT = `import { createAgentFirewallClient } from "@rakshex/sdk";

const firewall = createAgentFirewallClient({
  apiKey: process.env.RAKSHEX_API_KEY!, // rk_... workspace key
  workspaceId: 1,
  agentId: "agent_123",
  capabilityToken: process.env.RAKSHEX_CAPABILITY_TOKEN!, // rk_cap_... delegated authority
});`;

/** Option A — caller holds the provider key. Copied from packages/sdk/README.md */
export const FIREWALL_AUTHORIZE_AND_RUN = `const { decision, result } = await firewall.authorizeAndRun(
  { provider: "stripe", operation: "financial.refund", amountMinor: 5000, currency: "USD" },
  async () => stripe.refunds.create({ /* ... */ }),
);`;

/** Option B — RaksHex brokers the call. Copied from packages/sdk/README.md */
export const FIREWALL_EXECUTE_WITH_CREDENTIAL = `const { decision: d2, response } = await firewall.executeWithCredential(
  { provider: "stripe", operation: "financial.refund", amountMinor: 5000, currency: "USD" },
  { credentialId: "cred_...", targetUrl: "https://api.stripe.com/v1/refunds" },
);`;
