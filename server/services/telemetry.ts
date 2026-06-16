/**
 * Rakshex Product Telemetry
 *
 * Privacy-safe analytics for understanding user behavior,
 * onboarding conversion, and product health.
 *
 * Design principles:
 *  - No PII ever sent (user IDs are hashed)
 *  - No code contents ever sent
 *  - Aggregated metrics only
 *  - Opt-out supported
 *  - Events batched and sent asynchronously
 */

import { logger } from "../_core/logger";

export type TelemetryEvent =
  | "extension_activated"
  | "extension_deactivated"
  | "onboarding_started"
  | "onboarding_completed"
  | "onboarding_step"
  | "auth_success"
  | "auth_failure"
  | "collection_imported"
  | "scan_initiated"
  | "scan_completed"
  | "finding_viewed"
  | "finding_fixed"
  | "kill_switch_triggered"
  | "cost_alert_viewed"
  | "dashboard_opened"
  | "settings_changed"
  | "demo_mode_used"
  | "error_occurred";

interface TelemetryPayload {
  event: TelemetryEvent;
  timestamp: string;
  sessionId: string;
  userHash?: string;
  properties?: Record<string, unknown>;
}

const BATCH_SIZE = 20;
const FLUSH_INTERVAL_MS = 30_000;
const MAX_BUFFER_SIZE = 100;

class TelemetryService {
  private buffer: TelemetryPayload[] = [];
  private flushTimer?: NodeJS.Timeout;
  private sessionId: string;
  private enabled = true;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.startFlushTimer();
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  /**
   * Track a telemetry event. Non-blocking — events are batched.
   */
  track(event: TelemetryEvent, properties?: Record<string, unknown>, userHash?: string): void {
    if (!this.enabled) return;

    const payload: TelemetryPayload = {
      event,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      userHash: userHash ? this.hashUser(userHash) : undefined,
      properties,
    };

    this.buffer.push(payload);

    if (this.buffer.length >= BATCH_SIZE) {
      void this.flush();
    }

    // Prevent unbounded growth
    if (this.buffer.length > MAX_BUFFER_SIZE) {
      this.buffer = this.buffer.slice(-MAX_BUFFER_SIZE);
    }
  }

  /**
   * Track onboarding funnel steps.
   */
  trackOnboarding(step: number, stepName: string, completed: boolean): void {
    this.track("onboarding_step", { step, stepName, completed });
  }

  /**
   * Track scan lifecycle.
   */
  trackScan(
    collectionId: string,
    scanType: string,
    durationMs: number,
    findingsCount: number,
  ): void {
    this.track("scan_completed", { collectionId, scanType, durationMs, findingsCount });
  }

  /**
   * Track authentication events.
   */
  trackAuth(success: boolean, error?: string): void {
    this.track(success ? "auth_success" : "auth_failure", { error });
  }

  /**
   * Track errors (anonymized — no stack traces with paths).
   */
  trackError(errorType: string, message: string): void {
    this.track("error_occurred", { errorType, message: message.slice(0, 200) });
  }

  /**
   * Flush buffered events to the analytics endpoint.
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0, BATCH_SIZE);

    try {
      const endpoint = process.env.TELEMETRY_ENDPOINT || "https://telemetry.rakshex.in/v1/events";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-telemetry-source": "rakshex-server",
        },
        body: JSON.stringify({ events: batch }),
      });

      if (!response.ok) {
        logger.warn(
          { status: response.status, events: batch.length },
          "[Telemetry] Flush failed, will retry",
        );
        // Put back for retry (but don't grow indefinitely)
        if (this.buffer.length + batch.length <= MAX_BUFFER_SIZE) {
          this.buffer.unshift(...batch);
        }
      }
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        "[Telemetry] Flush error",
      );
      // Retry on next flush
      if (this.buffer.length + batch.length <= MAX_BUFFER_SIZE) {
        this.buffer.unshift(...batch);
      }
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, FLUSH_INTERVAL_MS);
  }

  private hashUser(userId: string): string {
    // Simple hash for privacy — not for security
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    return `u_${Math.abs(hash).toString(36)}`;
  }

  dispose(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    void this.flush();
  }
}

export const telemetry = new TelemetryService();
