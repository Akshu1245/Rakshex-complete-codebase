/**
 * Consumer-impact severity normalizer.
 *
 * oasdiff ranks changes by *provider contract* severity. On a real Stripe version
 * pair that is tens of thousands of items, most of them response-enum additions that
 * cannot break a caller. This module re-ranks changes by what the *customer's code*
 * actually does at each call site (endpoint + request keys sent), keeps a documented
 * semantic warning when one exists, and reports unresolved sites instead of hiding them.
 * It is a triage aid, not proof of safety.
 */
import notesFile from "./data/stripe-semantic-notes.json" with { type: "json" };
import type { ApiCallSite } from "./apiImpact.js";

export interface ContractChange {
  /** oasdiff check id; the basic engine supplies `kind` instead. */
  id?: string;
  kind?: string;
  level?: number;
  operation?: string;
  method?: string;
  path?: string;
  text?: string;
}

export type ImpactVerdict = "breaks_call" | "possibly_breaks" | "unresolved" | "response_review";

export interface ConsumerImpact {
  verdict: ImpactVerdict;
  rank: number;
  change: { id: string; level?: number; method: string; path: string; property: string | null; text?: string };
  site: { file: string; line: number; column: number; call: string; sdkMethod?: string };
  evidence: { payloadStatus: string; matchedKeys: string[]; unresolved: string[]; via: string[]; reason: string };
  semanticWarning?: { note: string; source: string };
}

export interface ConsumerImpactSummary {
  totalChanges: number;
  requestSideChanges: number;
  changesOnEndpointsYouCall: number;
  suppressedNotCalled: number;
  impacts: ConsumerImpact[];
  scope: string;
}

const RANK: Record<ImpactVerdict, number> = { breaks_call: 0, possibly_breaks: 1, unresolved: 2, response_review: 3 };
const NOTES = (notesFile as { notes: Record<string, { note: string; source: string }> }).notes;

export function isRequestSide(id: string): boolean {
  if (id.startsWith("response-") || id.startsWith("response_")) return false;
  return id.includes("request") || id.startsWith("api-") || /^(operation|path)_removed/.test(id);
}

export function changedProperty(text: string | undefined): string | null {
  if (!text) return null;
  const before = /`([^`]+)` request (?:property|parameter)/.exec(text);
  if (before) return before[1]!;
  const after = /request (?:property|parameter) `([^`]+)`/.exec(text);
  return after ? after[1]! : null;
}

function segs(path: string): string[] { return path.split("/").filter(Boolean); }

export function pathMatches(specPath: string, callPath: string): boolean {
  const a = segs(specPath), b = segs(callPath);
  return a.length === b.length && a.every((s, i) => s === b[i] || /^\{[^/{}]+\}$/.test(s) || b[i] === "{*}" || s === "{*}");
}

function sends(keys: string[], prop: string): string[] {
  return keys.filter((k) => k === prop || k.startsWith(prop + "/"));
}

function parentOf(prop: string): string | null {
  const i = prop.lastIndexOf("/");
  return i < 0 ? null : prop.slice(0, i);
}

export function normalizeConsumerImpact(changes: ContractChange[], sites: ApiCallSite[]): ConsumerImpactSummary {
  const impacts: ConsumerImpact[] = [];
  let requestSide = 0, onCalled = 0, suppressed = 0;
  const attributable = sites.filter((s) => s.method && s.path && !s.reason);
  const responseSeen = new Set<string>();
  for (const raw of changes) {
    const c = { ...raw, id: raw.id ?? raw.kind ?? "unknown" };
    const method = (c.method ?? c.operation ?? "").toUpperCase();
    const path = c.path ?? "";
    const req = isRequestSide(c.id);
    if (req) requestSide++;
    const hits = attributable.filter((s) => s.method === method && pathMatches(path, s.path!));
    if (hits.length === 0) { suppressed++; continue; }
    onCalled++;
    const prop = changedProperty(c.text ?? (raw as { message?: string }).message);
    for (const s of hits) {
      const base = {
        change: { id: c.id, ...(c.level !== undefined ? { level: c.level } : {}), method, path, property: prop, ...(c.text ? { text: c.text } : {}) },
        site: { file: s.file, line: s.line, column: s.column, call: s.call, ...(s.sdkMethod ? { sdkMethod: s.sdkMethod } : {}) },
      };
      const ev = (matched: string[], reason: string) => ({ payloadStatus: s.payload.status, matchedKeys: matched, unresolved: s.payload.unresolved, via: s.payload.via, reason });
      let verdict: ImpactVerdict | null = null;
      let evidence;
      if (!req) {
        const k = method + " " + path + " " + s.file + ":" + s.line;
        if (responseSeen.has(k)) continue; // one response-review row per site+endpoint
        responseSeen.add(k);
        verdict = "response_review";
        evidence = ev([], "response-side change on an endpoint this code calls; check response handling");
      } else if (!prop) {
        verdict = "possibly_breaks";
        evidence = ev([], "request-side change without a single property (operation-level)");
      } else {
        const hit = sends(s.payload.keys, prop);
        const complete = s.payload.status === "resolved";
        if (c.id === "new-required-request-property") {
          const parent = parentOf(prop);
          const parentSent = parent === null || sends(s.payload.keys, parent).length > 0;
          if (hit.length > 0) continue; // already sends it
          if (parentSent && complete) { verdict = "breaks_call"; evidence = ev(parent ? sends(s.payload.keys, parent) : [], "new required property not sent"); }
          else if (!complete) { verdict = "unresolved"; evidence = ev([], "payload not fully resolved; cannot tell whether required property is sent"); }
          else continue; // parent object not sent: requirement does not apply
        } else if (hit.length > 0) {
          if (c.id === "request-property-removed") { verdict = "breaks_call"; evidence = ev(hit, "call sends a removed request property"); }
          else if (c.id === "request-property-enum-value-removed") {
            const removed = /enum value `([^`]+)`/.exec(c.text ?? "")?.[1];
            const sent = s.payload.values[prop];
            if (removed && sent !== undefined && sent !== removed && !sent.includes("{*}")) continue; // literal differs
            verdict = removed && sent === removed ? "breaks_call" : "possibly_breaks";
            evidence = ev(hit, sent === removed ? "call sends the removed enum value" : "call sends this property; value not statically known");
          } else { verdict = "possibly_breaks"; evidence = ev(hit, "call sends a property whose contract changed"); }
        } else if (!complete) {
          verdict = "unresolved"; evidence = ev([], "payload not fully resolved (spread/dynamic); property may be sent");
        } else continue; // resolved payload does not send it
      }
      const note = prop ? NOTES[method + " " + path + " " + prop] : undefined;
      impacts.push({ verdict, rank: RANK[verdict], ...base, evidence: evidence!, ...(note && verdict !== "response_review" ? { semanticWarning: { note: note.note, source: note.source } } : {}) });
    }
  }
  impacts.sort((a, b) => a.rank - b.rank || (b.change.level ?? 0) - (a.change.level ?? 0) || a.site.file.localeCompare(b.site.file) || a.site.line - b.site.line);
  return {
    totalChanges: changes.length,
    requestSideChanges: requestSide,
    changesOnEndpointsYouCall: onCalled,
    suppressedNotCalled: suppressed,
    impacts,
    scope: "Ranks provider changes by what inspected call sites send. Sites the engine cannot see (unsupported clients, generated code, other languages) are not covered. 'unresolved' means a human must check. Not proof of safety.",
  };
}
