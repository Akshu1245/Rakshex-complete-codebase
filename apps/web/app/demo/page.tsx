"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  KeyRound,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";

type Decision = "ALLOW" | "DENY";

type DemoRun = {
  id: number;
  amount: number;
  decision: Decision;
  reason: string;
  credentialReleased: boolean;
  ledgerHash: string;
};

const AUTHORITY_LIMIT = 50;

function shortHash(seed: number, amount: number) {
  const value = Math.abs((seed * 2654435761 + amount * 7919) >>> 0)
    .toString(16)
    .padStart(8, "0");
  return `0x${value.slice(0, 8)}`;
}

export default function DemoPage() {
  const [amount, setAmount] = useState(400);
  const [runNumber, setRunNumber] = useState(1);
  const [hasEvaluated, setHasEvaluated] = useState(true);
  const [history, setHistory] = useState<DemoRun[]>([
    {
      id: 0,
      amount: 400,
      decision: "DENY",
      reason: "delegated_authority_exceeded",
      credentialReleased: false,
      ledgerHash: "0x8f7a21c4",
    },
  ]);

  const decision: Decision = amount <= AUTHORITY_LIMIT ? "ALLOW" : "DENY";
  const credentialReleased = decision === "ALLOW";
  const reason =
    decision === "ALLOW" ? "within_delegated_authority" : "delegated_authority_exceeded";

  const currentHash = useMemo(() => shortHash(runNumber, amount), [amount, runNumber]);

  const evaluate = () => {
    const next: DemoRun = {
      id: runNumber,
      amount,
      decision,
      reason,
      credentialReleased,
      ledgerHash: currentHash,
    };
    setHistory((items) => [next, ...items].slice(0, 5));
    setRunNumber((value) => value + 1);
    setHasEvaluated(true);
  };

  const chooseAmount = (value: number) => {
    setAmount(value);
    setHasEvaluated(false);
  };

  return (
    <main className="min-h-screen overflow-x-clip bg-transparent pb-24 pt-[118px] text-white">
      <section className="mx-auto w-full max-w-[1280px] px-5 pb-12 pt-8 sm:px-6 lg:pt-12 xl:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#14B8A6]/25 bg-[#14B8A6]/[0.07] px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.13em] text-[#8FE3D8]">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Public Agent Firewall demo
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-[1.03] tracking-[-0.045em] text-white sm:text-5xl lg:text-6xl">
              See the decision <span className="text-[#14B8A6]">before</span> the action becomes real.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-neutral-400 sm:text-lg">
              A support agent is delegated permission to issue refunds up to ${AUTHORITY_LIMIT}.
              Change the requested amount, evaluate the semantic action, and inspect whether the
              credential is released.
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-[#090D14]/70 p-5">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
              What this page proves
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {["Action-level decision", "Credential mediation", "Ledger evidence"].map((item) => (
                <div key={item} className="flex items-center gap-2 text-xs text-neutral-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#14B8A6]" aria-hidden="true" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1280px] px-5 sm:px-6 xl:px-8">
        <div className="overflow-hidden rounded-2xl border border-white/[0.09] bg-[#070A0F]/82 shadow-[0_28px_100px_rgba(0,0,0,0.32)]">
          <div className="flex flex-col gap-3 border-b border-white/[0.08] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#14B8A6]" aria-hidden="true" />
              <span className="font-mono text-xs font-semibold text-neutral-300">
                finance-support-prod / financial.refund
              </span>
            </div>
            <span className="w-fit rounded-full border border-white/10 px-2.5 py-1 font-mono text-[10px] text-neutral-500">
              Simulated public evaluation · no external transaction
            </span>
          </div>

          <div className="grid lg:grid-cols-[0.82fr_1.18fr]">
            <div className="border-b border-white/[0.08] p-5 sm:p-6 lg:border-b-0 lg:border-r">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                1 · Requested action
              </p>

              <div className="mt-5 rounded-xl border border-white/[0.08] bg-black/25 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] text-[#8FE3D8]">financial.refund</p>
                    <p className="mt-1 text-sm font-semibold text-white">Order #8932</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="block text-[10px] uppercase tracking-wide text-neutral-500">Amount</span>
                    <span className="text-2xl font-bold text-white">${amount}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <label htmlFor="refund-amount" className="text-sm font-semibold text-neutral-200">
                  Requested refund amount
                </label>
                <div className="mt-3 flex items-center rounded-lg border border-white/10 bg-black/20 focus-within:border-[#14B8A6]/60">
                  <span className="border-r border-white/10 px-3 text-sm text-neutral-500">$</span>
                  <input
                    id="refund-amount"
                    type="number"
                    min={1}
                    max={10000}
                    value={amount}
                    onChange={(event) => {
                      const next = Math.max(1, Number(event.target.value) || 1);
                      setAmount(next);
                      setHasEvaluated(false);
                    }}
                    className="min-h-12 min-w-0 flex-1 bg-transparent px-3 text-base font-semibold text-white outline-none"
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => chooseAmount(40)}
                    className="min-h-10 rounded-md border border-white/10 bg-white/[0.02] px-3 text-xs font-semibold text-neutral-300 hover:border-[#14B8A6]/35 hover:text-white"
                  >
                    Try $40 · allowed
                  </button>
                  <button
                    type="button"
                    onClick={() => chooseAmount(400)}
                    className="min-h-10 rounded-md border border-white/10 bg-white/[0.02] px-3 text-xs font-semibold text-neutral-300 hover:border-red-400/35 hover:text-white"
                  >
                    Try $400 · denied
                  </button>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-[#14B8A6]/20 bg-[#14B8A6]/[0.05] p-4">
                <div className="flex items-center gap-2 text-[#8FE3D8]">
                  <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                  <span className="text-xs font-semibold">Delegated authority</span>
                </div>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-neutral-500">Parent scope</span>
                    <span className="font-mono text-neutral-300">refund ≤ $500</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-neutral-500">Agent child scope</span>
                    <span className="font-mono font-semibold text-[#14B8A6]">refund ≤ ${AUTHORITY_LIMIT}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={evaluate}
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[#14B8A6] px-5 text-sm font-semibold text-white hover:bg-[#0D9488]"
              >
                Evaluate action <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-5 sm:p-6 lg:p-7">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                2 · Runtime decision
              </p>

              <div
                className={`mt-5 rounded-xl border p-5 sm:p-6 ${
                  !hasEvaluated
                    ? "border-white/10 bg-white/[0.02]"
                    : decision === "ALLOW"
                      ? "border-[#14B8A6]/35 bg-[#14B8A6]/[0.07]"
                      : "border-red-500/30 bg-red-500/[0.06]"
                }`}
                aria-live="polite"
              >
                {!hasEvaluated ? (
                  <div className="flex min-h-28 items-center justify-center text-center">
                    <div>
                      <RotateCcw className="mx-auto h-6 w-6 text-neutral-600" aria-hidden="true" />
                      <p className="mt-3 text-sm font-semibold text-neutral-300">Amount changed</p>
                      <p className="mt-1 text-xs text-neutral-500">Evaluate again to produce a new decision.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div
                        className={`flex items-center gap-2 ${decision === "ALLOW" ? "text-[#14B8A6]" : "text-red-400"}`}
                      >
                        {decision === "ALLOW" ? (
                          <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                        ) : (
                          <XCircle className="h-6 w-6" aria-hidden="true" />
                        )}
                        <span className="text-2xl font-bold tracking-[-0.02em]">{decision}</span>
                      </div>
                      <p className="mt-3 font-mono text-[11px] text-neutral-400">{reason}</p>
                    </div>
                    <div className="rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-left sm:text-right">
                      <span className="block text-[10px] uppercase tracking-wide text-neutral-500">Action ID</span>
                      <span className="font-mono text-xs text-neutral-300">act_demo_{runNumber}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-[#14B8A6]" aria-hidden="true" />
                    <span className="text-xs font-semibold text-neutral-300">Credential broker</span>
                  </div>
                  <p
                    className={`mt-3 text-lg font-bold ${
                      !hasEvaluated
                        ? "text-neutral-600"
                        : credentialReleased
                          ? "text-[#14B8A6]"
                          : "text-red-400"
                    }`}
                  >
                    {!hasEvaluated
                      ? "Awaiting decision"
                      : credentialReleased
                        ? "Credential released"
                        : "Credential not released"}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-neutral-500">
                    In a brokered integration, the action receives the credential only after an
                    enforceable ALLOW.
                  </p>
                </div>

                <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[#14B8A6]" aria-hidden="true" />
                    <span className="text-xs font-semibold text-neutral-300">Action Ledger</span>
                  </div>
                  <p className={`mt-3 font-mono text-lg font-bold ${hasEvaluated ? "text-white" : "text-neutral-600"}`}>
                    {hasEvaluated ? currentHash : "—"}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-neutral-500">
                    Decision evidence includes action, delegated authority, result, reason, and
                    ledger linkage.
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-white/[0.08] bg-[#090D14] p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                    Recent demo decisions
                  </p>
                  <span className="text-[10px] text-neutral-600">local simulation</span>
                </div>
                <div className="mt-4 space-y-2">
                  {history.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-center text-xs text-neutral-500">
                      No decisions yet. Evaluate an action to create the first receipt.
                    </div>
                  ) : (
                    history.map((item) => (
                      <div
                        key={`${item.id}-${item.ledgerHash}`}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-mono text-[11px] text-neutral-300">
                            financial.refund · ${item.amount}
                          </p>
                          <p className="mt-0.5 truncate font-mono text-[9px] text-neutral-600">
                            {item.ledgerHash} · {item.reason}
                          </p>
                        </div>
                        <span
                          className={`font-mono text-[10px] font-bold ${
                            item.decision === "ALLOW" ? "text-[#14B8A6]" : "text-red-400"
                          }`}
                        >
                          {item.decision}
                        </span>
                        <span className="hidden text-[10px] text-neutral-500 sm:inline">
                          credential {item.credentialReleased ? "released" : "blocked"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1280px] px-5 pt-12 sm:px-6 xl:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "The action is semantic",
              body: "The policy reasons about financial.refund instead of forcing teams to encode business intent in an HTTP path.",
            },
            {
              title: "Authority can only narrow",
              body: "The child agent receives a $50 refund limit even though the parent may hold broader authority.",
            },
            {
              title: "A DENY changes execution",
              body: "For brokered credentials, the denied caller does not receive the secret required to execute the action.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-white/[0.08] bg-[#090D14]/55 p-5">
              <h2 className="text-base font-semibold text-white">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-500">{item.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-6 rounded-xl border border-[#14B8A6]/20 bg-[#0B1414] p-6 sm:flex-row sm:items-center sm:p-8">
          <div>
            <h2 className="text-2xl font-bold tracking-[-0.03em] text-white">Want to evaluate this against a real workflow?</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
              Private-beta pilots start with one agent, one consequential action, and a scoped
              rollout plan rather than a production-wide switch.
            </p>
          </div>
          <Link
            href="/waitlist"
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-[#14B8A6] px-5 text-sm font-semibold text-white no-underline hover:bg-[#0D9488]"
          >
            Request beta access <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}
