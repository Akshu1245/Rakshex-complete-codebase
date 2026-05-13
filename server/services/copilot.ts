/**
 * Security Copilot — chat-over-DevPulse-data.
 *
 * The copilot answers questions about a tenant's runtime data:
 *   - "How many prompt-injection attempts did we block today?"
 *   - "Which model is most expensive this week?"
 *   - "Show me unsanctioned LLM hosts in the last 30 days."
 *
 * Implementation: deterministic retrieval over the tenant's own tables. We
 * deliberately avoid running an LLM over customer data here — answering
 * security questions with a hallucination-prone model is a footgun. Instead,
 * we route each intent to a dedicated SQL helper and return a structured
 * answer plus references the UI can link to.
 *
 * If a tenant wants narrative explanations on top, they can pipe the
 * structured answer through their own LLM via the gateway — closing the
 * loop without ever giving the copilot direct prompt-injection surface.
 */

import { logger } from "../_core/logger";
import {
  appendCopilotMessage,
  createCopilotConversation,
  getGatewayDailyTotals,
  getGatewayAuditRecent,
  listAutofix,
  listCopilotMessages,
  listRedteamRuns,
  listShadowAiEvents,
} from "../db";
import {
  computeShadowDrift,
  computeWowRegressions,
  detectFollowUp,
  parseDateRange,
  type DateRange,
  type ExtendedIntentName,
} from "./copilotIntents";

export type IntentName =
  | "blocked_attempts_today"
  | "most_expensive_model"
  | "shadow_hosts_recent"
  | "redteam_score_trend"
  | "open_autofixes"
  | "help"
  | "fallback"
  | ExtendedIntentName;

interface IntentMatch {
  intent: IntentName;
  args?: Record<string, unknown>;
}

const INTENT_RULES: Array<{
  intent: IntentName;
  match: RegExp;
}> = [
  // Newer / more specific rules first so e.g. "drift" matches shadow_drift
  // before falling through to the older shadow_hosts_recent rule.
  {
    intent: "wow_regressions",
    match:
      /(week[- ]over[- ]week|w(?:o|\/)w|regression|got worse|degraded|deteriorat).*?(cost|spend|score|block|attempt|red[- ]?team)?/i,
  },
  {
    intent: "shadow_drift",
    match:
      /\b(?:shadow|rogue|unsanctioned).*?(?:drift|new|change|appeared|disappeared|gone)\b/i,
  },
  {
    intent: "blocked_attempts_today",
    match: /(blocked|injection|attempt).*(today|24|day)/i,
  },
  {
    intent: "most_expensive_model",
    match: /(expensive|cost|spend|bill).*(model|llm|provider|week|month)/i,
  },
  {
    intent: "shadow_hosts_recent",
    match: /(shadow|rogue|unsanctioned|unauthorized|allowlist).*(host|llm|model)/i,
  },
  {
    intent: "redteam_score_trend",
    match: /(red[- ]?team|security score|attack simulation|score).*?(trend|over time|history|last)/i,
  },
  { intent: "open_autofixes", match: /(autofix|remediation|fix|suggestion).*(open|pending)/i },
  { intent: "help", match: /^(help|what can you do|examples?|commands?)\b/i },
];

export function classifyQuery(query: string): IntentMatch {
  const trimmed = query.trim();
  if (trimmed.length === 0) return { intent: "help" };

  // Custom-date-range intent: trigger when an explicit range phrase is
  // detected AND the query is asking about traffic / blocks / cost over
  // that window (i.e. not a different intent already).
  const range = parseDateRange(trimmed);
  if (range) {
    return { intent: "custom_date_range", args: { range } };
  }

  for (const rule of INTENT_RULES) {
    if (rule.match.test(trimmed)) return { intent: rule.intent };
  }
  return { intent: "fallback" };
}

export interface CopilotAnswer {
  intent: IntentName;
  text: string;
  data?: unknown;
  references: Array<{ kind: string; id?: string | number; label: string }>;
}

