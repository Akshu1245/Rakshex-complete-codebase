import * as vscode from "vscode";
import type { EngagementTracker } from "./engagementTracker";

const DAY_MS = 24 * 60 * 60 * 1000;

interface CohortRetention {
  day: number;
  retained: boolean;
  scans: number;
  findingsViewed: number;
}

interface TrustSignal {
  totalDismissals: number;
  falsePositives: number;
  trustScore: number; // 0-100
  trend: "improving" | "stable" | "declining";
}

interface PmfSignal {
  activated: boolean;
  scansPerWeek: number;
  findingsActedOn: number;
  score: number; // 0-100
  verdict: "struggling" | "needs_work" | "promising" | "strong_pmf";
}

export class RetentionEngine {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly engagementTracker: EngagementTracker,
  ) {}

  /** D1, D7, D30 retention for the current user */
  getRetentionCohort(): { d1: boolean; d7: boolean; d30: boolean; installedAt: number } {
    const installDate = this.context.globalState.get<number>("rakshex.installDate") ?? Date.now();
    const records =
      this.context.globalState.get<Array<{ event: string; timestamp: number }>>(
        "rakshex.engagement",
      ) ?? [];

    const daysSinceInstall = Math.floor((Date.now() - installDate) / DAY_MS);

    const hasActivityAfter = (days: number): boolean => {
      const cutoff = installDate + days * DAY_MS;
      return records.some((r) => r.timestamp >= cutoff && r.timestamp <= cutoff + DAY_MS);
    };

    return {
      d1: daysSinceInstall >= 1 ? hasActivityAfter(1) : false,
      d7: daysSinceInstall >= 7 ? hasActivityAfter(7) : false,
      d30: daysSinceInstall >= 30 ? hasActivityAfter(30) : false,
      installedAt: installDate,
    };
  }

  /** Activation quality: install → sign-in → first scan → second scan */
  getActivationFunnel(): {
    installed: boolean;
    signedIn: boolean;
    firstScan: boolean;
    secondScan: boolean;
    activated: boolean;
    timeToFirstScanDays: number | null;
  } {
    const progress = this.engagementTracker.getOnboardingProgress();
    const records =
      this.context.globalState.get<Array<{ event: string; timestamp: number }>>(
        "rakshex.engagement",
      ) ?? [];

    const installDate = this.context.globalState.get<number>("rakshex.installDate") ?? Date.now();
    const signedIn = progress.some((p) => p.step === "signed_in" && p.complete);
    const firstScanTs = progress.find((p) => p.step === "scanned" && p.complete)?.timestamp;
    const scanEvents = records
      .filter((r) => r.event === "scan_run")
      .sort((a, b) => a.timestamp - b.timestamp);
    const secondScan = scanEvents.length >= 2;

    const firstScan = firstScanTs !== undefined;
    return {
      installed: true,
      signedIn,
      firstScan,
      secondScan,
      activated: signedIn && firstScan,
      timeToFirstScanDays: firstScanTs ? Math.round((firstScanTs - installDate) / DAY_MS) : null,
    };
  }

  /** Trust score based on how users interact with findings */
  getTrustSignals(): TrustSignal {
    const dismissals =
      this.context.globalState.get<Array<{ reason: string; timestamp: number }>>(
        "rakshex.dismissals",
      ) ?? [];
    const records =
      this.context.globalState.get<Array<{ event: string; timestamp: number }>>(
        "rakshex.engagement",
      ) ?? [];

    const falsePositives = dismissals.filter((d) => d.reason === "False Positive").length;
    const totalDismissals = dismissals.length;
    const findingsViewed = records.filter((r) => r.event === "finding_viewed").length;
    const findingsChanged = records.filter((r) => r.event === "finding_status_changed").length;

    // Trust score: higher when users act on findings vs dismiss them
    const totalInteractions = findingsViewed + findingsChanged + totalDismissals;
    const trustScore =
      totalInteractions > 0
        ? Math.round(((findingsChanged + findingsViewed) / totalInteractions) * 100)
        : 100;

    // Simple trend: compare last week vs previous week
    const weekAgo = Date.now() - 7 * DAY_MS;
    const twoWeeksAgo = Date.now() - 14 * DAY_MS;
    const recentDismissals = dismissals.filter((d) => d.timestamp > weekAgo).length;
    const previousDismissals = dismissals.filter(
      (d) => d.timestamp > twoWeeksAgo && d.timestamp <= weekAgo,
    ).length;

    let trend: "improving" | "stable" | "declining" = "stable";
    if (recentDismissals < previousDismissals * 0.8) trend = "improving";
    else if (recentDismissals > previousDismissals * 1.2) trend = "declining";

    return { totalDismissals, falsePositives, trustScore, trend };
  }

  /** PMF signal based on usage depth */
  getPmfSignal(): PmfSignal {
    const funnel = this.getActivationFunnel();
    const weeklyStats = this.engagementTracker.getWeeklyStats();
    const records =
      this.context.globalState.get<Array<{ event: string; timestamp: number }>>(
        "rakshex.engagement",
      ) ?? [];

    const findingsChanged = records.filter((r) => r.event === "finding_status_changed").length;
    const scansPerWeek = weeklyStats.scans;

    // PMF scoring: activated + regular scans + findings acted on
    let score = 0;
    if (funnel.activated) score += 30;
    if (funnel.secondScan) score += 25;
    if (scansPerWeek >= 2) score += 20;
    if (findingsChanged >= 3) score += 15;
    if (scansPerWeek >= 5) score += 10;

    let verdict: PmfSignal["verdict"] = "struggling";
    if (score >= 80) verdict = "strong_pmf";
    else if (score >= 60) verdict = "promising";
    else if (score >= 35) verdict = "needs_work";

    return {
      activated: funnel.activated,
      scansPerWeek,
      findingsActedOn: findingsChanged,
      score,
      verdict,
    };
  }

  /** Value metrics: what real value has Rakshex delivered */
  getValueMetrics(): {
    scansTotal: number;
    findingsDiscovered: number;
    findingsResolved: number;
    secretsFound: number;
    estimatedIssuesPrevented: number;
  } {
    const records =
      this.context.globalState.get<Array<{ event: string; timestamp: number }>>(
        "rakshex.engagement",
      ) ?? [];

    const scansTotal = records.filter((r) => r.event === "scan_run").length;
    const findingsDiscovered = records.filter((r) => r.event === "finding_viewed").length;
    const findingsResolved = records.filter((r) => r.event === "finding_status_changed").length;

    // Estimated secrets: assume 15% of viewed findings are critical secrets
    const secretsFound = Math.round(findingsDiscovered * 0.15);
    // Estimated issues prevented: assume each resolved finding prevents ~2 future issues
    const estimatedIssuesPrevented = findingsResolved * 2;

    return {
      scansTotal,
      findingsDiscovered,
      findingsResolved,
      secretsFound,
      estimatedIssuesPrevented,
    };
  }

  /** Record a dismissal for trust tracking */
  recordDismissal(reason: string): void {
    const dismissals =
      this.context.globalState.get<Array<{ reason: string; timestamp: number }>>(
        "rakshex.dismissals",
      ) ?? [];
    dismissals.push({ reason, timestamp: Date.now() });
    // Keep last 200
    if (dismissals.length > 200) {
      void this.context.globalState.update("rakshex.dismissals", dismissals.slice(-200));
    } else {
      void this.context.globalState.update("rakshex.dismissals", dismissals);
    }
  }
}
