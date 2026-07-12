import * as vscode from "vscode";
import type { RakshexApi } from "./api";

export type EngagementEvent =
  | "scan_run"
  | "finding_viewed"
  | "finding_status_changed"
  | "dashboard_opened"
  | "collection_imported"
  | "demo_completed"
  | "settings_changed"
  | "feedback_given";

interface EngagementRule {
  event: EngagementEvent;
  points: number;
  maxPerDay: number;
  category: "core" | "discovery" | "social";
}

const RULES: EngagementRule[] = [
  { event: "scan_run", points: 10, maxPerDay: 10, category: "core" },
  { event: "finding_viewed", points: 5, maxPerDay: 20, category: "core" },
  { event: "finding_status_changed", points: 5, maxPerDay: 10, category: "core" },
  { event: "dashboard_opened", points: 3, maxPerDay: 5, category: "core" },
  { event: "collection_imported", points: 10, maxPerDay: 3, category: "discovery" },
  { event: "demo_completed", points: 15, maxPerDay: 1, category: "discovery" },
  { event: "settings_changed", points: 5, maxPerDay: 3, category: "discovery" },
  { event: "feedback_given", points: 10, maxPerDay: 1, category: "social" },
];

interface EngagementRecord {
  event: EngagementEvent;
  timestamp: number;
  points: number;
}

const STORAGE_KEY = "rakshex.engagement";
const SCORE_KEY = "rakshex.engagementScore";
const LAST_ACTIVE_KEY = "rakshex.lastActive";

export class EngagementTracker {
  private records: EngagementRecord[] = [];
  private pendingServerEvents: EngagementRecord[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly api?: RakshexApi,
  ) {
    this.records = context.globalState.get<EngagementRecord[]>(STORAGE_KEY) ?? [];
  }

  record(event: EngagementEvent): void {
    const rule = RULES.find((r) => r.event === event);
    if (!rule) return;

    const now = Date.now();
    const dayStart = now - 24 * 60 * 60 * 1000;
    const dayEvents = this.records.filter((r) => r.event === event && r.timestamp > dayStart);

    if (dayEvents.length >= rule.maxPerDay) {
      return;
    }

    const record: EngagementRecord = {
      event,
      timestamp: now,
      points: rule.points,
    };

    this.records.push(record);
    if (this.records.length > 500) {
      this.records = this.records.slice(-500);
    }

    void this.context.globalState.update(STORAGE_KEY, this.records);
    void this.context.globalState.update(LAST_ACTIVE_KEY, now);

    const score = this.calculateScore();
    void this.context.globalState.update(SCORE_KEY, score);

    // Queue for server telemetry (flush batched)
    this.pendingServerEvents.push(record);
    if (this.pendingServerEvents.length >= 10) {
      void this.flushToServer();
    }
  }

  async flushToServer(): Promise<void> {
    if (!this.api || this.pendingServerEvents.length === 0) return;
    const batch = this.pendingServerEvents.splice(0, this.pendingServerEvents.length);
    try {
      await this.api.recordActivity("session_end", {
        engagementEvents: batch.map((e) => ({
          event: e.event,
          timestamp: new Date(e.timestamp).toISOString(),
          points: e.points,
        })),
      });
    } catch {
      // Silently fail telemetry — don't block user experience
      this.pendingServerEvents.unshift(...batch);
      if (this.pendingServerEvents.length > 100) {
        this.pendingServerEvents = this.pendingServerEvents.slice(-100);
      }
    }
  }

  calculateScore(): number {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const recent = this.records.filter((r) => r.timestamp > thirtyDaysAgo);

    const corePoints = recent
      .filter((r) => RULES.find((rule) => rule.event === r.event)?.category === "core")
      .reduce((sum, r) => sum + r.points, 0);
    const discoveryPoints = recent
      .filter((r) => RULES.find((rule) => rule.event === r.event)?.category === "discovery")
      .reduce((sum, r) => sum + r.points, 0);
    const socialPoints = recent
      .filter((r) => RULES.find((rule) => rule.event === r.event)?.category === "social")
      .reduce((sum, r) => sum + r.points, 0);

    const decayFactor = this.getDecayFactor(now);
    const weighted = corePoints * 0.5 + discoveryPoints * 0.25 + socialPoints * 0.25;
    return Math.round(Math.min(weighted * decayFactor, 100));
  }