export async function answerForTenant(
  userId: number,
  query: string
): Promise<CopilotAnswer> {
  const match = classifyQuery(query);
  const { intent } = match;
  switch (intent) {
    case "blocked_attempts_today": {
      const audit = await getGatewayAuditRecent(userId, 1000);
      const todayStr = new Date().toISOString().slice(0, 10);
      const today = audit.filter(r => r.createdAt.toISOString().startsWith(todayStr));
      const blocked = today.filter(r => r.decision === "blocked");
      const top = aggregateTop(blocked.map(r => r.blockReason ?? "unknown"));
      return {
        intent,
        text:
          blocked.length === 0
            ? "No prompt-injection attempts blocked today. The gateway has been quiet."
            : `Blocked ${blocked.length} attempt(s) today. Top reasons: ${top.slice(0, 3)
                .map(([reason, count]) => `${reason} (${count})`)
                .join(", ")}.`,
        data: { count: blocked.length, byReason: top },
        references: [
          { kind: "page", label: "Runtime audit log" },
        ],
      };
    }
    case "most_expensive_model": {
      const audit = await getGatewayAuditRecent(userId, 5000);
      const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const recent = audit.filter(r => r.createdAt.getTime() >= since);
      const byModel = new Map<string, { tokens: number; cost: number; calls: number }>();
      for (const r of recent) {
        const acc = byModel.get(r.model) ?? { tokens: 0, cost: 0, calls: 0 };
        acc.tokens += r.totalTokens;
        acc.cost += Number(r.estimatedCostUsd);
        acc.calls += 1;
        byModel.set(r.model, acc);
      }
      const ranked = Array.from(byModel.entries()).sort(
        (a, b) => b[1].cost - a[1].cost
      );
      const top = ranked[0];
      return {
        intent,
        text: top
          ? `Last 7 days: ${top[0]} drove the highest spend at $${top[1].cost.toFixed(2)} across ${top[1].calls} calls.`
          : "No LLM traffic in the last 7 days.",
        data: ranked.map(([model, v]) => ({ model, ...v })),
        references: [{ kind: "page", label: "Cost dashboard" }],
      };
    }
    case "shadow_hosts_recent": {
      const events = await listShadowAiEvents(userId, 500);
      const rogue = events.filter(e => !e.isAllowlisted);
      const byHost = aggregateTop(rogue.map(e => e.detectedHost));
      return {
        intent,
        text:
          rogue.length === 0
            ? "No rogue LLM hosts detected. All observed traffic is on the allowlist."
            : `Detected ${rogue.length} unsanctioned LLM call(s). Top hosts: ${byHost
                .slice(0, 5)
                .map(([host, count]) => `${host} (${count})`)
                .join(", ")}.`,
        data: { rogueCount: rogue.length, byHost },
        references: [{ kind: "page", label: "Shadow AI" }],
      };
    }
    case "redteam_score_trend": {
      const runs = await listRedteamRuns(userId, 25);
      const completed = runs.filter(r => r.status === "completed");
      const scores = completed
        .map(r => ({ at: r.finishedAt ?? r.createdAt, score: r.securityScore ?? 0 }))
        .sort((a, b) => a.at.getTime() - b.at.getTime());
      const last = scores.at(-1);
      const first = scores.at(0);
      const delta =
        last && first ? last.score - first.score : 0;
      return {
        intent,
        text: last
          ? `Latest red-team score: ${last.score}/100 (${
              delta >= 0 ? "+" : ""
            }${delta} since first run). ${completed.length} completed runs.`
          : "No completed red-team runs yet. Schedule one to get a baseline.",
        data: scores,
        references: completed
          .slice(0, 5)
          .map(r => ({ kind: "redteam_run", id: r.id, label: `Run ${r.id.slice(0, 8)}` })),
      };
    }
    case "wow_regressions": {
      const audit = await getGatewayAuditRecent(userId, 5000);
      const runs = await listRedteamRuns(userId, 100);
      const signals = computeWowRegressions(audit, runs);
      const regressions = signals.filter(s => s.isRegression);
      const lines = signals.map(s => {
        const arrow = s.isRegression ? "↑" : "→";
        const pct =
          s.pctChange === null
            ? "n/a"
            : `${s.pctChange >= 0 ? "+" : ""}${s.pctChange.toFixed(1)}%`;
        const unit = s.signal === "cost_usd" ? "$" : "";
        return `- ${s.signal.replace(/_/g, " ")} ${arrow} ${unit}${s.thisWeek} vs ${unit}${s.priorWeek} (${pct})`;
      });
      return {
        intent,
        text:
          regressions.length === 0
            ? `Week over week: nothing looks regressed.\n${lines.join("\n")}`
            : `${regressions.length} signal(s) regressed week over week:\n${lines.join("\n")}`,
        data: signals,
        references: [
          { kind: "_intent", label: intent },
          { kind: "page", label: "Cost dashboard" },
          { kind: "page", label: "Red-team history" },
        ],
      };
    }
    case "shadow_drift": {
      const events = await listShadowAiEvents(userId, 2000);
      const drift = computeShadowDrift(events);
      const newList = drift.newHosts
        .slice(0, 10)
        .map(h => `${h.host} (${h.calls} call${h.calls === 1 ? "" : "s"})`);
      const vanishedList = drift.vanishedHosts
        .slice(0, 10)
        .map(h => h.host);
      const newSummary =
        drift.newHosts.length === 0
          ? "No new shadow hosts in the last 7 days."
          : `${drift.newHosts.length} new shadow host(s): ${newList.join(", ")}.`;
      const vanishedSummary =
        drift.vanishedHosts.length === 0
          ? ""
          : ` ${drift.vanishedHosts.length} host(s) vanished: ${vanishedList.join(", ")}.`;
      return {
        intent,
        text: `${newSummary}${vanishedSummary}`,
        data: drift,
        references: [
          { kind: "_intent", label: intent },
          { kind: "page", label: "Shadow AI" },
        ],
      };
    }
    case "custom_date_range": {
      const range =
        typeof match.args?.range === "object" && match.args?.range !== null
          ? (match.args.range as DateRange)
          : null;
      if (!range) {
        return {
          intent,
          text:
            "I detected a date-range intent but couldn't parse the window. Try `last 30 days` or `between 2026-04-01 and 2026-04-15`.",
          references: [{ kind: "_intent", label: intent }],
        };
      }
      const audit = await getGatewayAuditRecent(userId, 5000);
      const inRange = audit.filter(
        r =>
          r.createdAt.getTime() >= range.start.getTime() &&
          r.createdAt.getTime() <= range.end.getTime()
      );
      const blocked = inRange.filter(r => r.decision === "blocked").length;
      const allowed = inRange.filter(r => r.decision === "allowed").length;
      const cost = inRange.reduce(
        (sum, r) => sum + Number(r.estimatedCostUsd) || 0,
        0
      );
      return {
        intent,
        text:
          inRange.length === 0
            ? `No gateway traffic for ${range.label}.`
            : `${range.label}: ${allowed} allowed, ${blocked} blocked, $${cost.toFixed(2)} estimated cost across ${inRange.length} call(s).`,
        data: {
          range: {
            start: range.start.toISOString(),
            end: range.end.toISOString(),
            label: range.label,
          },
          allowed,
          blocked,
          cost: Math.round(cost * 100) / 100,
          calls: inRange.length,
        },
        references: [
          { kind: "_intent", label: intent },
          { kind: "page", label: "Runtime audit log" },
        ],
      };
    }
    case "follow_up": {
      // follow_up reaches answerForTenant only if the caller couldn't
      // resolve the prior intent. Surface a graceful "what would you like
      // me to redo?" so the user can disambiguate.
      return {
        intent,
        text:
          "I caught a follow-up but I'm not sure which earlier question you mean. Try asking the question with the new window directly, e.g. \"what about last 30 days?\" with the metric named.",
        references: [{ kind: "_intent", label: intent }],
      };
    }
    case "open_autofixes": {
      const fixes = await listAutofix(userId, "open");
      return {
        intent,
        text:
          fixes.length === 0
            ? "No open auto-fix suggestions. Everything is current."
            : `${fixes.length} open suggestion(s). Latest: "${fixes[0]?.title ?? "n/a"}".`,
        data: fixes.slice(0, 10).map(f => ({
          id: f.id,
          title: f.title,
          findingType: f.findingType,
        })),
        references: fixes
          .slice(0, 10)
          .map(f => ({
            kind: "autofix",
            id: f.id,
            label: f.title.slice(0, 64),
          })),
      };
    }
    case "help":
      return {
        intent,
        text:
          "I can answer questions about your runtime data. Try:\n" +
          "- How many prompt-injection attempts were blocked today?\n" +
          "- Which model is most expensive this week?\n" +
          "- Show me shadow LLM hosts.\n" +
          "- What is my red-team security score trend?\n" +
          "- List open auto-fix suggestions.",
        references: [],
      };
    case "fallback":
    default: {
      const totals = await getGatewayDailyTotals(userId, 7);
      const tokens = totals.reduce((sum, d) => sum + d.totalTokens, 0);
      return {
        intent: "fallback",
        text:
          `I didn't recognize that question, but here's a quick snapshot: ` +
          `${tokens.toLocaleString()} tokens consumed in the last 7 days. Type "help" for examples.`,
        data: totals,
        references: [],
      };
    }
  }
}

