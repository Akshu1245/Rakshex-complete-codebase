"use client";

import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { DecisionTrace } from "@/components/agent-firewall/DecisionTrace";
import { NotConnectedState } from "@/components/NotConnected";

interface EvaluateResult {
  decision: string;
  effectiveDecision: string;
  wouldBlock: boolean;
  enforced: boolean;
  reasons: string[];
  policyVersion: string;
  receipt?: {
    id: number;
    entryHash: string;
    previousHash: string;
    signingKeyId: string;
    signature: string;
  };
}

/**
 * Agent Firewall — decision simulator wired to the real evaluation pipeline.
 *
 * POST /api/evaluate proxies POST /v1/evaluate on the Workers firewall API:
 * the action is normalized server-side, policy is evaluated, and a signed
 * receipt is appended to the D1 action ledger. It requires a RaksHex API key
 * (Bearer auth on /v1/evaluate) and an existing workspace id.
 *
 * Everything else on this page (agent registration, delegated authority,
 * approvals, ledger browsing, credential brokering) has no /v1 equivalent on
 * the Workers deployment yet and is honestly marked not-connected instead of
 * faked.
 */
export default function AgentFirewallPage() {
  const [apiKey, setApiKey] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [provider, setProvider] = useState("razorpay");
  const [operation, setOperation] = useState("refund.create");
  const [resource, setResource] = useState("customer:1827");
  const [amount, setAmount] = useState("100000");
  const [currency, setCurrency] = useState("INR");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDecision, setLastDecision] = useState<EvaluateResult | null>(null);

  const evaluate = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    setLastDecision(null);
    try {
      const result = await apiFetch<EvaluateResult>("/api/evaluate", {
        method: "POST",
        body: JSON.stringify({
          apiKey,
          workspaceId: Number(workspaceId),
          requestId: `ui-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          provider,
          operation,
          resource,
          environment: "production",
          amountMinor: Number(amount),
          currency,
        }),
      });
      setLastDecision(result);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.notConnected
            ? "Evaluation is not connected on this deployment."
            : err.message
          : "Evaluation failed.",
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <main className="p-5 text-white md:p-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Runtime authorization
          </p>
          <h1 className="text-3xl font-bold">Agent Firewall</h1>
          <p className="max-w-3xl text-gray-400">
            RaksHex identifies the agent, normalizes the requested business action, checks its
            delegated authority and records the decision before a real system changes.
          </p>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
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
            <article key={number} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400 text-sm font-bold text-black">
                {number}
              </span>
              <h2 className="mt-4 font-semibold">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-gray-400">{description}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <form
            className="rounded-xl border border-white/10 bg-white/[0.03] p-6"
            onSubmit={evaluate}
          >
            <h2 className="text-lg font-semibold">Test a decision</h2>
            <p className="mt-1 text-sm text-gray-400">
              Runs the real evaluation pipeline (
              <code className="text-gray-300">POST /v1/evaluate</code>): the action is normalized
              server-side, policy is evaluated, and a signed receipt is appended to the action
              ledger. It does not call Razorpay, GitHub or a database.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-gray-300">
                RaksHex API key
                <input
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  required
                  autoComplete="off"
                  placeholder="rk_live_…"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5"
                />
                <span className="mt-1 block text-xs text-gray-500">
                  Sent only to this deployment&apos;s API proxy for this request. Never stored.
                </span>
              </label>
              <label className="text-sm text-gray-300">
                Workspace ID
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={workspaceId}
                  onChange={(event) => setWorkspaceId(event.target.value)}
                  required
                  placeholder="1"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5"
                />
              </label>
              <label className="text-sm text-gray-300">
                Provider
                <input
                  value={provider}
                  onChange={(event) => setProvider(event.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5"
                />
              </label>
              <label className="text-sm text-gray-300">
                Operation
                <input
                  value={operation}
                  onChange={(event) => setOperation(event.target.value)}
                  required
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

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-gray-300">
                Currency
                <input
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="mt-5 rounded-lg bg-white px-4 py-2.5 font-semibold text-black disabled:opacity-50"
            >
              {isPending ? "Evaluating…" : "Evaluate action"}
            </button>

            {error && (
              <div
                role="alert"
                className="mt-5 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200"
              >
                {error}
              </div>
            )}

            {lastDecision && (
              <div className="mt-5">
                <DecisionTrace
                  provider={provider}
                  operation={operation}
                  decision={lastDecision.decision}
                  effectiveDecision={lastDecision.effectiveDecision}
                  reasons={lastDecision.reasons}
                />
                <dl className="mt-4 space-y-1 rounded-lg border border-white/10 bg-black/20 p-4 text-xs text-gray-400">
                  <div className="flex justify-between gap-4">
                    <dt>Would block</dt>
                    <dd className="text-gray-200">{String(lastDecision.wouldBlock)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Enforced</dt>
                    <dd className="text-gray-200">{String(lastDecision.enforced)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Policy version</dt>
                    <dd className="font-mono text-gray-200">{lastDecision.policyVersion}</dd>
                  </div>
                  {lastDecision.receipt && (
                    <div className="flex justify-between gap-4">
                      <dt>Receipt entry hash</dt>
                      <dd className="break-all font-mono text-gray-200">
                        {lastDecision.receipt.entryHash}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </form>

          <div className="space-y-6">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-lg font-semibold">Agent identities &amp; authority</h2>
              <div className="mt-4">
                <NotConnectedState
                  resource="Agent registration, identities, and delegated authority"
                  detail="Registering agents and delegating authority scopes needs the identities API, which isn't connected on this deployment yet."
                />
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-lg font-semibold">Approvals</h2>
              <div className="mt-4">
                <NotConnectedState
                  resource="Pending approvals"
                  detail="The approvals queue needs the approvals API, which isn't connected on this deployment yet."
                />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-semibold">Action Ledger</h2>
          <p className="mt-1 text-sm text-gray-400">
            Traceable decisions with normalized actions, policy versions and outcomes.
          </p>
          <div className="mt-4">
            <NotConnectedState
              resource="Action Ledger browsing"
              detail="Listing ledger entries needs the ledger API, which isn't connected on this deployment yet. Decisions you evaluate above still append signed receipts server-side."
            />
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-semibold">Brokered credentials</h2>
          <p className="mt-1 text-sm text-gray-400">
            The credential broker releases a provider secret only on a true ALLOW decision —
            single-use, fresh, origin-pinned.
          </p>
          <div className="mt-4">
            <NotConnectedState
              resource="Credential brokering"
              detail="Storing and brokering provider credentials needs the credential-broker API, which isn't connected on this deployment yet."
            />
          </div>
        </section>
      </div>
    </main>
  );
}
