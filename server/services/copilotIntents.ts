/**
 * Extended Security Copilot intents (deferred from Sprint 3).
 *
 * Adds four new intents on top of the original six:
 *   - `wow_regressions` — week-over-week regressions (cost / blocked count
 *     / red-team score). Surfaces the largest negative deltas.
 *   - `shadow_drift` — shadow LLM hosts that *newly appeared* in the last
 *     7 days vs the prior 7 days. The "things you didn't expect to see"
 *     intent.
 *   - `custom_date_range` — parses natural-language ranges
 *     ("last 30 days", "between 2026-04-01 and 2026-04-15") and reports
 *     traffic / blocked counts within the window.
 *   - `follow_up` — resolves pronouns ("and what about last week?") by
 *     re-running the prior intent with a shifted time window.
 *
 * Stays deterministic — no LLM call, no hallucination surface. Each
 * intent is a small SQL aggregator over existing tables.
 */

import type { CopilotMessageRow } from "../../drizzle/schema";

export type ExtendedIntentName =
  | "wow_regressions"
  | "shadow_drift"
  | "custom_date_range"
  | "follow_up";

export interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Parse a natural-language date range out of a free-form query.
 *
 * Supports:
 *   - "today" / "yesterday"
 *   - "last N day(s)" / "past N day(s)" / "previous N day(s)"
 *   - "last week" / "past week"  (== last 7 days)
 *   - "last month" / "past month" (== last 30 days)
 *   - "between YYYY-MM-DD and YYYY-MM-DD"
 *
 * Returns null if no recognised pattern is present.
 */
export function parseDateRange(query: string, now: Date = new Date()): DateRange | null {
  const q = query.trim().toLowerCase();

  if (/\btoday\b/.test(q)) {
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    return { start, end: now, label: "today" };
  }

  if (/\byesterday\b/.test(q)) {
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    start.setTime(start.getTime() - MS_PER_DAY);
    const end = new Date(start.getTime() + MS_PER_DAY - 1);
    return { start, end, label: "yesterday" };
  }

  const between = q.match(
    /between\s+(\d{4}-\d{2}-\d{2})\s+(?:and|to|-)\s+(\d{4}-\d{2}-\d{2})/i
  );
  if (between) {
    const start = new Date(`${between[1]}T00:00:00Z`);
    const end = new Date(`${between[2]}T23:59:59Z`);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
      return { start, end, label: `${between[1]} to ${between[2]}` };
    }
  }

  const lastN = q.match(/\b(?:last|past|previous)\s+(\d{1,5})\s*(day|days|d)\b/);
  if (lastN) {
    const n = Math.max(1, Math.min(365, parseInt(lastN[1], 10)));
    const start = new Date(now.getTime() - n * MS_PER_DAY);
    return { start, end: now, label: `last ${n} day${n === 1 ? "" : "s"}` };
  }

  if (/\b(?:last|past|previous)\s+week\b/.test(q)) {
    const start = new Date(now.getTime() - 7 * MS_PER_DAY);
    return { start, end: now, label: "last 7 days" };
  }

  if (/\b(?:last|past|previous)\s+month\b/.test(q)) {
    const start = new Date(now.getTime() - 30 * MS_PER_DAY);
    return { start, end: now, label: "last 30 days" };
  }

  return null;
}

/**
 * Compute week-over-week regressions across three signals: total cost,
 * blocked count, and average red-team security score. Returns an array
 * sorted by *severity of regression* — biggest negatives first.
 */
export interface WowSignal {
  signal: "cost_usd" | "blocked_attempts" | "redteam_score";
  thisWeek: number;
  priorWeek: number;
  /** absolute delta (this − prior). Negative for regressions. */
  delta: number;
  /** percent change vs. prior week, or null if prior week was zero. */
  pctChange: number | null;
  /** true when the delta is a regression for this signal. */
  isRegression: boolean;
}

export interface AuditRowLike {
  decision: string;
  estimatedCostUsd: string | number;
  createdAt: Date;
}

export interface RedteamRunLike {
  status: string;
  securityScore: number | null;
  finishedAt: Date | null;
  createdAt: Date;
}

