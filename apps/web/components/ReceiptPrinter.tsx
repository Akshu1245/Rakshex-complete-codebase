"use client";

import { useMemo, type CSSProperties } from "react";
import { Download, Printer } from "lucide-react";

/**
 * Everything the printer and the exported bill need. `raw` carries the
 * original signed receipt entry for the JSON download; every other field
 * is rendered on the bill.
 */
export interface PrintedReceipt {
  id: string | number;
  decision: "ALLOW" | "DENY";
  action: string;
  agent: string;
  permissionSlip: string;
  policy: string;
  amount: string;
  limit: string;
  occurredAt: string;
  workspaceId: string | number;
  requestId: string;
  previousHash: string;
  entryHash: string;
  signingKeyId: string;
  signingAlgorithm: string;
  signature: string;
  verifyUrl: string;
  /** True when this is clearly-labeled local demo data, not a live signed receipt. */
  demo?: boolean;
  raw?: unknown;
}

function trunc(value: string, head = 12, tail = 8): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

type BillRow =
  | { kind: "head"; text: string }
  | { kind: "sub"; text: string }
  | { kind: "sep" }
  | { kind: "stamp"; decision: "ALLOW" | "DENY" }
  | { kind: "kv"; k: string; v: string; full?: string }
  | { kind: "verify"; href: string }
  | { kind: "note"; text: string };

function billRows(r: PrintedReceipt): BillRow[] {
  return [
    { kind: "head", text: "RAKSHEX" },
    { kind: "sub", text: "AI ACTION CONTROL PLANE" },
    { kind: "sub", text: "SIGNED ACTION RECEIPT" },
    { kind: "sep" },
    { kind: "stamp", decision: r.decision },
    { kind: "sep" },
    { kind: "kv", k: "Action", v: r.action },
    { kind: "kv", k: "Agent", v: r.agent },
    { kind: "kv", k: "Permission slip", v: r.permissionSlip },
    { kind: "kv", k: "Policy", v: r.policy },
    { kind: "kv", k: "Amount", v: `${r.amount}  (limit ${r.limit})` },
    { kind: "sep" },
    { kind: "kv", k: "Occurred", v: r.occurredAt },
    { kind: "kv", k: "Workspace", v: String(r.workspaceId) },
    { kind: "kv", k: "Request", v: trunc(r.requestId, 18, 8), full: r.requestId },
    { kind: "sep" },
    { kind: "sub", text: "LEDGER · HASH CHAIN" },
    { kind: "kv", k: "prev", v: trunc(r.previousHash), full: r.previousHash },
    { kind: "kv", k: "entry", v: trunc(r.entryHash), full: r.entryHash },
    { kind: "sep" },
    { kind: "sub", text: `SIGNATURE · ${r.signingAlgorithm.toUpperCase()}` },
    { kind: "kv", k: "key", v: trunc(r.signingKeyId, 16, 6), full: r.signingKeyId },
    { kind: "kv", k: "sig", v: trunc(r.signature), full: r.signature },
    { kind: "sep" },
    ...(r.demo
      ? [{ kind: "note", text: "*** DEMO DATA — NOT A LIVE RECEIPT ***" } as BillRow]
      : []),
    { kind: "verify", href: r.verifyUrl },
    { kind: "note", text: "*** NOT A TAX INVOICE ***" },
  ];
}

