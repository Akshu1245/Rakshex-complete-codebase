/** Structural subset of @rakshex/cli ConsumerImpact. Detection/location are NOT reimplemented here. */
export interface Impact {
  verdict: "breaks_call" | "possibly_breaks" | "unresolved" | "response_review";
  change: { id: string; method: string; path: string; property: string | null; text?: string };
  site: { file: string; line: number; column: number; call: string; sdkMethod?: string };
  evidence: { payloadStatus: string; matchedKeys: string[]; unresolved: string[]; via: string[]; reason: string };
  semanticWarning?: { note: string; source: string };
}

/** A provider-documented, mechanical repair rule (e.g. rename a removed request key). */
export interface RepairRule {
  id: string;
  changeIds: string[];          // oasdiff ids the rule answers, e.g. request-property-removed
  path: string;                 // spec path
  removed: string;              // request key removed by the provider
  added: string;                // documented replacement key
  /** Values that make the rename behaviour-equivalent. Anything else -> HIGH risk. */
  lowRiskValues?: string[];
  source: string;               // changelog URL
  /** SDK version that knows the replacement key (e.g. stripe-node 23 for Endive). */
  dependencyBump?: { package: string; to: string };
}

export type SiteId = string; // "<file>:<line>"
export const siteId = (i: Pick<Impact, "site">): SiteId => `${i.site.file}:${i.site.line}`;
