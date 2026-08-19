"use client";

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";

const authorizationGuides = {
  openai: {
    title: "OpenAI API and Enterprise",
    access:
      "An organization owner or admin creates a restricted Admin API key for account telemetry and spend controls. An inference key is connected separately only when traffic should be routed through RaksHex.",
    visibility:
      "Admin access supports organization, project, key, spend alert, and audit workflows. Routed gateway traffic adds immediate pre request blocking.",
  },
  anthropic: {
    title: "Anthropic and Claude Enterprise",
    access:
      "An organization admin provides a scoped Admin API key or an org:admin OAuth authorization. Team subscription inventory can also begin with an official admin export.",
    visibility:
      "Admin access supports members, workspaces, keys, usage, cost, and rate limit reports. Immediate blocking requires applications to use the RaksHex gateway.",
  },
  azure_openai: {
    title: "Azure OpenAI",
    access:
      "A customer Azure administrator grants a RaksHex service principal only the required Azure RBAC and Cost Management scopes for the target subscription or resource group.",
    visibility:
      "Cost and API Management telemetry are provider authorized monitoring. Immediate blocking requires traffic through Azure API Management or the RaksHex gateway.",
  },
  openai_compatible: {
    title: "OpenRouter and OpenAI compatible APIs",
    access:
      "Connect a dedicated, scoped provider key. For OpenRouter, the key endpoint exposes remaining credits and per key usage; the provider remains the billing authority.",
    visibility:
      "RaksHex observes and blocks every request only when the application uses its OpenAI compatible gateway endpoint.",
  },
} as const;

const evidenceLabels: Record<string, string> = {
  openai_administration_connected: "OpenAI administration credential validated",
  openai_gateway_connected: "OpenAI inference gateway connected",
  openrouter_gateway_connected: "OpenRouter gateway connected",
  provider_sync_completed: "Provider telemetry synchronization recorded",
  team_governance_budget_set: "Routed budget policy updated",
  team_governance_kill_switch_set: "Routed traffic stop state changed",
  gateway_blocked: "RaksHex blocked a routed provider request",
  kill_switch_triggered: "Emergency stop activated",
  kill_switch_reset: "Emergency stop cleared",
  kill_switch_budget_set: "Legacy budget policy updated",
};

