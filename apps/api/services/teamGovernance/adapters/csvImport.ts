import type {
  AdapterSyncContext,
  AdapterSyncResult,
  GovernanceProvider,
  TeamGovernanceAdapter,
} from "../types";
import { getGovernanceCapabilities } from "../capabilities";

/**
 * CSV/manual import adapters do not invent data. Live sync returns
 * not_configured / not_implemented; ingestion happens via usage.ingest / seats.import.
 */
export function createCsvImportAdapter(provider: GovernanceProvider): TeamGovernanceAdapter {
  const caps = getGovernanceCapabilities(provider);
  return {
    provider,
    capabilities: caps,
    async sync(_ctx: AdapterSyncContext): Promise<AdapterSyncResult> {
      return {
        status: "not_implemented",
        errorCode: "NOT_IMPLEMENTED",
        errorMessage: `${provider}: live HTTP sync is not implemented. Import seats/usage via CSV or manual admin export APIs. ${caps.note}`,
        latencyMs: 0,
        seats: [],
        usageEvents: [],
      };
    },
  };
}

export function createMonitorOnlyAdapter(provider: GovernanceProvider): TeamGovernanceAdapter {
  const caps = getGovernanceCapabilities(provider);
  return {
    provider,
    capabilities: caps,
    async sync(_ctx: AdapterSyncContext): Promise<AdapterSyncResult> {
      return {
        status: "not_configured",
        errorCode: "MONITOR_ONLY",
        errorMessage: `${provider}: connector is monitor-only / not configured for live seat sync. ${caps.note}`,
        latencyMs: 0,
        seats: [],
        usageEvents: [],
      };
    },
  };
}