export function computeWowRegressions(
  audit: AuditRowLike[],
  redteamRuns: RedteamRunLike[],
  now: Date = new Date()
): WowSignal[] {
  const oneWeekAgo = now.getTime() - 7 * MS_PER_DAY;
  const twoWeeksAgo = now.getTime() - 14 * MS_PER_DAY;

  const inThisWeek = (d: Date): boolean =>
    d.getTime() >= oneWeekAgo && d.getTime() <= now.getTime();
  const inPriorWeek = (d: Date): boolean =>
    d.getTime() >= twoWeeksAgo && d.getTime() < oneWeekAgo;

  let costThis = 0;
  let costPrior = 0;
  let blockedThis = 0;
  let blockedPrior = 0;
  for (const r of audit) {
    const c = Number(r.estimatedCostUsd) || 0;
    if (inThisWeek(r.createdAt)) {
      costThis += c;
      if (r.decision === "blocked") blockedThis += 1;
    } else if (inPriorWeek(r.createdAt)) {
      costPrior += c;
      if (r.decision === "blocked") blockedPrior += 1;
    }
  }

  const completed = redteamRuns.filter(r => r.status === "completed");
  const scoresThis: number[] = [];
  const scoresPrior: number[] = [];
  for (const r of completed) {
    const at = r.finishedAt ?? r.createdAt;
    if (inThisWeek(at)) scoresThis.push(r.securityScore ?? 0);
    else if (inPriorWeek(at)) scoresPrior.push(r.securityScore ?? 0);
  }
  const avg = (xs: number[]): number =>
    xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length;
  const scoreThis = avg(scoresThis);
  const scorePrior = avg(scoresPrior);

  const pct = (now: number, prior: number): number | null =>
    prior === 0 ? null : ((now - prior) / prior) * 100;

  const signals: WowSignal[] = [
    {
      signal: "cost_usd",
      thisWeek: round2(costThis),
      priorWeek: round2(costPrior),
      delta: round2(costThis - costPrior),
      pctChange: pct(costThis, costPrior),
      // Increase in cost is a regression (we want costs to stay flat or fall).
      isRegression: costThis > costPrior,
    },
    {
      signal: "blocked_attempts",
      thisWeek: blockedThis,
      priorWeek: blockedPrior,
      delta: blockedThis - blockedPrior,
      pctChange: pct(blockedThis, blockedPrior),
      // More blocks could be either "we got more aggressive" or "we got
      // attacked more". Conservative reading: surface as regression so
      // the operator looks.
      isRegression: blockedThis > blockedPrior,
    },
    {
      signal: "redteam_score",
      thisWeek: round1(scoreThis),
      priorWeek: round1(scorePrior),
      delta: round1(scoreThis - scorePrior),
      pctChange: pct(scoreThis, scorePrior),
      // Lower score is worse for red-team.
      isRegression: scoreThis < scorePrior,
    },
  ];

  // Sort regressions first (deeper first), then non-regressions.
  return signals.sort((a, b) => {
    if (a.isRegression !== b.isRegression) return a.isRegression ? -1 : 1;
    // Bigger absolute |delta| (worse change) ranked higher among regressions.
    const aMag = Math.abs(a.delta);
    const bMag = Math.abs(b.delta);
    return bMag - aMag;
  });
}

export interface ShadowEventLike {
  detectedHost: string;
  isAllowlisted: boolean;
  createdAt: Date;
}

export interface ShadowDrift {
  newHosts: Array<{ host: string; firstSeen: Date; calls: number }>;
  vanishedHosts: Array<{ host: string; lastSeen: Date }>;
  /** Hosts present in both windows (not drift, but useful context). */
  steadyCount: number;
}

/**
 * Identify shadow LLM hosts that newly appeared in the last `windowDays`
 * vs the prior `windowDays`. `vanishedHosts` are hosts seen in the prior
 * window but NOT in the current window — useful for confirming that an
 * earlier policy change actually stuck.
 */
export function computeShadowDrift(
  events: ShadowEventLike[],
  now: Date = new Date(),
  windowDays = 7
): ShadowDrift {
  const windowMs = windowDays * MS_PER_DAY;
  const recentStart = now.getTime() - windowMs;
  const priorStart = recentStart - windowMs;

  const recentHosts = new Map<string, { firstSeen: Date; calls: number }>();
  const priorHosts = new Map<string, { lastSeen: Date }>();

  for (const e of events) {
    if (e.isAllowlisted) continue;
    const t = e.createdAt.getTime();
    if (t >= recentStart) {
      const acc = recentHosts.get(e.detectedHost);
      if (!acc || e.createdAt < acc.firstSeen) {
        recentHosts.set(e.detectedHost, {
          firstSeen: e.createdAt,
          calls: (acc?.calls ?? 0) + 1,
        });
      } else {
        acc.calls += 1;
      }
    } else if (t >= priorStart) {
      const acc = priorHosts.get(e.detectedHost);
      if (!acc || e.createdAt > acc.lastSeen) {
        priorHosts.set(e.detectedHost, { lastSeen: e.createdAt });
      }
    }
  }

  const newHosts: ShadowDrift["newHosts"] = [];
  let steady = 0;
  for (const entry of Array.from(recentHosts.entries())) {
    const [host, info] = entry;
    if (priorHosts.has(host)) {
      steady += 1;
    } else {
      newHosts.push({ host, firstSeen: info.firstSeen, calls: info.calls });
    }
  }
  newHosts.sort((a, b) => b.calls - a.calls);

  const vanishedHosts: ShadowDrift["vanishedHosts"] = [];
  for (const entry of Array.from(priorHosts.entries())) {
    const [host, info] = entry;
    if (!recentHosts.has(host)) {
      vanishedHosts.push({ host, lastSeen: info.lastSeen });
    }
  }
  vanishedHosts.sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime());

  return { newHosts, vanishedHosts, steadyCount: steady };
}

/**
 * Detect a follow-up question and, if so, resolve the prior assistant
 * turn's intent. Returns:
 *   - { isFollowUp: false }                 — query is self-contained
 *   - { isFollowUp: true, priorIntent }     — re-run prior intent
 *
 * A query is treated as a follow-up if it contains a pronoun-style
 * reference ("and what about", "now show me", "same for", "what changed")
 * AND the previous assistant message had a known intent.
 */
export function detectFollowUp(
  query: string,
  messages: CopilotMessageRow[]
): { isFollowUp: boolean; priorIntent?: string } {
  const q = query.trim().toLowerCase();

  const followPatterns: RegExp[] = [
    /\band\s+(?:what|how)\s+about\b/,
    /\bnow\s+show\s+me\b/,
    /\bsame\s+(?:for|but|but\s+for)\b/,
    /\bwhat\s+changed\b/,
    /\bcompared?\s+to\b/,
    /^(?:also|then)\b/,
  ];

  if (!followPatterns.some(re => re.test(q))) return { isFollowUp: false };

  // Walk backwards through messages, find the most recent assistant message
  // and use its intent (stored on the references[] sentinel below).
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    const refs = (msg.references ?? []) as Array<{
      kind: string;
      label: string;
    }>;
    const intentRef = refs.find(r => r.kind === "_intent");
    if (intentRef) return { isFollowUp: true, priorIntent: intentRef.label };
    return { isFollowUp: true };
  }
  return { isFollowUp: true };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
