/**
 * Rakshex Demo Mode — Cinematic YC Demo Experience
 *
 * Provides seeded fake data and scripted interactions for
 * investor demos, Product Hunt launches, and onboarding.
 * Works offline. Auto-resets on demand.
 */

import * as vscode from "vscode";
import type { DashboardData, Finding, Severity, FindingStatus } from "./api";

export interface DemoScenario {
  name: string;
  description: string;
  run: () => Promise<void>;
}

const DEMO_FINDINGS: Finding[] = [
  {
    id: "demo-f-001",
    title: "Exposed OpenAI API key in collection",
    severity: "Critical",
    status: "open",
    category: "secret_leak",
    collectionName: "Production APIs",
  },
  {
    id: "demo-f-002",
    title: "Missing auth header on /payments endpoint",
    severity: "High",
    status: "open",
    category: "broken_auth",
    collectionName: "Production APIs",
  },
  {
    id: "demo-f-003",
    title: "SQL injection vector in query param",
    severity: "High",
    status: "in-progress",
    category: "injection",
    collectionName: "User Service",
  },
  {
    id: "demo-f-004",
    title: "PII exposure in response schema",
    severity: "Medium",
    status: "open",
    category: "data_exposure",
    collectionName: "User Service",
  },
  {
    id: "demo-f-005",
    title: "Rate limit not enforced on public endpoint",
    severity: "Medium",
    status: "open",
    category: "rate_limiting",
    collectionName: "Public API",
  },
  {
    id: "demo-f-006",
    title: "CORS wildcard allows any origin",
    severity: "Low",
    status: "resolved",
    category: "cors",
    collectionName: "Public API",
  },
];

const DEMO_DASHBOARD: DashboardData = {
  collections: 12,
  recentScans: 47,
  totalFindings: 156,
  openFindings: 23,
  weeklyCost: 1247.53,
  lastScanAt: new Date().toISOString(),
};

export function getDemoDashboard(): DashboardData {
  return { ...DEMO_DASHBOARD };
}

export function getDemoFindings(): Finding[] {
  return DEMO_FINDINGS.map((f) => ({ ...f }));
}

export function getDemoCollections() {
  return [
    { id: "demo-col-1", name: "Production APIs", isShared: true },
    { id: "demo-col-2", name: "User Service", isShared: false },
    { id: "demo-col-3", name: "Public API", isShared: true },
    { id: "demo-col-4", name: "Admin Panel", isShared: false },
  ];
}

export async function runDemoScenarios(): Promise<void> {
  const scenarios: DemoScenario[] = [
    {
      name: "🔍 Instant Security Scan",
      description: "Shows how Rakshex detects vulnerabilities in seconds",
      run: async () => {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Rakshex Demo: Running security scan...",
            cancellable: false,
          },
          async (progress) => {
            progress.report({ increment: 30, message: "Analyzing collection structure..." });
            await sleep(800);
            progress.report({ increment: 40, message: "Detecting secrets and auth issues..." });
            await sleep(1000);
            progress.report({ increment: 30, message: "Complete! 6 findings detected." });
            await sleep(500);
          },
        );
        void vscode.window.showInformationMessage(
          "🛡️ Rakshex found 6 issues: 1 Critical, 2 High, 2 Medium, 1 Low",
        );
      },
    },
    {
      name: "💰 Hidden Cost Revelation",
      description: "Reveals thinking tokens that providers hide",
      run: async () => {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Rakshex Demo: Analyzing token costs...",
            cancellable: false,
          },
          async (progress) => {
            progress.report({ increment: 50, message: "Attributing hidden reasoning costs..." });
            await sleep(1200);
            progress.report({ increment: 50, message: "Done! $1,247 hidden costs found." });
            await sleep(500);
          },
        );
        void vscode.window.showWarningMessage(
          "💰 Hidden cost detected: $1,247 in reasoning tokens this week (3.2× visible cost)",
        );
      },
    },
    {
      name: "⚡ AgentGuard Kill Switch",
      description: "Demonstrates autonomous rogue agent detection",
      run: async () => {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Rakshex Demo: Monitoring for rogue agents...",
            cancellable: false,
          },
          async (progress) => {
            progress.report({ increment: 33, message: "Monitoring API call patterns..." });
            await sleep(700);
            progress.report({
              increment: 33,
              message: "Anomaly detected! Infinite loop pattern...",
            });
            await sleep(800);
            progress.report({ increment: 34, message: "Kill switch activated. Agent stopped." });
            await sleep(500);
          },
        );
        void vscode.window.showErrorMessage(
          "🛑 AgentGuard STOPPED a rogue agent after 847 recursive calls ($42.30 saved)",
        );
      },
    },
  ];

  const picked = await vscode.window.showQuickPick(
    scenarios.map((s) => ({ label: s.name, description: s.description, scenario: s })),
    { title: "Rakshex Demo Scenarios", placeHolder: "Pick a scenario to run" },
  );
  if (picked) {
    await picked.scenario.run();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Auto-reset demo state for fresh demo runs.
 */
export async function resetDemoState(): Promise<void> {
  void vscode.window.showInformationMessage("🔄 Demo state reset. Ready for next demo.");
}