  private getDecayFactor(now: number): number {
    const lastActive = this.context.globalState.get<number>(LAST_ACTIVE_KEY) ?? now;
    const daysInactive = (now - lastActive) / (24 * 60 * 60 * 1000);
    if (daysInactive < 1) return 1;
    if (daysInactive < 3) return 0.85;
    if (daysInactive < 7) return 0.6;
    if (daysInactive < 14) return 0.3;
    return 0.1;
  }

  getScore(): number {
    return this.context.globalState.get<number>(SCORE_KEY) ?? 0;
  }

  getSegment(): "at_risk" | "casual" | "engaged" | "power" {
    const score = this.getScore();
    if (score <= 20) return "at_risk";
    if (score <= 50) return "casual";
    if (score <= 80) return "engaged";
    return "power";
  }

  getLastActiveDays(): number {
    const lastActive = this.context.globalState.get<number>(LAST_ACTIVE_KEY) ?? Date.now();
    return Math.floor((Date.now() - lastActive) / (24 * 60 * 60 * 1000));
  }

  getWeeklyStats(): { scans: number; findings: number; score: number } {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weekEvents = this.records.filter((r) => r.timestamp > weekAgo);
    return {
      scans: weekEvents.filter((r) => r.event === "scan_run").length,
      findings: weekEvents.filter((r) => r.event === "finding_viewed").length,
      score: this.calculateScore(),
    };
  }

  getScanStreak(): number {
    const dayMs = 24 * 60 * 60 * 1000;
    const scanDays = new Set<number>();
    for (const r of this.records) {
      if (r.event === "scan_run") {
        scanDays.add(Math.floor(r.timestamp / dayMs));
      }
    }
    const sorted = Array.from(scanDays).sort((a, b) => b - a);
    if (sorted.length === 0) return 0;
    const today = Math.floor(Date.now() / dayMs);
    if (sorted[0] !== today && sorted[0] !== today - 1) return 0;
    let streak = 1;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === sorted[i - 1] - 1) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  getLongestStreak(): number {
    const dayMs = 24 * 60 * 60 * 1000;
    const scanDays = new Set<number>();
    for (const r of this.records) {
      if (r.event === "scan_run") {
        scanDays.add(Math.floor(r.timestamp / dayMs));
      }
    }
    const sorted = Array.from(scanDays).sort((a, b) => a - b);
    if (sorted.length === 0) return 0;
    let longest = 1;
    let current = 1;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === sorted[i - 1] + 1) {
        current++;
        longest = Math.max(longest, current);
      } else {
        current = 1;
      }
    }
    return longest;
  }

  recordOnboardingStep(
    step: "installed" | "signed_in" | "imported" | "scanned" | "found_issue",
  ): void {
    const key = `rakshex.onboarding.${step}`;
    void this.context.globalState.update(key, Date.now());
  }

  getOnboardingProgress(): { step: string; complete: boolean; timestamp?: number }[] {
    const steps: Array<{ step: string; key: string }> = [
      { step: "installed", key: "rakshex.onboarding.installed" },
      { step: "signed_in", key: "rakshex.onboarding.signed_in" },
      { step: "imported", key: "rakshex.onboarding.imported" },
      { step: "scanned", key: "rakshex.onboarding.scanned" },
      { step: "found_issue", key: "rakshex.onboarding.found_issue" },
    ];
    return steps.map((s) => {
      const ts = this.context.globalState.get<number>(s.key);
      return { step: s.step, complete: ts !== undefined, timestamp: ts ?? undefined };
    });
  }

  isOnboardingComplete(): boolean {
    return this.getOnboardingProgress().every((s) => s.complete);
  }

  getWeeklyActivityHeatmap(): boolean[] {
    const dayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const today = Math.floor(now / dayMs);
    const activeDays = new Set<number>();
    for (const r of this.records) {
      activeDays.add(Math.floor(r.timestamp / dayMs));
    }
    // Return last 7 days (oldest first), true if any activity that day
    const heatmap: boolean[] = [];
    for (let i = 6; i >= 0; i--) {
      heatmap.push(activeDays.has(today - i));
    }
    return heatmap;
  }
}
