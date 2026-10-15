import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

export type CheckStatus = "passed" | "failed" | "not_run";
export interface CheckSpec { name: string; cmd: string; args: string[]; cwd: string; timeoutMs?: number }
export interface CheckRecord { name: string; status: CheckStatus; exitCode: number | null; reason: string; outputTail: string }

/** Run checks; anything not executed is recorded as not_run with a reason -- never silently dropped. */
export function runChecks(specs: CheckSpec[], notRun: { name: string; reason: string }[] = []): CheckRecord[] {
  const out: CheckRecord[] = specs.map((s) => {
    const env = { ...process.env, NODE_NO_WARNINGS: "1" } as NodeJS.ProcessEnv;
    delete env.NODE_TEST_CONTEXT;
    const r = spawnSync(s.cmd, s.args, { cwd: s.cwd, encoding: "utf8", env, timeout: s.timeoutMs ?? 180_000, shell: false });
    if (r.error) return { name: s.name, status: "not_run", exitCode: null, reason: `could not start: ${r.error.message}`, outputTail: "" };
    const output = ((r.stdout ?? "") + (r.stderr ?? "")).slice(-4000);
    return { name: s.name, status: r.status === 0 ? "passed" : "failed", exitCode: r.status, reason: r.status === 0 ? "exit 0" : r.signal ? `killed (${r.signal})` : `exit ${r.status}`, outputTail: output };
  });
  for (const n of notRun) out.push({ name: n.name, status: "not_run", exitCode: null, reason: n.reason, outputTail: "" });
  return out;
}

/** Hash of check outcomes (not raw output, which contains timings). */
export function checksDigest(c: CheckRecord[]): string {
  return createHash("sha256").update(JSON.stringify(c.map(({ name, status, exitCode, reason }) => ({ name, status, exitCode, reason })))).digest("hex");
}
export const allPassed = (c: CheckRecord[]) => c.some((x) => x.status === "passed") && c.every((x) => x.status !== "failed");
