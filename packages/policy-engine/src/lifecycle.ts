/**
 * Policy lifecycle: draft → published (immutable) → archived.
 * Dry-run never blocks; violations are recorded separately.
 */

import { compilePolicy } from "./compile.js";
import { evaluatePolicy, simulatePolicy } from "./evaluate.js";
import { parsePolicy, PolicyParseError } from "./parse.js";
import type { EvaluationContext, PolicyDecision, PolicyDocument } from "./types.js";

export type PolicyLifecycleStatus = "draft" | "published" | "archived";

export interface PolicyRecord {
  id: string;
  name: string;
  status: PolicyLifecycleStatus;
  /** Monotonic version starting at 1 */
  revision: number;
  document: PolicyDocument;
  yamlSource: string;
  createdAt: string;
  publishedAt?: string;
  publishedBy?: string;
  /** Hash of published content for immutability checks */
  contentHash?: string;
}

export interface PolicyViolationRecord {
  id: string;
  policyId: string;
  revision: number;
  decision: PolicyDecision;
  context: EvaluationContext;
  dryRun: boolean;
  createdAt: string;
}

export interface PolicyException {
  id: string;
  policyId: string;
  reason: string;
  approvedBy?: string;
  expiresAt?: string;
  rulePath?: string;
}

export interface PolicyApproval {
  id: string;
  policyId: string;
  revision: number;
  action: "publish" | "exception" | "archive";
  approvedBy: string;
  at: string;
  notes?: string;
}

export class PolicyImmutabilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicyImmutabilityError";
  }
}

export class PolicyStore {
  private records = new Map<string, PolicyRecord>();
  private history: PolicyRecord[] = [];
  private violations: PolicyViolationRecord[] = [];
  private exceptions: PolicyException[] = [];
  private approvals: PolicyApproval[] = [];

  createDraft(id: string, yamlSource: string, name?: string): PolicyRecord {
    const document = parsePolicy(yamlSource);
    const record: PolicyRecord = {
      id,
      name: name ?? document.name ?? id,
      status: "draft",
      revision: 1,
      document,
      yamlSource,
      createdAt: new Date().toISOString(),
    };
    this.records.set(id, record);
    return record;
  }

  updateDraft(id: string, yamlSource: string): PolicyRecord {
    const existing = this.require(id);
    if (existing.status === "published") {
      throw new PolicyImmutabilityError(
        "Published policies are immutable; create a new draft revision",
      );
    }
    if (existing.status === "archived") {
      throw new PolicyImmutabilityError("Archived policies cannot be edited");
    }
    const document = parsePolicy(yamlSource);
    const next: PolicyRecord = {
      ...existing,
      document,
      yamlSource,
      name: document.name ?? existing.name,
      revision: existing.revision + (existing.status === "draft" ? 0 : 1),
    };
    // Bump revision only when re-drafting from non-draft; for pure draft edits keep same rev or bump
    if (existing.yamlSource !== yamlSource) {
      next.revision = existing.revision + 1;
    }
    this.records.set(id, next);
    return next;
  }

  publish(id: string, publishedBy: string): PolicyRecord {
    const existing = this.require(id);
    if (existing.status === "published") {
      throw new PolicyImmutabilityError("Already published");
    }
    // Validate compile
    compilePolicy(existing.document);
    const published: PolicyRecord = {
      ...existing,
      status: "published",
      publishedAt: new Date().toISOString(),
      publishedBy,
      contentHash: hashSource(existing.yamlSource),
    };
    this.records.set(id, published);
    this.history.push({ ...published });
    this.approvals.push({
      id: `appr_${this.approvals.length + 1}`,
      policyId: id,
      revision: published.revision,
      action: "publish",
      approvedBy: publishedBy,
      at: published.publishedAt!,
    });
    return published;
  }

  /** Reject mutation of published content. */
  assertMutable(id: string): void {
    const r = this.require(id);
    if (r.status === "published") {
      throw new PolicyImmutabilityError("Published policies are immutable");
    }
  }

  dryRun(id: string, ctx: EvaluationContext): PolicyDecision {
    const r = this.require(id);
    const decision = evaluatePolicy(r.document, { ...ctx, dryRun: true });
    this.violations.push({
      id: `viol_${this.violations.length + 1}`,
      policyId: id,
      revision: r.revision,
      decision,
      context: ctx,
      dryRun: true,
      createdAt: new Date().toISOString(),
    });
    // Dry-run never blocks — always return decision for inspection
    return decision;
  }

  enforce(id: string, ctx: EvaluationContext): PolicyDecision {
    const r = this.require(id);
    if (r.status !== "published" && r.status !== "draft") {
      return { action: "allow", reasons: ["No active policy"], matchedRules: [] };
    }
    // Check exceptions
    if (this.hasActiveException(id, ctx)) {
      return { action: "allow", reasons: ["Exception granted"], matchedRules: ["exception"] };
    }
    const decision = evaluatePolicy(r.document, { ...ctx, dryRun: false });
    if (decision.action !== "allow") {
      this.violations.push({
        id: `viol_${this.violations.length + 1}`,
        policyId: id,
        revision: r.revision,
        decision,
        context: ctx,
        dryRun: false,
        createdAt: new Date().toISOString(),
      });
    }
    return decision;
  }

  simulate(id: string, cases: EvaluationContext[]) {
    const r = this.require(id);
    return simulatePolicy(r.document, cases);
  }

  addException(ex: Omit<PolicyException, "id">): PolicyException {
    const row: PolicyException = { ...ex, id: `exc_${this.exceptions.length + 1}` };
    this.exceptions.push(row);
    return row;
  }

  getViolations(policyId?: string): PolicyViolationRecord[] {
    return policyId ? this.violations.filter((v) => v.policyId === policyId) : [...this.violations];
  }

  get(id: string): PolicyRecord | undefined {
    return this.records.get(id);
  }

  private require(id: string): PolicyRecord {
    const r = this.records.get(id);
    if (!r) throw new PolicyParseError(`Unknown policy ${id}`);
    return r;
  }

  private hasActiveException(policyId: string, ctx: EvaluationContext): boolean {
    const now = new Date().toISOString();
    return this.exceptions.some((e) => {
      if (e.policyId !== policyId) return false;
      if (e.expiresAt && e.expiresAt < now) return false;
      if (e.rulePath === "tools" && ctx.toolName) return true;
      if (!e.rulePath) return true;
      return false;
    });
  }
}

function hashSource(src: string): string {
  // Lightweight non-crypto fingerprint for immutability tests
  let h = 0;
  for (let i = 0; i < src.length; i++) {
    h = (Math.imul(31, h) + src.charCodeAt(i)) | 0;
  }
  return `h${(h >>> 0).toString(16)}`;
}

/** Validate YAML and reject invalid policies. */
export function validatePolicyYaml(
  yaml: string,
): { ok: true; document: PolicyDocument } | { ok: false; errors: string[] } {
  try {
    const document = parsePolicy(yaml);
    compilePolicy(document);
    return { ok: true, document };
  } catch (err) {
    if (err instanceof PolicyParseError) {
      return { ok: false, errors: [err.message, ...err.details] };
    }
    return { ok: false, errors: [err instanceof Error ? err.message : String(err)] };
  }
}
