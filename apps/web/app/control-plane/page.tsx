"use client";

import { useApi } from "@/lib/api";
import { useWorkspace } from "@/hooks/useWorkspace";
import { NotConnectedState } from "@/components/NotConnected";

/**
 * Control Plane — provider inventory, credentials, subscriptions and usage.
 *
 * All of this data lived behind tRPC procedures that 404 on the Workers
 * deployment, and the Workers firewall API exposes no /v1 equivalent, so
 * every section renders an honest "not connected yet" state instead of
 * zeros or mock rows. The three dead action buttons (store credential, add
 * account, record subscription) were removed for the same reason — no real
 * flow exists to wire them to.
 */
export default function ControlPlanePage() {
  const { isLoading: workspaceLoading, notConnected: workspaceNotConnected } = useWorkspace();
  const summaryQuery = useApi("/api/control-plane");
  const notConnected = workspaceNotConnected || summaryQuery.notConnected;

  if (workspaceLoading || summaryQuery.isLoading) {
    return <div className="p-8 text-white">Loading control plane...</div>;
  }

  if (notConnected) {
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
          <NotConnectedState
            resource="Control plane data"
            detail="Provider inventory, credentials, subscriptions and usage need the control-plane API, which isn't connected on this deployment yet."
          />
        </div>
      </main>
    );
  }

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

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
            <h2 className="text-xl font-semibold">Add a protected credential</h2>
            <p className="mt-1 text-sm text-gray-400">
              The secret is encrypted at write time and shown only once.
            </p>
            <div className="mt-5">
              <NotConnectedState
                resource="Credential storage"
                detail="Storing credentials needs the control-plane API, which isn't connected on this deployment yet."
              />
            </div>
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
            <h2 className="text-xl font-semibold">Add a provider account</h2>
            <p className="mt-1 text-sm text-gray-400">
              Use this for an organization, cloud tenant, project, or self-hosted endpoint. It does
              not require a runtime key.
            </p>
            <div className="mt-5">
              <NotConnectedState
                resource="Provider accounts"
                detail="Adding provider accounts needs the control-plane API, which isn't connected on this deployment yet."
              />
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
            <h2 className="text-xl font-semibold">Record a team subscription</h2>
            <p className="mt-1 text-sm text-gray-400">
              Seats, plans, and renewals are entitlements. They remain separate from provider API
              credentials.
            </p>
            <div className="mt-5">
              <NotConnectedState
                resource="Subscription recording"
                detail="Recording subscriptions needs the control-plane API, which isn't connected on this deployment yet."
              />
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