function RowView({ row }: { row: BillRow }) {
  if (row.kind === "sep")
    return <div aria-hidden="true" className="border-t border-dashed border-neutral-400" />;
  if (row.kind === "head")
    return <p className="text-center text-xl font-bold tracking-[0.2em]"> {row.text}</p>;
  if (row.kind === "sub")
    return <p className="text-center text-[11px] tracking-[0.18em] text-neutral-600">{row.text}</p>;
  if (row.kind === "stamp")
    return (
      <p className="text-center">
        <span
          className={`inline-block border-2 px-4 py-1 text-lg font-bold tracking-[0.25em] ${
            row.decision === "ALLOW"
              ? "border-[#0B6E4F] text-[#0B6E4F]"
              : "border-[#B42318] text-[#B42318]"
          }`}
        >
          {row.decision}
        </span>
      </p>
    );
  if (row.kind === "kv")
    return (
      <div className="flex items-baseline justify-between gap-3 text-[12px]">
        <span className="shrink-0 text-neutral-500">{row.k}</span>
        <span className="min-w-0 break-all text-right font-semibold" title={row.full ?? row.v}>
          {row.v}
        </span>
      </div>
    );
  if (row.kind === "verify")
    return (
      <p className="text-center text-[11px]">
        <a
          href={row.href}
          target={row.href.startsWith("http") ? "_blank" : undefined}
          rel="noreferrer"
          className="font-semibold text-[#0B5FFF] underline underline-offset-2"
        >
          verify this proof →
        </a>
      </p>
    );
  return (
    <p className="text-center text-[11px] font-semibold tracking-wide text-neutral-600">
      {row.text}
    </p>
  );
}
const TEETH = 26;

/** Zigzag tear-off edge for the bottom of the paper (no gradients, pure clip-path). */
function useZigzagClip(): string {
  return useMemo(() => {
    const pts = ["0% 0%", "100% 0%", "100% calc(100% - 5px)"];
    for (let i = TEETH; i >= 0; i--) {
      const x = ((i / TEETH) * 100).toFixed(2);
      pts.push(`${x}% ${i % 2 === 0 ? "100%" : "calc(100% - 9px)"}`);
    }
    pts.push("0% calc(100% - 5px)");
    return `polygon(${pts.join(", ")})`;
  }, []);
}

const PRINT_CSS = `
@keyframes rx-print-line {
  from { opacity: 0; transform: translateY(-12px); }
  to { opacity: 1; transform: translateY(0); }
}
.rx-print-line {
  opacity: 0;
  animation: rx-print-line 0.32s cubic-bezier(0.2, 0.7, 0.3, 1) forwards;
  animation-delay: calc(var(--rx-i, 0) * 65ms);
}
@media (prefers-reduced-motion: reduce) {
  .rx-print-line { animation: none; opacity: 1; transform: none; }
}
`;

export function ReceiptPrinter({
  receipt,
  onPrint,
}: {
  receipt: PrintedReceipt;
  onPrint: () => void;
}) {
  const zigzag = useZigzagClip();
  const rows = useMemo(() => billRows(receipt), [receipt]);
  // Re-run the print animation every time a new receipt arrives.
  const paperKey = `${receipt.id}-${receipt.occurredAt}`;

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(receipt.raw ?? receipt, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rakshex-receipt-${receipt.id}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-md">
      <style>{PRINT_CSS}</style>
      {/* Printer housing */}
      <div aria-hidden="true" className="rounded-t-lg bg-neutral-800 px-6 pb-1 pt-3">
        <div className="mx-auto h-1.5 w-3/4 rounded-full bg-black/70" />
        <p className="mt-1 text-center font-mono text-[9px] uppercase tracking-[0.3em] text-neutral-500">
          RaksHex receipt printer
        </p>
      </div>
      {/* Paper */}
      <div
        key={paperKey}
        role="img"
        aria-label={`Printed receipt: ${receipt.decision} for ${receipt.action}${
          receipt.demo ? " (demo data)" : ""
        }`}
        className="bg-[#FBF8F1] px-6 pb-8 pt-5 font-mono text-[#191919] shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
        style={{ clipPath: zigzag }}
      >
        <div aria-live="polite" className="sr-only">
          Receipt printed: {receipt.decision}
          {receipt.demo ? " (demo data)" : ""}
        </div>
        <div className="space-y-2.5">
          {rows.map((row, i) => (
            <div key={i} className="rx-print-line" style={{ "--rx-i": i } as CSSProperties}>
              <RowView row={row} />
            </div>
          ))}
        </div>
      </div>
      {/* Export actions */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onPrint}
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#14B8A6] px-4 text-sm font-semibold text-white hover:bg-[#0D9488]"
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          Print / Save PDF
        </button>
        <button
          type="button"
          onClick={downloadJson}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/15 px-4 text-sm font-semibold text-neutral-200 hover:border-white/30 hover:text-white"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Receipt JSON
        </button>
      </div>
      {receipt.demo && (
        <p className="mt-3 text-center text-xs text-neutral-500">
          Demo data — set DEMO_API_KEY on the web worker for live signed receipts.
        </p>
      )}
    </div>
  );
}

