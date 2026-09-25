/**
 * `rakshex demo` — the 60-second wow. `rakshex verify` — offline proof check.
 *
 * Demo script:
 *   1. A ₹10,000 refund attempt → DENY'd (over the ₹500 spending limit),
 *      signed receipt appended to the local hash-chained ledger.
 *   2. A ₹100 refund attempt → APPROVAL_REQUIRED → terminal approval card →
 *      human approves → action proceeds → signed receipt.
 *   3. Receipt bundle written to disk with a one-click verify command
 *      (`rakshex verify <bundle>`) that checks the hash chain + Ed25519
 *      signatures offline.
 *
 * The decision path is REAL: `@rakshex/policy-engine`'s evaluatePolicy runs
 * the workspace policy. What is simulated is the environment (local ledger,
 * no gateway, no money). Every receipt payload carries `demoMode: true` and
 * the CLI says so on every run.
 *
 * Abuse-proofing: no network calls; max 20 demo runs/hour per machine;
 * demo mode can never move real money (there is no money path here at all).
 */
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { evaluatePolicy } from "@rakshex/policy-engine";
import { RAKSHEX_HOME, WORKSPACES_DIR, INR_PER_USD, createAsker, initWorkspace, slugify } from "./init.js";
import {
  GENESIS_HASH,
  createBundle,
  signEntry,
  verifyBundle,
  type ReceiptBundle,
  type ReceiptEntry,
  type ReceiptKeypair,
} from "./receipts.js";

const DEMO_DIR = join(RAKSHEX_HOME, "demo");
const DEMO_SLUG = "demo-agent";
const MAX_RUNS_PER_HOUR = 20;

function checkRateLimit(): boolean {
  mkdirSync(DEMO_DIR, { recursive: true });
  const usagePath = join(DEMO_DIR, "usage.json");
  const now = Date.now();
  let runs: number[] = [];
  if (existsSync(usagePath)) {
    try {
      runs = (JSON.parse(readFileSync(usagePath, "utf8")) as number[]).filter((t) => now - t < 3_600_000);
    } catch {
      runs = [];
    }
  }
  if (runs.length >= MAX_RUNS_PER_HOUR) return false;
  runs.push(now);
  writeFileSync(usagePath, JSON.stringify(runs));
  return true;
}

interface DemoWorkspace {
  dir: string;
  workspaceId: string;
  policy: Parameters<typeof evaluatePolicy>[0];
  keypair: ReceiptKeypair;
}

function loadDemoWorkspace(): DemoWorkspace {
  const dir = join(DEMO_DIR, "workspace");
  if (!existsSync(join(dir, "policy.json"))) {
    initWorkspace({ agentName: "demo-agent", allowed: [1, 2, 3, 4], spendingLimitInr: 500 });
    // initWorkspace writes under WORKSPACES_DIR/demo-agent; copy the essentials
    const src = join(WORKSPACES_DIR, slugify(DEMO_SLUG));
    mkdirSync(dir, { recursive: true });
    for (const f of ["workspace.json", "policy.json", "receipt-private.pem", "receipt-public.pem"]) {
      const dest = join(dir, f);
      writeFileSync(dest, readFileSync(join(src, f)));
      if (f === "receipt-private.pem") chmodSync(dest, 0o600);
    }
  }
  const workspaceId = (JSON.parse(readFileSync(join(dir, "workspace.json"), "utf8")) as { workspaceId: string }).workspaceId;
  const policy = JSON.parse(readFileSync(join(dir, "policy.json"), "utf8")) as Parameters<typeof evaluatePolicy>[0];
  const keypair: ReceiptKeypair = {
    keyId: "demo-receipt-key-1",
    privateKeyPem: readFileSync(join(dir, "receipt-private.pem"), "utf8"),
    publicKeyPem: readFileSync(join(dir, "receipt-public.pem"), "utf8"),
  };
  return { dir, workspaceId, policy, keypair };
}

function loadLedger(): ReceiptEntry[] {
  const p = join(DEMO_DIR, "ledger.json");
  if (!existsSync(p)) return [];
  try {
    return JSON.parse(readFileSync(p, "utf8")) as ReceiptEntry[];
  } catch {
    return [];
  }
}

function appendLedger(entry: ReceiptEntry): void {
  const ledger = loadLedger();
  ledger.push(entry);
  writeFileSync(join(DEMO_DIR, "ledger.json"), JSON.stringify(ledger, null, 2));
}

