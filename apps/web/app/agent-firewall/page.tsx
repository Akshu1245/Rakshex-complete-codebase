"use client";

import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { trpc } from "@/lib/trpc";
import { DecisionTrace } from "@/components/agent-firewall/DecisionTrace";
import { LedgerTimeline } from "@/components/agent-firewall/LedgerTimeline";

const DEFAULT_ACTIONS = ["financial.refund", "code.pr.create", "database.read", "mcp.*"];

const CREDENTIAL_PROVIDER_PRESETS = {
  razorpay: {
    label: "Razorpay",
    provider: "razorpay",
    origin: "https://api.razorpay.com",
    injection: "basic" as const,
    headerName: "",
    actions: "financial.refund",
    secretPlaceholder: "key_id:key_secret",
    help: "Use Basic auth with a restricted key for the pilot.",
  },
  stripe: {
    label: "Stripe",
    provider: "stripe",
    origin: "https://api.stripe.com",
    injection: "bearer" as const,
    headerName: "",
    actions: "financial.refund",
    secretPlaceholder: "sk_live_…",
    help: "Use a restricted Stripe key where possible.",
  },
  github: {
    label: "GitHub",
    provider: "github",
    origin: "https://api.github.com",
    injection: "bearer" as const,
    headerName: "",
    actions: "code.pr.create",
    secretPlaceholder: "github_pat_…",
    help: "Use a fine grained token scoped to the repositories the agent may touch.",
  },
  custom: {
    label: "Custom HTTP API",
    provider: "custom",
    origin: "https://api.example.com",
    injection: "header" as const,
    headerName: "X-Api-Key",
    actions: "mcp.*",
    secretPlaceholder: "provider secret",
    help: "Use Custom only when a preset does not match the provider.",
  },
};

type CredentialProviderPreset = keyof typeof CREDENTIAL_PROVIDER_PRESETS;
type AgentFirewallView = "onboard" | "operate";