function aggregateTop(values: string[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

export async function startConversation(
  userId: number,
  conversationId: string,
  title: string
): Promise<void> {
  await createCopilotConversation(userId, conversationId, title);
}

export async function sendCopilotMessage(
  userId: number,
  conversationId: string,
  query: string
): Promise<CopilotAnswer> {
  await appendCopilotMessage({
    conversationId,
    role: "user",
    content: query,
  });

  // Resolve follow-ups by re-running the prior assistant turn's intent
  // when the user says "and what about last 30 days?", "same for last
  // week", etc. The prior intent is stored as a sentinel reference
  // entry on the previous assistant message ({kind: "_intent", label: <intent>}).
  let answer: CopilotAnswer;
  const priorMessages = await listCopilotMessages(conversationId);
  const followUp = detectFollowUp(query, priorMessages);
  if (followUp.isFollowUp && followUp.priorIntent) {
    // Re-run the prior intent with the new query (so e.g. a date-range
    // re-parse picks up "last 30 days" inside the follow-up).
    const synthetic = `${query} ${followUp.priorIntent.replace(/_/g, " ")}`;
    answer = await answerForTenant(userId, synthetic);
  } else {
    answer = await answerForTenant(userId, query);
  }

  // Persist the resolved intent so the *next* turn can detect a chain
  // of follow-ups.
  const refsWithIntent = answer.references.some(r => r.kind === "_intent")
    ? answer.references
    : [...answer.references, { kind: "_intent", label: answer.intent }];

  await appendCopilotMessage({
    conversationId,
    role: "assistant",
    content: answer.text,
    references: refsWithIntent,
  });
  logger.info(
    { userId, conversationId, intent: answer.intent, followUp: followUp.isFollowUp },
    "[Copilot] answered query"
  );
  return { ...answer, references: refsWithIntent };
}

export async function getConversation(conversationId: string) {
  return listCopilotMessages(conversationId);
}
