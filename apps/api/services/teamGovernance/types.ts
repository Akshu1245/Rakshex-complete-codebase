/**
 * Team AI governance connector contracts and capability honesty markers.
 * Hard enforcement is only claimed for RakshEx gateway traffic or
 * provider-native spend APIs that are actually implemented.
 */

import type { ControlPlaneProvider } from "../controlPlane/providerRegistry";

export type GovernanceProvider = ControlPlaneProvider;

export interface GovernanceCapabilities {
  seatSync: boolean;
  usageSync: boolean;
  providerNativeLimit: boolean;
  gatewayHardLimit: boolean;
  personalAccountSupported: boolean;
  /** Honest human-readable limitation for admins. */
  note: string;
  /** live | import_only | monitor_only | not_implemented */
  implementationStatus: "live" | "import_only" | "monitor_only" | "not_implemented";
}

export interface NormalizedSeat {
  externalUserId: string;
  email?: string;
  displayName?: string;
  role?: string;
  status: "active" | "inactive" | "pending" | "unknown";
  lastActivityAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface NormalizedUsageEvent {
  externalEventId: string;
  externalUserId?: string;
  email?: string;
  occurredAt: Date;
  requestCount?: number;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  model?: string;
  product?: string;
  confidence?: "verified" | "imported" | "estimated" | "inferred";
  metadata?: Record<string, unknown>;
}

export interface AdapterSyncContext {
  workspaceId: number;
  providerAccountId?: number;
  /** Decrypted admin credential — never log or persist. */
  adminCredential?: string;
  orgName?: string;
  baseUrl?: string;
  since?: Date;
  signal?: AbortSignal;
}

export type AdapterSyncResult =
  | {
      status: "success" | "partial";
      seats: NormalizedSeat[];
      usageEvents: NormalizedUsageEvent[];
      latencyMs: number;
      warnings?: string[];
    }
  | {
      status: "not_configured" | "not_implemented" | "failed";
      errorCode: string;
      errorMessage: string;
      latencyMs: number;
      seats?: NormalizedSeat[];
      usageEvents?: NormalizedUsageEvent[];
    };

export interface SetSpendLimitResult {
  ok: boolean;
  mode: "provider_native" | "monitor_only" | "not_implemented";
  errorCode?: string;
  errorMessage?: string;
}

export interface TeamGovernanceAdapter {
  provider: GovernanceProvider;
  capabilities: GovernanceCapabilities;
  sync(ctx: AdapterSyncContext): Promise<AdapterSyncResult>;
  setUserSpendLimit?(
    ctx: AdapterSyncContext,
    externalUserId: string,
    limitUsd: number,
    email?: string,
  ): Promise<SetSpendLimitResult>;
}

export const USAGE_INGEST_MAX_BATCH = 500;