export default function ControlPlanePage() {
  const workspaceQuery = trpc.workspaces.listMine.useQuery();
  const workspace = workspaceQuery.data?.[0];
  const workspaceId = workspace?.id ?? 0;
  const catalogQuery = trpc.controlPlane.providers.catalog.useQuery(undefined, {
    enabled: workspaceId > 0,
  });
  const summaryQuery = trpc.controlPlane.summary.useQuery(
    { workspaceId },
    { enabled: workspaceId > 0 },
  );
  const accountsQuery = trpc.controlPlane.providers.accounts.useQuery(
    { workspaceId },
    { enabled: workspaceId > 0 },
  );
  const findingsQuery = trpc.controlPlane.discovery.list.useQuery(
    { workspaceId },
    { enabled: workspaceId > 0 },
  );
  const subscriptionsQuery = trpc.controlPlane.subscriptions.list.useQuery(
    { workspaceId },
    { enabled: workspaceId > 0 },
  );
  const resourcesQuery = trpc.controlPlane.resources.list.useQuery(
    { workspaceId },
    { enabled: workspaceId > 0 },
  );
  const credentialsQuery = trpc.controlPlane.credentials.list.useQuery(
    { workspaceId },
    { enabled: workspaceId > 0 },
  );
  const usageSummaryQuery = trpc.controlPlane.usage.summary.useQuery(
    { workspaceId },
    { enabled: workspaceId > 0 },
  );
  const gatewayBudgetsQuery = trpc.teamGovernance.listBudgets.useQuery(
    { workspaceId },
    { enabled: workspaceId > 0 },
  );
  const gatewayKillSwitchesQuery = trpc.teamGovernance.listKillSwitches.useQuery(
    { workspaceId },
    { enabled: workspaceId > 0 },
  );
  const recentEvidenceQuery = trpc.controlPlane.recentEvidence.useQuery(
    { workspaceId },
    { enabled: workspaceId > 0 },
  );
  const createAccount = trpc.controlPlane.providers.upsertAccount.useMutation({
    onSuccess: () => accountsQuery.refetch(),
  });
  const connectOpenAiGateway = trpc.controlPlane.providers.connectOpenAiGateway.useMutation({
    onSuccess: async (result) => {
      await Promise.all([
        accountsQuery.refetch(),
        credentialsQuery.refetch(),
        summaryQuery.refetch(),
      ]);
      setGatewayMessage(
        `OpenAI is connected. Route application calls through ${result.gatewayPath} with a RaksHex workspace key to enforce this control.`,
      );
      setOpenAiSecret("");
    },
  });
  const connectOpenAiAdministration =
    trpc.controlPlane.providers.connectOpenAiAdministration.useMutation({
      onSuccess: async (result) => {
        await Promise.all([
          accountsQuery.refetch(),
          credentialsQuery.refetch(),
          summaryQuery.refetch(),
          recentEvidenceQuery.refetch(),
        ]);
        setAdministrationMessage(
          `OpenAI organization ${result.organizationId} is authorized for administration telemetry and provider native controls.`,
        );
        setOpenAiAdminSecret("");
      },
    });
  const connectOpenRouterGateway = trpc.controlPlane.providers.connectOpenRouterGateway.useMutation(
    {
      onSuccess: async (result) => {
        await Promise.all([
          accountsQuery.refetch(),
          credentialsQuery.refetch(),
          summaryQuery.refetch(),
          recentEvidenceQuery.refetch(),
        ]);
        setOpenRouterMessage(
          `OpenRouter is connected. Route application calls through ${result.gatewayPath} with a RaksHex workspace key to enforce this control.`,
        );
        setOpenRouterSecret("");
      },
    },
  );
  const syncOpenAiAdministration = trpc.teamGovernance.syncProvider.useMutation({
    onSuccess: async (result) => {
      await Promise.all([
        accountsQuery.refetch(),
        usageSummaryQuery.refetch(),
        summaryQuery.refetch(),
        recentEvidenceQuery.refetch(),
      ]);
      setAdministrationMessage(
        result.status === "success" || result.status === "partial"
          ? `OpenAI synchronization completed: ${result.seatsSynced} members and ${result.usageEventsSynced} daily usage records were ingested.`
          : `OpenAI synchronization did not complete: ${"errorMessage" in result ? result.errorMessage : "provider response unavailable"}`,
      );
    },
  });
  const setGatewayBudget = trpc.teamGovernance.setBudget.useMutation({
    onSuccess: async () => {
      await gatewayBudgetsQuery.refetch();
      await recentEvidenceQuery.refetch();
      setGatewayMessage(
        "Hard gateway budget saved. RaksHex reserves the next routed request before provider execution.",
      );
    },
  });
  const setGatewayKillSwitch = trpc.teamGovernance.setKillSwitch.useMutation({
    onSuccess: async (result) => {
      await gatewayKillSwitchesQuery.refetch();
      await recentEvidenceQuery.refetch();
      setGatewayMessage(result.note);
    },
  });
  const importSubscription = trpc.controlPlane.subscriptions.import.useMutation({
    onSuccess: () => subscriptionsQuery.refetch(),
  });
  const [provider, setProvider] = useState("openai");
  const [openAiSecret, setOpenAiSecret] = useState("");
  const [openAiGatewayName, setOpenAiGatewayName] = useState("OpenAI production");
  const [openAiAdminName, setOpenAiAdminName] = useState("OpenAI organization administration");
  const [openAiAdminSecret, setOpenAiAdminSecret] = useState("");
  const [administrationMessage, setAdministrationMessage] = useState<string | null>(null);
  const [openRouterName, setOpenRouterName] = useState("OpenRouter production");
  const [openRouterSecret, setOpenRouterSecret] = useState("");
  const [openRouterMessage, setOpenRouterMessage] = useState<string | null>(null);
  const [gatewayMessage, setGatewayMessage] = useState<string | null>(null);
  const [gatewayBudgetUsd, setGatewayBudgetUsd] = useState("100");
  const [azureScopeName, setAzureScopeName] = useState("");
  const [azureReadinessMessage, setAzureReadinessMessage] = useState<string | null>(null);
  const [accountName, setAccountName] = useState("");
  const [subscriptionPlan, setSubscriptionPlan] = useState("");
  const [seatsPurchased, setSeatsPurchased] = useState("0");

  const providersByCategory = useMemo(() => {
    const groups: Record<string, typeof catalogQuery.data> = {};
    for (const item of catalogQuery.data ?? []) {
      (groups[item.category] ??= []).push(item);
    }
    return groups;
  }, [catalogQuery.data]);

  if (workspaceQuery.isLoading)
    return <div className="p-8 text-white">Loading control plane...</div>;
  if (!workspace)
    return (
      <div className="p-8 text-white">Create a workspace before using the AI control plane.</div>
    );

  const openAiGateway = (accountsQuery.data ?? []).find(
    (account) =>
      account.provider === "openai" &&
      account.accountType === "gateway_inference" &&
      account.connectionStatus === "gateway_enforced",
  );
  const openAiAdministration = (accountsQuery.data ?? []).find(
    (account) =>
      account.provider === "openai" &&
      account.accountType === "admin_telemetry" &&
      account.connectionStatus === "admin_authorized",
  );
  const openRouterGateway = (accountsQuery.data ?? []).find(
    (account) =>
      account.provider === "openai_compatible" &&
      account.accountType === "gateway_inference" &&
      account.connectionStatus === "gateway_enforced",
  );
  const azureReadinessAccount = (accountsQuery.data ?? []).find(
    (account) => account.provider === "azure_openai",
  );
  const routedGateway = openAiGateway ?? openRouterGateway;
  const routedGatewayName = openAiGateway ? "OpenAI" : openRouterGateway ? "OpenRouter" : null;
  const workspaceKillActive = (gatewayKillSwitchesQuery.data ?? []).some(
    (control) =>
      control.scopeType === "workspace" &&
      control.scopeId === String(workspaceId) &&
      control.active,
  );
  const hardGatewayBudget = (gatewayBudgetsQuery.data ?? []).find(
    (budget) => !budget.identityId && budget.enforcementMode === "gateway" && budget.hardLimit,
  );

  return (
    <main className="p-6 text-white md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header>
          <p className="text-sm uppercase tracking-widest text-blue-400">
            Universal AI Control Plane
          </p>
          <h1 className="mt-2 text-3xl font-bold">Everything your team uses to build with AI</h1>
          <p className="mt-2 max-w-3xl text-gray-400">
            Inventory providers, protect credentials, govern subscriptions, and measure usage
            without storing raw prompts.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Provider accounts", summaryQuery.data?.providers ?? 0],
            ["Active credentials", summaryQuery.data?.credentials ?? 0],
            ["Open discoveries", summaryQuery.data?.openFindings ?? 0],
            ["AI subscriptions", summaryQuery.data?.subscriptions ?? 0],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-gray-700 bg-gray-800 p-5">
              <p className="text-sm text-gray-400">{label}</p>
              <p className="mt-2 text-3xl font-semibold text-blue-300">{value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
            <h2 className="text-xl font-semibold">Provider coverage</h2>
            <p className="mt-1 text-sm text-gray-400">
              Capabilities are explicit. Unsupported provider data is never presented as verified.
            </p>
            <div className="mt-5 space-y-5">
              {Object.entries(providersByCategory).map(([category, providers]) => (
                <div key={category}>
                  <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-gray-500">
                    {category.replace("_", " ")}
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(providers ?? []).map((item) => (
                      <div key={item.id} className="rounded border border-gray-700 p-3">
                        <p className="font-medium">{item.name}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {item.capabilities.promptGateway ? "Gateway" : "Inventory"} ·{" "}
                          {item.capabilities.discoverUsage ? "Usage" : "Import/estimate"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-emerald-400/30 bg-emerald-950/20 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
              Enforced path
            </p>
            <h2 className="mt-2 text-xl font-semibold">Connect OpenAI to the RaksHex gateway</h2>
            <p className="mt-1 text-sm text-gray-400">
              RaksHex encrypts the provider key on the server. It can block the next request only
              when your application calls the RaksHex OpenAI-compatible endpoint with a workspace
              key.
            </p>
            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                setGatewayMessage(null);
                connectOpenAiGateway.mutate({
                  workspaceId,
                  displayName: openAiGatewayName,
                  credentialName: `${openAiGatewayName} inference key`,
                  secret: openAiSecret,
                });
              }}
            >
              <label className="block text-sm text-gray-300">
                Connection name
                <input
                  value={openAiGatewayName}
                  onChange={(event) => setOpenAiGatewayName(event.target.value)}
                  required
                  maxLength={255}
                  className="mt-1 w-full rounded border border-gray-600 bg-gray-900 px-3 py-2"
                  placeholder="OpenAI production"
                />
              </label>
              <label className="block text-sm text-gray-300">
                OpenAI inference key
                <input
                  value={openAiSecret}
                  onChange={(event) => setOpenAiSecret(event.target.value)}
                  type="password"
                  minLength={8}
                  required
                  className="mt-1 w-full rounded border border-gray-600 bg-gray-900 px-3 py-2"
                  placeholder="Paste only with authorization"
                />
              </label>
              <button
                disabled={connectOpenAiGateway.isPending || !workspaceId || openAiSecret.length < 8}
                className="rounded bg-emerald-400 px-4 py-2 font-medium text-emerald-950 hover:bg-emerald-300 disabled:opacity-50"
              >
                {connectOpenAiGateway.isPending ? "Connecting..." : "Connect enforced gateway"}
              </button>
            </form>
            {gatewayMessage && (
              <div className="mt-5 rounded border border-emerald-400/35 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                {gatewayMessage}
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-xl border border-sky-300/25 bg-sky-950/20 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
              Authorized provider telemetry
            </p>
            <h2 className="mt-2 text-xl font-semibold">Connect OpenAI administration</h2>
            <p className="mt-1 text-sm leading-6 text-gray-400">
              This is separate from inference routing. A customer organization admin supplies an
              OpenAI Admin API key; RaksHex validates it with OpenAI before encrypting it, then uses
              it only for approved organization administration, spend, and audit workflows.
            </p>
            <form
              className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                setAdministrationMessage(null);
                connectOpenAiAdministration.mutate({
                  workspaceId,
                  displayName: openAiAdminName,
                  credentialName: `${openAiAdminName} Admin API key`,
                  secret: openAiAdminSecret,
                });
              }}
            >
              <label className="text-sm text-gray-300">
                Connection name
                <input
                  value={openAiAdminName}
                  onChange={(event) => setOpenAiAdminName(event.target.value)}
                  required
                  maxLength={255}
                  className="mt-1 block w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white"
                />
              </label>
              <label className="text-sm text-gray-300">
                OpenAI Admin API key
                <input
                  value={openAiAdminSecret}
                  onChange={(event) => setOpenAiAdminSecret(event.target.value)}
                  type="password"
                  minLength={8}
                  required
                  className="mt-1 block w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white"
                  placeholder="Provided by an organization admin"
                />
              </label>
              <button
                disabled={
                  connectOpenAiAdministration.isPending ||
                  !workspaceId ||
                  openAiAdminSecret.length < 8
                }
                className="rounded bg-sky-300 px-4 py-2 text-sm font-semibold text-sky-950 hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {connectOpenAiAdministration.isPending ? "Validating..." : "Authorize telemetry"}
              </button>
            </form>
            {administrationMessage && (
              <p
                role="status"
                className="mt-4 rounded border border-sky-300/25 bg-sky-300/10 px-4 py-3 text-sm text-sky-100"
              >
                {administrationMessage}
              </p>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
              <button
                type="button"
                disabled={!openAiAdministration || syncOpenAiAdministration.isPending}
                onClick={() =>
                  openAiAdministration &&
                  syncOpenAiAdministration.mutate({
                    workspaceId,
                    provider: "openai",
                    providerAccountId: openAiAdministration.id,
                  })
                }
                className="rounded border border-sky-300/45 px-3 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-300/10 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {syncOpenAiAdministration.isPending ? "Synchronizing..." : "Sync OpenAI now"}
              </button>
              <span className="text-xs text-gray-500">
                {openAiAdministration
                  ? `Credential validated · ${openAiAdministration.syncStatus.replaceAll("_", " ")}`
                  : "Connect and validate an Admin API key before the first sync."}
              </span>
            </div>
          </div>
          <aside className="rounded-xl border border-amber-300/20 bg-amber-950/15 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
              OpenAI compatible control
            </p>
            <h3 className="mt-2 font-semibold">Connect OpenRouter to the gateway</h3>
            <p className="mt-2 text-sm leading-6 text-gray-400">
              RaksHex validates a dedicated OpenRouter key against the provider, encrypts it, and
              routes selected traffic through the same pre request budget and stop controls.
              Provider credit information remains provider reported and is not a replacement for a
              RaksHex routed hard limit.
            </p>
            <form
              className="mt-5 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                setOpenRouterMessage(null);
                connectOpenRouterGateway.mutate({
                  workspaceId,
                  displayName: openRouterName,
                  credentialName: `${openRouterName} gateway API key`,
                  secret: openRouterSecret,
                });
              }}
            >
              <label className="block text-sm text-gray-300">
                Connection name
                <input
                  value={openRouterName}
                  onChange={(event) => setOpenRouterName(event.target.value)}
                  required
                  maxLength={255}
                  className="mt-1 w-full rounded border border-gray-600 bg-gray-900 px-3 py-2"
                />
              </label>
              <label className="block text-sm text-gray-300">
                Dedicated OpenRouter key
                <input
                  value={openRouterSecret}
                  onChange={(event) => setOpenRouterSecret(event.target.value)}
                  type="password"
                  minLength={8}
                  required
                  className="mt-1 w-full rounded border border-gray-600 bg-gray-900 px-3 py-2"
                  placeholder="Customer authorized key only"
                />
              </label>
              <button
                disabled={
                  connectOpenRouterGateway.isPending || !workspaceId || openRouterSecret.length < 8
                }
                className="rounded bg-amber-300 px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {connectOpenRouterGateway.isPending
                  ? "Validating..."
                  : openRouterGateway
                    ? "Rotate OpenRouter key"
                    : "Connect OpenRouter gateway"}
              </button>
            </form>
            {openRouterMessage && (
              <p
                role="status"
                className="mt-4 rounded border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-50"
              >
                {openRouterMessage}
              </p>
            )}
          </aside>
        </section>

        <section className="rounded-xl border border-emerald-300/25 bg-gradient-to-br from-emerald-950/35 to-slate-950 p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                RaksHex mediated control
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                Make the budget and emergency stop real
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-300">
                {routedGateway
                  ? `${routedGatewayName} is connected to the RaksHex gateway. Requests using a RaksHex workspace key are evaluated, budget reserved, audited, and only then sent upstream.`
                  : "Connect an OpenAI or OpenRouter inference key above, then point your application’s OpenAI compatible base URL at RaksHex. Direct provider traffic remains outside this control."}
              </p>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                routedGateway
                  ? "border-emerald-300/45 bg-emerald-300/10 text-emerald-200"
                  : "border-amber-300/35 bg-amber-300/10 text-amber-100"
              }`}
            >
              {routedGateway ? `${routedGatewayName} gateway connected` : "Gateway not connected"}
            </span>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_auto]">
            <div className="rounded-lg border border-white/10 bg-black/20 p-5">
              <h3 className="font-semibold">Hard routed budget</h3>
              <p className="mt-1 text-sm text-gray-400">
                RaksHex blocks a routed request if the reserved estimate would exceed this workspace
                limit. Provider dashboards and direct calls are not used for this decision.
              </p>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <label className="text-sm text-gray-300">
                  Monthly limit in USD
                  <input
                    value={gatewayBudgetUsd}
                    onChange={(event) => setGatewayBudgetUsd(event.target.value)}
                    type="number"
                    min="1"
                    step="1"
                    className="mt-1 block w-40 rounded border border-white/15 bg-black/35 px-3 py-2 text-white"
                  />
                </label>
                <button
                  type="button"
                  disabled={
                    !routedGateway || setGatewayBudget.isPending || Number(gatewayBudgetUsd) <= 0
                  }
                  onClick={() =>
                    setGatewayBudget.mutate({
                      workspaceId,
                      limitUsd: Number(gatewayBudgetUsd),
                      warningPct: 80,
                      hardLimit: true,
                      enforcementMode: "gateway",
                    })
                  }
                  className="rounded bg-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {setGatewayBudget.isPending ? "Saving..." : "Enforce this budget"}
                </button>
                {hardGatewayBudget && (
                  <span className="text-sm text-emerald-200">
                    Active: ${hardGatewayBudget.limitUsd} limit · $
                    {hardGatewayBudget.currentSpendUsd} used
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-red-300/25 bg-red-950/20 p-5 lg:w-80">
              <h3 className="font-semibold text-red-100">Immediate routed stop</h3>
              <p className="mt-1 text-sm leading-6 text-red-100/70">
                {workspaceKillActive
                  ? "The workspace kill switch is active. RaksHex rejects new routed requests before they reach the provider."
                  : "Use only for an active incident. This blocks new RaksHex routed requests, not direct provider traffic."}
              </p>
              <button
                type="button"
                disabled={!routedGateway || setGatewayKillSwitch.isPending}
                onClick={() =>
                  setGatewayKillSwitch.mutate({
                    workspaceId,
                    scopeType: "workspace",
                    scopeId: String(workspaceId),
                    active: !workspaceKillActive,
                    reason: workspaceKillActive
                      ? "Operator cleared the RaksHex routed traffic stop"
                      : "Operator activated an immediate RaksHex routed traffic stop",
                  })
                }
                className={`mt-4 w-full rounded px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${
                  workspaceKillActive
                    ? "bg-white/10 text-white hover:bg-white/15"
                    : "bg-red-400 text-red-950 hover:bg-red-300"
                }`}
              >
                {setGatewayKillSwitch.isPending
                  ? "Updating..."
                  : workspaceKillActive
                    ? "Restore routed traffic"
                    : "Stop routed traffic now"}
              </button>
            </div>
          </div>
          {gatewayMessage && (
            <p
              role="status"
              className="mt-4 rounded border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100"
            >
              {gatewayMessage}
            </p>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
            <h2 className="text-xl font-semibold">Add a provider account</h2>
            <p className="mt-1 text-sm text-gray-400">
              Use this for an organization, cloud tenant, project, or self-hosted endpoint. It does
              not require a runtime key.
            </p>
            <form
              className="mt-5 grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                createAccount.mutate(
                  {
                    workspaceId,
                    provider: provider as never,
                    accountType: "organization",
                    displayName: accountName,
                    authMethod: "manual_import",
                  },
                  { onSuccess: () => setAccountName("") },
                );
              }}
            >
              <label className="block text-sm text-gray-300">
                Provider
                <select
                  value={provider}
                  onChange={(event) => setProvider(event.target.value)}
                  className="mt-1 w-full rounded border border-gray-600 bg-gray-900 px-3 py-2"
                >
                  {(catalogQuery.data ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-gray-300">
                Account name
                <input
                  value={accountName}
                  onChange={(event) => setAccountName(event.target.value)}
                  required
                  maxLength={255}
                  className="mt-1 w-full rounded border border-gray-600 bg-gray-900 px-3 py-2"
                  placeholder="Acme Azure production"
                />
              </label>
              <button
                disabled={createAccount.isPending || !workspaceId}
                className="w-fit rounded bg-blue-600 px-4 py-2 font-medium hover:bg-blue-500 disabled:opacity-50"
              >
                {createAccount.isPending ? "Adding..." : "Add account"}
              </button>
            </form>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
            <h2 className="text-xl font-semibold">Record a team subscription</h2>
            <p className="mt-1 text-sm text-gray-400">
              Seats, plans, and renewals are entitlements. They remain separate from provider API
              credentials.
            </p>
            <form
              className="mt-5 grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                importSubscription.mutate(
                  {
                    workspaceId,
                    provider: provider as never,
                    plan: subscriptionPlan,
                    seatsPurchased: Number(seatsPurchased),
                    seatsUsed: 0,
                    source: "manual",
                    confidence: "imported",
                  },
                  {
                    onSuccess: () => {
                      setSubscriptionPlan("");
                      setSeatsPurchased("0");
                    },
                  },
                );
              }}
            >
              <label className="block text-sm text-gray-300">
                Plan
                <input
                  value={subscriptionPlan}
                  onChange={(event) => setSubscriptionPlan(event.target.value)}
                  required
                  maxLength={128}
                  className="mt-1 w-full rounded border border-gray-600 bg-gray-900 px-3 py-2"
                  placeholder="Copilot Business or Claude Team"
                />
              </label>
              <label className="block text-sm text-gray-300">
                Seats purchased
                <input
                  value={seatsPurchased}
                  onChange={(event) => setSeatsPurchased(event.target.value)}
                  type="number"
                  min="0"
                  required
                  className="mt-1 w-full rounded border border-gray-600 bg-gray-900 px-3 py-2"
                />
              </label>
              <button
                disabled={importSubscription.isPending || !workspaceId}
                className="w-fit rounded bg-blue-600 px-4 py-2 font-medium hover:bg-blue-500 disabled:opacity-50"
              >
                {importSubscription.isPending ? "Recording..." : "Record subscription"}
              </button>
            </form>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
            <h2 className="text-lg font-semibold">Credentials</h2>
            <p className="mt-3 text-3xl text-green-300">{credentialsQuery.data?.length ?? 0}</p>
            <p className="mt-1 text-sm text-gray-500">masked records only</p>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
            <h2 className="text-lg font-semibold">Subscriptions</h2>
            <p className="mt-3 text-3xl text-purple-300">{subscriptionsQuery.data?.length ?? 0}</p>
            <p className="mt-1 text-sm text-gray-500">verified, imported, or estimated</p>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
            <h2 className="text-lg font-semibold">Discovery findings</h2>
            <p className="mt-3 text-3xl text-orange-300">{findingsQuery.data?.length ?? 0}</p>
            <p className="mt-1 text-sm text-gray-500">raw file contents are never stored</p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
            <h2 className="text-xl font-semibold">Team access and seats</h2>
            <p className="mt-1 text-sm text-gray-400">
              Seats are tracked independently from API credentials.
            </p>
            <div className="mt-4 divide-y divide-gray-700">
              {(subscriptionsQuery.data ?? []).map((subscription) => (
                <div key={subscription.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="font-medium">{subscription.plan}</p>
                    <p className="text-xs text-gray-500">
                      {subscription.provider} · {subscription.source} · {subscription.confidence}
                    </p>
                  </div>
                  <p className="text-sm text-gray-300">
                    {subscription.seatsUsed}/{subscription.seatsPurchased} seats
                  </p>
                </div>
              ))}
              {!subscriptionsQuery.data?.length && (
                <p className="py-4 text-sm text-gray-500">No subscriptions imported yet.</p>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
            <h2 className="text-xl font-semibold">Cloud and provider hierarchy</h2>
            <p className="mt-1 text-sm text-gray-400">
              Tenants, subscriptions, projects, endpoints, and resources.
            </p>
            <div className="mt-4 divide-y divide-gray-700">
              {(resourcesQuery.data ?? []).slice(0, 8).map((resource) => (
                <div key={resource.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="font-medium">{resource.displayName}</p>
                    <p className="text-xs text-gray-500">
                      {resource.provider} · {resource.resourceType}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">{resource.confidence}</span>
                </div>
              ))}
              {!resourcesQuery.data?.length && (
                <p className="py-4 text-sm text-gray-500">No provider resources discovered yet.</p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-sky-300/20 bg-slate-900/70 p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
            Customer authorization map
          </p>
          <h2 className="mt-2 text-2xl font-semibold">What a team plan gives RaksHex access to</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
            A team subscription is not an API key. RaksHex can track seats or provider reported
            usage only when an authorized administrator connects the provider, grants an approved
            role, or imports an official export. No connection means inventory only.
          </p>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {Object.entries(authorizationGuides).map(([providerId, guide]) => {
              const account = (accountsQuery.data ?? []).find(
                (candidate) => candidate.provider === providerId,
              );
              return (
                <article
                  key={providerId}
                  className="rounded-lg border border-white/10 bg-black/20 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold">{guide.title}</h3>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        account
                          ? "bg-emerald-300/10 text-emerald-200"
                          : "bg-slate-700 text-slate-300"
                      }`}
                    >
                      {account
                        ? account.connectionStatus.replaceAll("_", " ")
                        : "authorization needed"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-gray-300">{guide.access}</p>
                  <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-5 text-sky-100/75">
                    {guide.visibility}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-xl border border-blue-300/20 bg-blue-950/15 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
              Azure OpenAI readiness
            </p>
            <h2 className="mt-2 text-xl font-semibold">
              Record the authorized Azure control scope
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
              Azure OpenAI requires Azure RBAC and cost management authorization, not an OpenAI
              organization key. Start by recording the subscription or resource group that the
              customer wants RaksHex to govern. The customer then grants a dedicated RaksHex service
              principal only the Azure OpenAI, Cost Management Reader, and API Management access
              needed for that scope.
            </p>
            <form
              className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                setAzureReadinessMessage(null);
                createAccount.mutate(
                  {
                    workspaceId,
                    provider: "azure_openai",
                    accountType: "azure_subscription",
                    displayName: azureScopeName,
                    authMethod: "cloud_role",
                    metadata: {
                      connectionState: "awaiting_customer_azure_rbac",
                      requiredRoles: [
                        "Cognitive Services OpenAI User",
                        "Cost Management Reader",
                        "Azure API Management access when routed enforcement is selected",
                      ],
                    },
                  },
                  {
                    onSuccess: () => {
                      setAzureReadinessMessage(
                        "Azure scope recorded. RaksHex remains in readiness mode until the customer grants the scoped Azure roles and chooses a routed control point.",
                      );
                      setAzureScopeName("");
                    },
                  },
                );
              }}
            >
              <label className="block flex-1 text-sm text-gray-300">
                Azure subscription or resource group
                <input
                  value={azureScopeName}
                  onChange={(event) => setAzureScopeName(event.target.value)}
                  required
                  maxLength={255}
                  className="mt-1 w-full rounded border border-gray-600 bg-gray-900 px-3 py-2"
                  placeholder="Production AI subscription"
                />
              </label>
              <button
                disabled={createAccount.isPending || !workspaceId || !azureScopeName.trim()}
                className="rounded bg-blue-300 px-4 py-2 text-sm font-semibold text-blue-950 hover:bg-blue-200 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {createAccount.isPending
                  ? "Recording..."
                  : azureReadinessAccount
                    ? "Record another Azure scope"
                    : "Prepare Azure scope"}
              </button>
            </form>
            {azureReadinessMessage && (
              <p
                role="status"
                className="mt-4 rounded border border-blue-300/25 bg-blue-300/10 px-4 py-3 text-sm text-blue-50"
              >
                {azureReadinessMessage}
              </p>
            )}
          </div>
          <aside className="rounded-xl border border-white/10 bg-black/20 p-6">
            <h3 className="font-semibold">Azure enforcement boundary</h3>
            <p className="mt-2 text-sm leading-6 text-gray-400">
              Cost Management Reader provides reported cost visibility. It does not stop model
              calls. To block the next Azure request, the customer chooses either an Azure API
              Management AI gateway or the RaksHex gateway as the application traffic path. Direct
              Azure endpoint calls remain outside RaksHex control.
            </p>
            <p className="mt-4 border-t border-white/10 pt-4 text-xs leading-5 text-blue-100/75">
              The first Azure step is inventory and authorization planning, not a claim that Azure
              data is already connected.
            </p>
          </aside>
        </section>

        <section
          aria-labelledby="provider-evidence-heading"
          className="rounded-xl border border-violet-300/20 bg-violet-950/15 p-6 md:p-8"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
                Operator evidence
              </p>
              <h2 id="provider-evidence-heading" className="mt-2 text-2xl font-semibold">
                Recent provider control records
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
                This timeline records only workspace scoped control events. It never displays
                provider secrets, raw prompts, or unfiltered audit metadata.
              </p>
            </div>
            <span className="rounded-full border border-violet-300/25 bg-violet-300/10 px-3 py-1 text-xs font-semibold text-violet-100">
              {recentEvidenceQuery.data?.length ?? 0} recent records
            </span>
          </div>
          <div className="mt-6 divide-y divide-white/10 rounded-lg border border-white/10 bg-black/20">
            {recentEvidenceQuery.isLoading && (
              <p className="px-4 py-5 text-sm text-gray-400">Loading workspace evidence...</p>
            )}
            {(recentEvidenceQuery.data ?? []).map((event) => (
              <div
                key={event.id}
                className="flex flex-col gap-1 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-sm font-medium text-violet-50">
                  {evidenceLabels[event.action] ?? event.action.replaceAll("_", " ")}
                </p>
                <time
                  dateTime={event.createdAt.toISOString()}
                  className="text-xs text-violet-100/60"
                >
                  {event.createdAt.toLocaleString()}
                </time>
              </div>
            ))}
            {!recentEvidenceQuery.isLoading && !recentEvidenceQuery.data?.length && (
              <p className="px-4 py-5 text-sm text-gray-400">
                No provider control events have been recorded for this workspace yet.
              </p>
            )}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Usage by team member</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Reconcile API consumption with assigned seats and service access.
                </p>
              </div>
              <p className="text-right text-sm text-teal-300">
                ${usageSummaryQuery.data?.totalCostUsd.toFixed(2) ?? "0.00"}
                <span className="block text-xs text-gray-500">
                  {usageSummaryQuery.data?.totalRequests ?? 0} requests
                </span>
              </p>
            </div>
            <div className="mt-5 divide-y divide-gray-700">
              {(usageSummaryQuery.data?.byUser ?? []).slice(0, 8).map((member) => (
                <div key={member.userId} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {member.name || member.email || `User ${member.userId}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      {member.requests} requests · {member.tokens.toLocaleString()} tokens
                    </p>
                  </div>
                  <p className="text-sm text-gray-200">${member.costUsd.toFixed(2)}</p>
                </div>
              ))}
              {!usageSummaryQuery.data?.byUser.length && (
                <p className="py-4 text-sm text-gray-500">
                  Usage appears here after gateway or telemetry ingestion.
                </p>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
            <h2 className="text-xl font-semibold">Limits and notifications</h2>
            <p className="mt-1 text-sm leading-6 text-gray-400">
              Set cost budgets, alert rules, and a kill switch before granting production access.
              Budget warnings and policy violations are delivered through the notification center
              and configured alert channels.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href="/token-analytics"
                className="rounded border border-teal-500/60 px-3 py-2 text-sm font-medium text-teal-300 hover:bg-teal-500/10"
              >
                Usage and budgets
              </a>
              <a
                href="/notifications"
                className="rounded border border-gray-600 px-3 py-2 text-sm font-medium text-gray-200 hover:border-gray-400"
              >
                Notification center
              </a>
              <a
                href="/kill-switch"
                className="rounded border border-gray-600 px-3 py-2 text-sm font-medium text-gray-200 hover:border-gray-400"
              >
                Kill switch
              </a>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-gray-700 bg-gray-800 p-6">
          <h2 className="text-xl font-semibold">Trust boundary</h2>
          <div className="mt-4 grid gap-3 text-sm text-gray-300 md:grid-cols-3">
            <p>✓ Credentials encrypted at rest</p>
            <p>✓ Prompts are not retained by this inventory layer</p>
            <p>✓ Workspace authorization on every operation</p>
          </div>
        </section>
      </div>
    </main>
  );
}