/**
 * Full structured bill for print/PDF export: every field, untruncated,
 * black on white. Rendered alone (print mode) so window.print() captures
 * only the bill.
 */
export function ReceiptBillSheet({ receipt }: { receipt: PrintedReceipt }) {
  const field = (label: string, value: string) => (
    <div className="flex flex-col gap-1 border-b border-neutral-200 py-2.5 sm:flex-row sm:items-baseline sm:gap-6">
      <dt className="w-44 shrink-0 font-mono text-xs uppercase tracking-wider text-neutral-500">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 break-all font-mono text-sm font-semibold text-black">
        {value}
      </dd>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl bg-white font-mono text-black">
      <div className="border-b-4 border-double border-black pb-4 text-center">
        <p className="text-2xl font-bold tracking-[0.2em]">RAKSHEX</p>
        <p className="mt-1 text-xs tracking-[0.25em] text-neutral-600">AI ACTION CONTROL PLANE</p>
        <p className="mt-2 text-sm font-bold">SIGNED ACTION RECEIPT</p>
        {receipt.demo && (
          <p className="mt-2 inline-block border-2 border-black px-3 py-0.5 text-xs font-bold">
            DEMO DATA — NOT A LIVE RECEIPT
          </p>
        )}
      </div>

      <p className="py-5 text-center">
        <span
          className={`inline-block border-[3px] px-6 py-1.5 text-2xl font-bold tracking-[0.3em] ${
            receipt.decision === "ALLOW" ? "border-black" : "border-black"
          }`}
        >
          {receipt.decision}
        </span>
      </p>

      <dl>
        {field("Action", receipt.action)}
        {field("Agent", receipt.agent)}
        {field("Permission slip", receipt.permissionSlip)}
        {field("Policy", receipt.policy)}
        {field("Amount", `${receipt.amount} (limit ${receipt.limit})`)}
        {field("Occurred (UTC)", receipt.occurredAt)}
        {field("Workspace", String(receipt.workspaceId))}
        {field("Request ID", receipt.requestId)}
        {field("Receipt ID", String(receipt.id))}
      </dl>

      <h2 className="mt-6 border-b border-black pb-1 text-sm font-bold tracking-[0.2em]">
        LEDGER · HASH CHAIN
      </h2>
      <dl>
        {field("Previous hash", receipt.previousHash)}
        {field("Entry hash", receipt.entryHash)}
      </dl>

      <h2 className="mt-6 border-b border-black pb-1 text-sm font-bold tracking-[0.2em]">
        SIGNATURE · {receipt.signingAlgorithm.toUpperCase()}
      </h2>
      <dl>
        {field("Signing key ID", receipt.signingKeyId)}
        {field("Signature", receipt.signature)}
      </dl>

      <div className="mt-6 border-t-4 border-double border-black pt-4 text-sm">
        <p>
          <span className="font-bold">Verify: </span>
          <span className="break-all underline">{receipt.verifyUrl}</span>
        </p>
        <p className="mt-3 text-xs text-neutral-600">
          Generated by RaksHex. The entry hash chains to the previous ledger entry; the signature
          can be checked offline against the signing key.
        </p>
        <p className="mt-4 text-center text-xs font-bold tracking-widest">
          *** NOT A TAX INVOICE ***
        </p>
      </div>
    </div>
  );
}