function inr(amountInr: number): string {
  return `₹${amountInr.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

async function askApproval(question: string, timeoutMs: number): Promise<boolean> {
  const asker = await createAsker();
  try {
    const answer = await Promise.race([
      asker.ask(question),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    return (answer ?? "").trim().toLowerCase().startsWith("y");
  } finally {
    asker.close();
  }
}

export async function cmdDemo(flags: Record<string, string | boolean>): Promise<number> {
  void flags;
  if (!checkRateLimit()) {
    console.error(`Demo rate limit reached (${MAX_RUNS_PER_HOUR}/hour). Try again later.`);
    return 2;
  }

  console.log("─ RaksHex demo ─────────────────────────────────────────");
  console.log("DEMO MODE: simulated locally. No real money moves, no network calls.\n");

  const ws = loadDemoWorkspace();
  const ledger = loadLedger();
  let previousHash = ledger.at(-1)?.entryHash ?? GENESIS_HASH;

  const decide = (toolName: string, amountInr: number, note: string) => {
    const ctx = {
      toolName,
      toolCalls: [{ name: toolName }],
      costUsdSoFar: Math.round((amountInr / INR_PER_USD) * 100) / 100,
      agentId: "demo-agent",
      prompt: note,
    };
    const decision = evaluatePolicy(ws.policy, ctx);
    const entry = signEntry(
      {
        workspaceId: ws.workspaceId,
        requestId: randomUUID(),
        eventType: "policy.decision",
        payload: {
          demoMode: true,
          toolName,
          amountInr,
          note,
          decision: decision.action,
          reasons: decision.reasons,
          matchedRules: decision.matchedRules,
        },
        previousHash,
      },
      ws.keypair,
    );
    previousHash = entry.entryHash;
    appendLedger(entry);
    return { decision, entry };
  };

  // ── Attempt 1: ₹10,000 refund — over the limit ──────────────────────
  console.log('Attempt 1: agent proposes financial.refund of ₹10,000 (order #4821)\n');
  const r1 = decide("financial.refund", 10_000, "refund customer order #4821 — duplicate charge");
  console.log(`  → ${r1.decision.action.toUpperCase()} ${inr(10000)} exceeds the ₹500 spending limit.`);
  for (const reason of r1.decision.reasons) console.log(`    reason: ${reason}`);
  console.log(`    receipt: ${r1.entry.entryHash.slice(0, 16)}… (signed, hash-chained)\n`);

  // ── Attempt 2: ₹100 refund — under the limit, needs approval ────────
  console.log('Attempt 2: agent proposes financial.refund of ₹100 (order #4821)\n');
  const r2 = decide("financial.refund", 100, "refund customer order #4821 — duplicate charge");
  console.log(`  → ${r2.decision.action.toUpperCase()}: move-money is allowed under the limit, but needs a human.\n`);

  let approved = false;
  if (r2.decision.action === "require_approval") {
    console.log("┌─ APPROVAL NEEDED ─────────────────────────────────────");
    console.log('│ Agent "demo-agent" wants to refund ₹100 (financial.refund)');
    console.log("│ order #4821 — customer charged twice");
    console.log("│ Policy: require_approval (money movement under the ₹500 limit)");
    console.log("└───────────────────────────────────────────────────────");
    approved = await askApproval("Approve? [y/N] (60s timeout → deny) ", 60_000);
    const approvalEntry = signEntry(
      {
        workspaceId: ws.workspaceId,
        requestId: randomUUID(),
        eventType: approved ? "approval.granted" : "approval.denied",
        payload: { demoMode: true, toolName: "financial.refund", amountInr: 100, approver: "demo-human" },
        previousHash,
      },
      ws.keypair,
    );
    previousHash = approvalEntry.entryHash;
    appendLedger(approvalEntry);
    console.log(approved ? "\n  → APPROVED. Action proceeds. Receipt signed." : "\n  → DENIED by human (or timeout). Action blocked. Receipt signed.");
  }

  // ── Bundle + verify ────────────────────────────────────────────────
  const bundle: ReceiptBundle = createBundle(ws.workspaceId, loadLedger(), ws.keypair);
  const receiptsDir = join(DEMO_DIR, "receipts");
  mkdirSync(receiptsDir, { recursive: true });
  const bundlePath = join(receiptsDir, `bundle-${Date.now()}.json`);
  writeFileSync(bundlePath, JSON.stringify(bundle, null, 2));

  console.log(`
─ Proof ──────────────────────────────────────────────────
Receipt bundle: ${bundlePath}
Verify it yourself (offline Ed25519 + hash-chain check):
  rakshex verify ${bundlePath}
`);
  return 0;
}

export function cmdVerify(positional: string[]): number {
  const path = positional[0];
  if (!path || !existsSync(path)) {
    console.error("Usage: rakshex verify <bundle.json>");
    return 2;
  }
  let bundle: ReceiptBundle;
  try {
    bundle = JSON.parse(readFileSync(path, "utf8")) as ReceiptBundle;
  } catch {
    console.error("Not a readable JSON bundle.");
    return 2;
  }
  const result = verifyBundle(bundle);
  if (result.valid) {
    console.log(`VALID — ${bundle.entries.length} entries, hash chain intact, all Ed25519 signatures check out.`);
    console.log(`workspace: ${bundle.workspaceId} · chain head: ${bundle.chainHead.slice(0, 16)}…`);
    return 0;
  }
  console.error(`INVALID — ${result.error}`);
  return 1;
}
