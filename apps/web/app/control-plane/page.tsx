"use client";

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";

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
  const createCredential = trpc.controlPlane.credentials.create.useMutation({
    onSuccess: () => credentialsQuery.refetch(),
  });
  const createAccount = trpc.controlPlane.providers.upsertAccount.useMutation({
    onSuccess: () => accountsQuery.refetch(),
  });
  const importSubscription = trpc.controlPlane.subscriptions.import.useMutation({
    onSuccess: () => subscriptionsQuery.refetch(),
  });
  const [provider, setProvider] = useState("openai");
  const [secret, setSecret] = useState("");
  const [oneTimeSecret, setOneTimeSecret] = useState<string | null>(null);
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

          <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
            <h2 className="text-xl font-semibold">Add a protected credential</h2>
            <p className="mt-1 text-sm text-gray-400">
              The secret is encrypted at write time and shown only once.
            </p>
            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                setOneTimeSecret(null);
                createCredential.mutate(
                  {
                    workspaceId,
                    provider: provider as never,
                    name: `${provider} credential`,
                    credentialType: "api_key",
                    environment: "production",
                    secret,
                  },
                  {
                    onSuccess: (result) => {
                      setOneTimeSecret(result.secret);
                      setSecret("");
                    },
                  },
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
                  {(catalogQuery.data ?? [])
                    .filter((item) => item.capabilities.validateCredential)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="block text-sm text-gray-300">
                Secret
                <input
                  value={secret}
                  onChange={(event) => setSecret(event.target.value)}
                  type="password"
                  minLength={8}
                  required
                  className="mt-1 w-full rounded border border-gray-600 bg-gray-900 px-3 py-2"
                  placeholder="Paste only with authorization"
                />
              </label>
              <button
                disabled={createCredential.isPending || !workspaceId}
                className="rounded bg-blue-600 px-4 py-2 font-medium hover:bg-blue-500 disabled:opacity-50"
              >
                {createCredential.isPending ? "Encrypting..." : "Store credential"}
              </button>
            </form>
            {oneTimeSecret && (
              <div className="mt-5 rounded border border-amber-500/50 bg-amber-950/30 p-4">
                <p className="text-sm text-amber-200">
                  Copy this value now. It will not be shown again.
                </p>
                <code className="mt-2 block break-all text-sm text-amber-100">{oneTimeSecret}</code>
              </div>
            )}
          </div>
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