export default function AgentFirewallPage() {
  const { workspaceId, workspace, isLoading } = useWorkspace();
  const enabled = workspaceId > 0;
  const identities = trpc.agentFirewall.identities.list.useQuery(
    { workspaceId },
    { enabled, retry: false },
  );
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [activeView, setActiveView] = useState<AgentFirewallView>("onboard");
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledgerDecision, setLedgerDecision] = useState<
    "all" | "ALLOW" | "DENY" | "APPROVAL_REQUIRED"
  >("all");
  const agentId = selectedAgentId || identities.data?.[0]?.id || "";
  const authorities = trpc.agentFirewall.authorities.list.useQuery(
    { workspaceId, agentId: agentId || undefined },
    { enabled: enabled && Boolean(agentId), retry: false },
  );
  const ledger = trpc.agentFirewall.ledger.list.useQuery(
    { workspaceId, agentId: agentId || undefined, limit: 30 },
    { enabled, retry: false },
  );
  const report = trpc.agentFirewall.shadowReport.useQuery(
    { workspaceId, agentId: agentId || undefined, days: 7 },
    { enabled, retry: false },
  );
  const approvals = trpc.agentFirewall.approvals.list.useQuery(
    { workspaceId, status: "pending" },
    { enabled, retry: false },
  );
  const credentials = trpc.agentFirewall.credentials.list.useQuery(
    { workspaceId },
    { enabled, retry: false },
  );
  const egress = trpc.agentFirewall.credentials.egressLog.useQuery(
    { workspaceId, limit: 20 },
    { enabled, retry: false },
  );

  const [agentName, setAgentName] = useState("");
  const [agentKey, setAgentKey] = useState("");
  const [capabilityToken, setCapabilityToken] = useState("");
  const [resource, setResource] = useState("customer:1827");
  const [amount, setAmount] = useState("100000");
  const [provider, setProvider] = useState("razorpay");
  const [operation, setOperation] = useState("refund.create");
  const [lastDecision, setLastDecision] = useState<{
    decision: string;
    effectiveDecision: string;
    reasons: string[];
    normalizedAction?: { name: string };
  } | null>(null);

  const [credPreset, setCredPreset] = useState<CredentialProviderPreset>("razorpay");
  const activeAgent = useMemo(
    () => identities.data?.find((agent) => agent.id === agentId),
    [agentId, identities.data],
  );

  const activeAuthority = authorities.data?.find((item) => item.status === "active");
  const activeCredentials =
    credentials.data?.credentials?.filter((credential) => credential.status === "active") ?? [];
  const filteredLedgerRows = useMemo(() => {
    const query = ledgerSearch.trim().toLowerCase();
    return (ledger.data ?? []).filter((row) => {
      const decisionMatches = ledgerDecision === "all" || row.decision === ledgerDecision;
      const queryMatches =
        !query ||
        row.semanticAction.toLowerCase().includes(query) ||
        (row.resource ?? "").toLowerCase().includes(query) ||
        row.outcomeStatus.toLowerCase().includes(query) ||
        row.id.toLowerCase().includes(query);
      return decisionMatches && queryMatches;
    });
  }, [ledger.data, ledgerDecision, ledgerSearch]);

  const onboardingSteps = [
    {
      label: "Agent registered",
      complete: Boolean(agentId),
      detail: activeAgent?.name ?? "Create or select an agent identity.",
    },
    {
      label: "Authority delegated",
      complete: Boolean(activeAuthority || capabilityToken),
      detail:
        activeAuthority || capabilityToken
          ? "A scoped authority is available."
          : "Create a scoped capability token.",
    },
    {
      label: "Credential brokered",
      complete: activeCredentials.length > 0,
      detail:
        activeCredentials.length > 0
          ? `${activeCredentials.length} active credential(s).`
          : "Store at least one provider credential.",
    },
    {
      label: "Decision tested",
      complete: Boolean(lastDecision || (ledger.data?.length ?? 0) > 0),
      detail:
        lastDecision || (ledger.data?.length ?? 0) > 0
          ? "A decision is recorded in the ledger."
          : "Evaluate a sample action before enforcing.",
    },
  ];

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#operate")
      setActiveView("operate");
  }, []);

  const showView = (view: AgentFirewallView) => {
    setActiveView(view);
    if (typeof window !== "undefined")
      window.history.replaceState(null, "", view === "operate" ? "#operate" : "#onboard");
  };

  const switchAgentMode = () => {
    if (!activeAgent) return;
    const nextMode = activeAgent.mode === "shadow" ? "enforce" : "shadow";
    if (nextMode === "enforce") {
      const warning =
        activeCredentials.length > 0
          ? "Switch to Enforce? Confirm the agent no longer has raw provider credentials and sensitive calls are routed through the RaksHex broker."
          : "No active brokered credentials are configured. Enforce mode can still be bypassed if the agent has raw provider keys or direct egress. Switch anyway?";
      if (!window.confirm(warning)) return;
    }
    setMode.mutate({ workspaceId, agentId: activeAgent.id, mode: nextMode });
  };

  const applyCredentialPreset = (presetKey: CredentialProviderPreset) => {
    const preset = CREDENTIAL_PROVIDER_PRESETS[presetKey];
    setCredPreset(presetKey);
    setCredProvider(preset.provider);
    setCredOrigin(preset.origin);
    setCredActions(preset.actions);
    setCredInjection(preset.injection);
    setCredHeaderName(preset.headerName);
  };

  const refresh = async () => {
    await Promise.all([
      identities.refetch(),
      authorities.refetch(),
      ledger.refetch(),
      report.refetch(),
      approvals.refetch(),
      credentials.refetch(),
      egress.refetch(),
    ]);
  };

  const createAgent = trpc.agentFirewall.identities.create.useMutation({
    onSuccess: async (agent) => {
      setSelectedAgentId(agent?.id ?? "");
      setAgentName("");
      setAgentKey("");
      await refresh();
    },
  });
  const createAuthority = trpc.agentFirewall.authorities.create.useMutation({
    onSuccess: async (result) => {
      setCapabilityToken(result.capabilityToken);
      await refresh();
    },
  });
  const setMode = trpc.agentFirewall.identities.setMode.useMutation({ onSuccess: refresh });
  const evaluate = trpc.agentFirewall.evaluate.useMutation({
    onSuccess: async (result) => {
      setLastDecision({
        decision: result.decision,
        effectiveDecision: result.effectiveDecision,
        reasons: result.reasons,
        normalizedAction: result.normalizedAction,
      });
      await refresh();
    },
  });
  const resolveApproval = trpc.agentFirewall.approvals.resolve.useMutation({ onSuccess: refresh });

  // ── Brokered credentials ────────────────────────────────────────────────
  const [credName, setCredName] = useState("");
  const [credProvider, setCredProvider] = useState("razorpay");
  const [credSecret, setCredSecret] = useState("");
  const [credOrigin, setCredOrigin] = useState("https://api.razorpay.com");
  const [credActions, setCredActions] = useState("financial.refund");
  const [credInjection, setCredInjection] = useState<"bearer" | "header" | "basic">("basic");
  const [credHeaderName, setCredHeaderName] = useState("");
  const createCredential = trpc.agentFirewall.credentials.create.useMutation({
    onSuccess: async () => {
      // Clear the secret from component state the moment it is stored — it is
      // write-only from here on and the server never returns it again.
      setCredSecret("");
      setCredName("");
      await refresh();
    },
  });
  const revokeCredential = trpc.agentFirewall.credentials.revoke.useMutation({
    onSuccess: refresh,
  });

  if (isLoading) return <main className="p-8 text-white">Loading Agent Firewall…</main>;
  if (!workspace)
    return (
      <main className="p-8 text-white">
        Create a workspace first. Agent identities and decisions are always workspace-scoped.
      </main>
    );

  const error =
    identities.error ??
    createAgent.error ??
    createAuthority.error ??
    evaluate.error ??
    setMode.error ??
    resolveApproval.error;

  return (
    <main className="p-5 pb-16 text-white md:p-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="rounded-2xl border border-glass bg-surface-container-low/60 p-5 shadow-2xl shadow-black/10 md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="font-label-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                Runtime authorization
              </p>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Agent Firewall</h1>
              <p className="max-w-3xl text-sm leading-6 text-on-surface-variant md:text-base">
                RaksHex identifies the agent, normalizes the requested business action, checks its
                delegated authority and records the decision before a real system changes.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary-container/20 px-3 py-1.5 text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                {workspace.name} workspace
              </span>
              <span className="rounded-full border border-glass bg-surface-base/60 px-3 py-1.5 text-on-surface-variant">
                {activeAgent ? `${activeAgent.name} · ${activeAgent.mode}` : "No agent selected"}
              </span>
            </div>
          </div>
        </header>

        <div
          role="tablist"
          aria-label="Agent Firewall workspace sections"
          className="sticky top-20 z-20 flex flex-wrap gap-2 rounded-2xl border border-glass bg-surface-container-low/90 p-1.5 shadow-xl shadow-black/10 backdrop-blur-xl"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "onboard"}
            aria-controls="agent-firewall-onboarding"
            onClick={() => showView("onboard")}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${activeView === "onboard" ? "bg-primary text-on-primary shadow-lg shadow-primary/20" : "text-on-surface-variant hover:bg-surface-base/70 hover:text-white"}`}
          >
            Five minute onboarding
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "operate"}
            aria-controls="agent-firewall-operate"
            onClick={() => showView("operate")}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${activeView === "operate" ? "bg-primary text-on-primary shadow-lg shadow-primary/20" : "text-on-surface-variant hover:bg-surface-base/70 hover:text-white"}`}
          >
            Operational control plane
          </button>
        </div>

        <div
          role="note"
          className="rounded-2xl border border-status-warning/30 bg-status-warning/10 p-4 text-sm leading-6 text-status-warning shadow-lg shadow-status-warning/5"
        >
          <p className="font-semibold text-amber-50">Coverage warning</p>
          <p className="mt-1">
            Enforcement is only as strong as the protected path. A DENY blocks access when the
            action is routed through a brokered RaksHex credential and the agent no longer has the
            raw provider key. Direct provider keys, direct network egress, or unbrokered tools can
            bypass the firewall.
          </p>
        </div>

        {activeView === "onboard" && (
          <section
            id="agent-firewall-onboarding"
            role="tabpanel"
            aria-label="Five minute onboarding"
            className="rounded-2xl border border-glass bg-surface-container-low/70 p-5 shadow-xl shadow-black/10"
          >
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-semibold">Five minute setup progress</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Complete these in order. Stay in Shadow until broker coverage is verified.
                </p>
              </div>
              <button
                type="button"
                onClick={() => showView("operate")}
                className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/5"
              >
                Open control plane
              </button>
            </div>
            <ol className="mt-5 grid gap-3 md:grid-cols-4">
              {onboardingSteps.map((step, index) => (
                <li
                  key={step.label}
                  className={`rounded-xl border p-4 transition-colors ${step.complete ? "border-primary/30 bg-primary/10" : "border-glass bg-surface-base/50 hover:border-primary/25 hover:bg-surface-container-low"}`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${step.complete ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"}`}
                    >
                      {step.complete ? "✓" : index + 1}
                    </span>
                    <p className="text-sm font-semibold text-white">{step.label}</p>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-gray-400">{step.detail}</p>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section
          className={`grid gap-3 md:grid-cols-3 ${activeView === "operate" ? "hidden" : ""}`}
        >
          {[
            [
              "1",
              "Register an agent",
              "Give every protected agent an owner, environment and stable identity.",
            ],
            [
              "2",
              "Delegate authority",
              "Choose exactly which actions, resources, amounts and time window it may use.",
            ],
            [
              "3",
              "Observe, then enforce",
              "Start in Shadow mode, review would-block decisions, then enable enforcement.",
            ],
          ].map(([number, title, description]) => (
            <article
              key={number}
              className="rounded-2xl border border-glass bg-surface-container-low/60 p-5 shadow-xl shadow-black/10 transition-colors hover:border-primary/25 hover:bg-surface-container-low"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary shadow-lg shadow-primary/20">
                {number}
              </span>
              <h2 className="mt-4 font-semibold">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-gray-400">{description}</p>
            </article>
          ))}
        </section>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200"
          >
            {error.message}
          </div>
        )}

        <section
          className={`grid gap-6 lg:grid-cols-2 ${activeView === "operate" ? "hidden" : ""}`}
        >
          <form
            className="rounded-xl border border-white/10 bg-white/[0.03] p-6"
            onSubmit={(event) => {
              event.preventDefault();
              createAgent.mutate({
                workspaceId,
                name: agentName,
                agentKey,
                environment: "production",
                mode: "shadow",
                capabilities: [],
                version: "1",
              });
            }}
          >
            <h2 className="text-lg font-semibold">Register an agent</h2>
            <p className="mt-1 text-sm text-gray-400">
              No provider secret is needed for identity setup.
            </p>
            <label className="mt-5 block text-sm text-gray-300">
              Display name
              <input
                value={agentName}
                onChange={(event) => setAgentName(event.target.value)}
                required
                maxLength={255}
                placeholder="Finance support agent"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 outline-none focus:border-emerald-400"
              />
            </label>
            <label className="mt-4 block text-sm text-gray-300">
              Stable agent key
              <input
                value={agentKey}
                onChange={(event) => setAgentKey(event.target.value)}
                required
                pattern="[a-zA-Z0-9._:-]+"
                placeholder="finance-support-prod"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 outline-none focus:border-emerald-400"
              />
            </label>
            <button
              disabled={createAgent.isPending}
              className="mt-5 rounded-lg bg-emerald-400 px-4 py-2.5 font-semibold text-black disabled:opacity-50"
            >
              {createAgent.isPending ? "Registering…" : "Register agent"}
            </button>
          </form>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-lg font-semibold">Protected agent</h2>
            <label
              htmlFor="protected-agent"
              className="mt-4 block text-sm font-medium text-gray-300"
            >
              Protected agent
            </label>
            <select
              id="protected-agent"
              aria-label="Protected agent"
              value={agentId}
              onChange={(event) => setSelectedAgentId(event.target.value)}
              className="mt-4 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5"
            >
              <option value="">Select an agent</option>
              {(identities.data ?? []).map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} · {agent.environment}
                </option>
              ))}
            </select>
            {activeAgent ? (
              <div className="mt-5 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${activeAgent.mode === "shadow" ? "border-blue-400/40 bg-blue-400/10 text-blue-200" : "border-red-400/40 bg-red-400/10 text-red-200"}`}
                  >
                    {activeAgent.mode === "shadow"
                      ? "Shadow — observes only"
                      : "Enforce — decisions block"}
                  </span>
                  <span className="text-sm text-gray-400">{activeAgent.status}</span>
                </div>
                <button
                  type="button"
                  onClick={switchAgentMode}
                  disabled={setMode.isPending}
                  className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
                >
                  Switch to {activeAgent.mode === "shadow" ? "Enforce" : "Shadow"}
                </button>
                <p className="text-xs leading-5 text-amber-200">
                  Enforce blocks only broker routed credentials. Active brokered credentials:{" "}
                  <strong>{activeCredentials.length}</strong>. Remove raw provider keys from the
                  agent runtime before relying on DENY as a hard control.
                </p>
              </div>
            ) : (
              <p className="mt-5 text-sm text-gray-500">Register your first agent to continue.</p>
            )}
          </div>
        </section>

        <section
          className={`grid gap-6 lg:grid-cols-2 ${activeView === "operate" ? "hidden" : ""}`}
        >
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-lg font-semibold">Delegate a safe starter scope</h2>
            <p className="mt-1 text-sm text-gray-400">
              The generated capability token is shown once. Store it as a secret in the agent
              runtime.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-gray-300">
              {DEFAULT_ACTIONS.map((action) => (
                <li key={action}>✓ {action}</li>
              ))}
              <li>✓ Resources: customer:*</li>
              <li>✓ Refund ceiling: ₹5,000 per action</li>
              <li>✓ Maximum: 100 actions</li>
            </ul>
            <button
              disabled={!agentId || createAuthority.isPending}
              onClick={() =>
                createAuthority.mutate({
                  workspaceId,
                  agentId,
                  scope: {
                    actions: DEFAULT_ACTIONS,
                    resources: ["customer:*"],
                    environments: ["production"],
                    maxAmountMinor: 500_000,
                    currency: "INR",
                    maxCount: 100,
                    maxDelegationDepth: 1,
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    purpose: "Initial Agent Firewall pilot",
                  },
                })
              }
              className="mt-5 rounded-lg bg-emerald-400 px-4 py-2.5 font-semibold text-black disabled:opacity-50"
            >
              {createAuthority.isPending ? "Creating…" : "Create delegated authority"}
            </button>
            {capabilityToken && (
              <div className="mt-5 rounded-lg border border-amber-400/40 bg-amber-400/10 p-4">
                <p className="text-sm font-semibold text-amber-200">
                  Copy now — it will not be shown again
                </p>
                <code className="mt-2 block break-all text-xs text-amber-100">
                  {capabilityToken}
                </code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(capabilityToken)}
                  className="mt-3 rounded border border-amber-300/30 px-3 py-1.5 text-xs text-amber-100"
                >
                  Copy token
                </button>
              </div>
            )}
            {!capabilityToken && authorities.data?.length ? (
              <p className="mt-4 text-xs text-gray-500">
                {authorities.data.length} authority record(s) configured. Existing raw tokens cannot
                be recovered.
              </p>
            ) : null}
          </div>

          <form
            className="rounded-xl border border-white/10 bg-white/[0.03] p-6"
            onSubmit={(event) => {
              event.preventDefault();
              const authority = authorities.data?.find((item) => item.status === "active");
              evaluate.mutate({
                workspaceId,
                agentId,
                authorityId: capabilityToken ? undefined : authority?.id,
                capabilityToken: capabilityToken || undefined,
                idempotencyKey: `ui-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                provider,
                operation,
                parameters: {},
                resource,
                environment: "production",
                amountMinor: Number(amount),
                currency: "INR",
              });
            }}
          >
            <h2 className="text-lg font-semibold">Test a decision</h2>
            <p className="mt-1 text-sm text-gray-400">
              This simulator authorizes and records the action. It does not call Razorpay, GitHub or
              a database.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-gray-300">
                Provider
                <input
                  value={provider}
                  onChange={(event) => setProvider(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5"
                />
              </label>
              <label className="text-sm text-gray-300">
                Operation
                <input
                  value={operation}
                  onChange={(event) => setOperation(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5"
                />
              </label>
              <label className="text-sm text-gray-300">
                Resource
                <input
                  value={resource}
                  onChange={(event) => setResource(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5"
                />
              </label>
              <label className="text-sm text-gray-300">
                Amount in paise
                <input
                  type="number"
                  min="0"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5"
                />
              </label>
            </div>
            <button
              disabled={!agentId || !authorities.data?.length || evaluate.isPending}
              className="mt-5 rounded-lg bg-white px-4 py-2.5 font-semibold text-black disabled:opacity-50"
            >
              {evaluate.isPending ? "Evaluating…" : "Evaluate action"}
            </button>
            {lastDecision && (
              <div className="mt-5">
                <DecisionTrace
                  agentName={activeAgent?.name}
                  provider={provider}
                  operation={operation}
                  normalizedActionName={lastDecision.normalizedAction?.name}
                  decision={lastDecision.decision}
                  effectiveDecision={lastDecision.effectiveDecision}
                  reasons={lastDecision.reasons}
                />
              </div>
            )}
          </form>
        </section>

        <section
          id="agent-firewall-operate"
          className={`grid gap-4 sm:grid-cols-3 ${activeView === "onboard" ? "hidden" : ""}`}
          role="tabpanel"
          aria-label="Operational metrics"
        >
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm text-gray-400">Shadow actions · 7 days</p>
            <p className="mt-2 text-3xl font-semibold">{report.data?.observedActions ?? 0}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm text-gray-400">Would block or pause</p>
            <p className="mt-2 text-3xl font-semibold text-amber-300">
              {report.data?.wouldBlock ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm text-gray-400">Enforce readiness</p>
            <p className="mt-2 text-xl font-semibold">
              {report.data?.readyForEnforce ? "Review passed" : "Keep observing"}
            </p>
          </div>
        </section>

        {(approvals.data?.length ?? 0) > 0 && (
          <section className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-6">
            <h2 className="text-lg font-semibold">Pending approvals</h2>
            <div className="mt-4 space-y-3">
              {approvals.data?.map((approval) => (
                <div
                  key={approval.id}
                  className="flex flex-col justify-between gap-3 rounded-lg border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center"
                >
                  <div>
                    <p className="font-medium">{approval.semanticAction}</p>
                    <p className="text-xs text-gray-400">
                      {approval.resource || "Any resource"} · expires{" "}
                      {new Date(approval.expiresAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        resolveApproval.mutate({
                          workspaceId,
                          approvalId: approval.id,
                          decision: "approved",
                        })
                      }
                      className="rounded bg-emerald-400 px-3 py-2 text-xs font-semibold text-black"
                    >
                      Approve once
                    </button>
                    <button
                      onClick={() =>
                        resolveApproval.mutate({
                          workspaceId,
                          approvalId: approval.id,
                          decision: "rejected",
                        })
                      }
                      className="rounded border border-red-400/40 px-3 py-2 text-xs text-red-200"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section
          className={`rounded-xl border border-white/10 bg-white/[0.03] p-6 ${activeView === "onboard" ? "hidden" : ""}`}
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Action Ledger</h2>
              <p className="mt-1 text-sm text-gray-400">
                Traceable decisions with normalized actions, policy versions and outcomes.
              </p>
            </div>
            <button
              onClick={() => ledger.refetch()}
              className="rounded border border-white/15 px-3 py-2 text-xs"
            >
              Refresh
            </button>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <label className="text-sm text-gray-300">
              Search ledger
              <input
                value={ledgerSearch}
                onChange={(event) => setLedgerSearch(event.target.value)}
                placeholder="Action, resource, outcome, ledger id"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5"
              />
            </label>
            <label className="text-sm text-gray-300">
              Decision
              <select
                value={ledgerDecision}
                onChange={(event) => setLedgerDecision(event.target.value as typeof ledgerDecision)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5"
              >
                <option value="all">All decisions</option>
                <option value="ALLOW">ALLOW</option>
                <option value="DENY">DENY</option>
                <option value="APPROVAL_REQUIRED">APPROVAL_REQUIRED</option>
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => ledger.refetch()}
                disabled={ledger.isFetching}
                className="w-full rounded border border-white/15 px-3 py-2.5 text-xs disabled:opacity-50"
              >
                {ledger.isFetching ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </div>
          <div className="mt-5">
            <LedgerTimeline
              rows={filteredLedgerRows}
              emptyMessage={
                (ledger.data?.length ?? 0) > 0
                  ? "No ledger entries match the current filters."
                  : "No protected actions yet. Complete onboarding and evaluate a sample action."
              }
            />
          </div>
        </section>

        {/*
          Brokered credentials. This is the section that makes the firewall
          enforcing rather than advisory: while an agent holds the real
          provider key, a DENY is only a suggestion. Stored here, the secret
          never leaves the server and the agent must present an ALLOW decision
          to get a call made on its behalf.
        */}
        <section
          className={`grid gap-6 lg:grid-cols-2 ${activeView === "operate" ? "hidden" : ""}`}
        >
          <form
            className="rounded-xl border border-white/10 bg-white/[0.03] p-6"
            onSubmit={(event) => {
              event.preventDefault();
              createCredential.mutate({
                workspaceId,
                name: credName,
                provider: credProvider,
                secret: credSecret,
                allowedOrigin: credOrigin,
                allowedActions: credActions
                  .split(",")
                  .map((value) => value.trim())
                  .filter(Boolean),
                injection: credInjection,
                headerName: credInjection === "header" ? credHeaderName : undefined,
              });
            }}
          >
            <h2 className="text-lg font-semibold">Broker a provider credential</h2>
            <p className="mt-1 text-sm text-gray-400">
              The key is encrypted and never returned by the API. Your agent receives only an id,
              and can spend it only against an allowed action — once per decision.
            </p>

            <label className="mt-5 block text-sm text-gray-300">
              Name
              <input
                value={credName}
                onChange={(event) => setCredName(event.target.value)}
                placeholder="Stripe production"
                required
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 outline-none focus:border-emerald-400"
              />
            </label>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-gray-300">
                Provider preset
                <select
                  value={credPreset}
                  onChange={(event) =>
                    applyCredentialPreset(event.target.value as CredentialProviderPreset)
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 outline-none focus:border-emerald-400"
                >
                  {Object.entries(CREDENTIAL_PROVIDER_PRESETS).map(([key, preset]) => (
                    <option key={key} value={key}>
                      {preset.label}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-gray-500">
                  {CREDENTIAL_PROVIDER_PRESETS[credPreset].help}
                </span>
              </label>
              <label className="block text-sm text-gray-300">
                Provider id
                <input
                  value={credProvider}
                  onChange={(event) => setCredProvider(event.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 outline-none focus:border-emerald-400"
                />
              </label>
              <label className="block text-sm text-gray-300">
                Injection
                <select
                  value={credInjection}
                  onChange={(event) =>
                    setCredInjection(event.target.value as "bearer" | "header" | "basic")
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 outline-none focus:border-emerald-400"
                >
                  <option value="bearer">Authorization: Bearer</option>
                  <option value="basic">Authorization: Basic</option>
                  <option value="header">Custom header</option>
                </select>
              </label>
            </div>

            {credInjection === "header" && (
              <label className="mt-4 block text-sm text-gray-300">
                Header name
                <input
                  value={credHeaderName}
                  onChange={(event) => setCredHeaderName(event.target.value)}
                  placeholder="X-Api-Key"
                  required
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 outline-none focus:border-emerald-400"
                />
              </label>
            )}

            <label className="mt-4 block text-sm text-gray-300">
              Secret
              <input
                type="password"
                value={credSecret}
                onChange={(event) => setCredSecret(event.target.value)}
                placeholder={CREDENTIAL_PROVIDER_PRESETS[credPreset].secretPlaceholder}
                autoComplete="off"
                required
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 outline-none focus:border-emerald-400"
              />
            </label>

            <label className="mt-4 block text-sm text-gray-300">
              Allowed origin
              <input
                value={credOrigin}
                onChange={(event) => setCredOrigin(event.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 outline-none focus:border-emerald-400"
              />
              <span className="mt-1 block text-xs text-gray-500">
                The only host this secret may ever be sent to.
              </span>
            </label>

            <label className="mt-4 block text-sm text-gray-300">
              Allowed actions
              <input
                value={credActions}
                onChange={(event) => setCredActions(event.target.value)}
                placeholder="financial.refund, financial.payout"
                required
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 outline-none focus:border-emerald-400"
              />
              <span className="mt-1 block text-xs text-gray-500">
                Comma separated. A refund credential cannot be replayed as a payout.
              </span>
            </label>

            <button
              type="submit"
              disabled={createCredential.isPending || !enabled}
              className="mt-5 rounded-lg bg-emerald-400 px-4 py-2.5 font-semibold text-black disabled:opacity-50"
            >
              {createCredential.isPending ? "Storing…" : "Store credential"}
            </button>
            {createCredential.error && (
              <p className="mt-3 text-sm text-red-300">{createCredential.error.message}</p>
            )}
          </form>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-lg font-semibold">Brokered credentials</h2>
            <ul className="mt-4 space-y-3">
              {(credentials.data?.credentials ?? []).map((credential) => (
                <li
                  key={credential.id}
                  className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {credential.name}{" "}
                        <span className="text-xs font-normal text-gray-500">
                          ({credential.provider})
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-gray-400">{credential.allowedOrigin}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {(credential.allowedActions as string[] | null)?.join(", ")}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-gray-600">{credential.id}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span
                        className={
                          credential.status === "active"
                            ? "rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs text-emerald-300"
                            : "rounded-full bg-gray-500/15 px-2 py-0.5 text-xs text-gray-400"
                        }
                      >
                        {credential.status}
                      </span>
                      {credential.status === "active" && (
                        <button
                          type="button"
                          onClick={() =>
                            revokeCredential.mutate({
                              workspaceId,
                              credentialId: credential.id,
                            })
                          }
                          className="mt-2 block text-xs text-red-300 hover:underline"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
              {(credentials.data?.credentials ?? []).length === 0 && (
                <li className="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-gray-500">
                  No brokered credentials yet. Until one exists, agents still hold their own
                  provider keys and can bypass the firewall.
                </li>
              )}
            </ul>

            <h3 className="mt-6 text-sm font-semibold text-gray-300">Recent brokered calls</h3>
            <ul className="mt-2 space-y-1.5">
              {(egress.data?.egress ?? []).map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate text-gray-400">
                    <span className="font-mono text-gray-500">{row.method}</span>{" "}
                    {row.semanticAction}
                  </span>
                  <span className={row.error ? "shrink-0 text-red-300" : "shrink-0 text-gray-500"}>
                    {row.error ? "failed" : (row.responseStatus ?? "—")}
                  </span>
                </li>
              ))}
              {(egress.data?.egress ?? []).length === 0 && (
                <li className="text-xs text-gray-600">No brokered calls recorded yet.</li>
              )}
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
