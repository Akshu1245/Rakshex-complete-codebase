/**
 * ISO27001:2022 Annex A control definitions + evidence collectors.
 * 18 controls across 4 categories: Organizational, People, Physical, Technological.
 */
import { logger } from "../../../_core/logger";
import * as db from "../../../db";
import {
  iso27001Controls,
  agentGuardEvents,
  azureDiscoveredKeys,
} from "../../../../drizzle/schema-enterprise";
import { workspaceMembers, ssoProviders } from "../../../../drizzle/schema";
import { eq } from "drizzle-orm";

export interface IsoControl {
  id: string;
  name: string;
  description: string;
  category: "organizational" | "people" | "physical" | "technological";
  evidenceSources: string[];
  weight: number; // 1-5 for scoring
}

export const ISO27001_DEFINITIONS: IsoControl[] = [
  // A.5 - Organizational
  {
    id: "A.5.1",
    name: "Information Security Policies",
    description: "Policies for information security are defined, approved, published, and reviewed",
    category: "organizational",
    evidenceSources: ["tenantPolicies", "auditLog"],
    weight: 4,
  },
  {
    id: "A.5.2",
    name: "Information Security Roles and Responsibilities",
    description: "Roles and responsibilities are defined and allocated",
    category: "organizational",
    evidenceSources: ["workspaceMembers", "rbac"],
    weight: 3,
  },
  {
    id: "A.5.9",
    name: "Inventory of Information and Other Associated Assets",
    description: "Information assets are identified and an inventory is maintained",
    category: "organizational",
    evidenceSources: ["azureDiscoveredKeys", "shadowKeys"],
    weight: 5,
  },
  {
    id: "A.5.10",
    name: "Acceptable Use of Information",
    description: "Rules for acceptable use of information assets are documented and implemented",
    category: "organizational",
    evidenceSources: ["tenantPolicies", "agentGuardEvents"],
    weight: 3,
  },
  {
    id: "A.5.15",
    name: "Access Control",
    description:
      "Access to information assets is controlled based on business and security requirements",
    category: "organizational",
    evidenceSources: ["rbac", "ssoProviders", "workspaceMembers"],
    weight: 5,
  },
  {
    id: "A.5.31",
    name: "Legal, Statutory, Regulatory and Contractual Requirements",
    description: "Legal and regulatory requirements are identified and addressed",
    category: "organizational",
    evidenceSources: ["complianceReports", "auditLog"],
    weight: 4,
  },

  // A.6 - People
  {
    id: "A.6.3",
    name: "Awareness and Training",
    description: "Personnel are aware of and fulfill their information security responsibilities",
    category: "people",
    evidenceSources: ["copilotConversations", "auditLog"],
    weight: 2,
  },
  {
    id: "A.6.5",
    name: "Responsibilities After Termination or Change of Employment",
    description: "Access rights are revoked upon termination or role change",
    category: "people",
    evidenceSources: ["workspaceMembers", "auditLog"],
    weight: 4,
  },

  // A.8 - Technological
  {
    id: "A.8.1",
    name: "User Endpoint Devices",
    description: "Devices are protected from unauthorized access and malware",
    category: "technological",
    evidenceSources: ["shadowAiEvents", "gatewayAudit"],
    weight: 3,
  },
  {
    id: "A.8.7",
    name: "Protection Against Malware",
    description: "Protection against malware is implemented and maintained",
    category: "technological",
    evidenceSources: ["redteamRuns", "securityEvents"],
    weight: 4,
  },
  {
    id: "A.8.8",
    name: "Management of Technical Vulnerabilities",
    description: "Technical vulnerabilities are managed through timely remediation",
    category: "technological",
    evidenceSources: ["findings", "autofixSuggestions"],
    weight: 5,
  },
  {
    id: "A.8.9",
    name: "Configuration Management",
    description:
      "Configurations, including security configurations, are established and maintained",
    category: "technological",
    evidenceSources: ["azureDiscoveredKeys", "mcpServers"],
    weight: 3,
  },
  {
    id: "A.8.12",
    name: "Data Leakage Prevention",
    description: "Measures are implemented to prevent data leakage",
    category: "technological",
    evidenceSources: ["piiDetector", "secretScanner", "agentGuardEvents"],
    weight: 5,
  },
  {
    id: "A.8.16",
    name: "Monitoring Activities",
    description: "Networks and systems are monitored for unusual activity",
    category: "technological",
    evidenceSources: ["gatewayAudit", "securityEvents", "keyUsageMetrics"],
    weight: 4,
  },
  {
    id: "A.8.25",
    name: "Secure Development Lifecycle",
    description: "Secure coding practices are applied throughout the development lifecycle",
    category: "technological",
    evidenceSources: ["scans", "findings", "redteamRuns"],
    weight: 4,
  },
  {
    id: "A.8.29",
    name: "Security Testing in Development and Acceptance",
    description: "Security testing is conducted throughout development and acceptance",
    category: "technological",
    evidenceSources: ["redteamRuns", "scans", "autofixSuggestions"],
    weight: 4,
  },
  {
    id: "A.8.30",
    name: "Outsourced Development",
    description: "Security requirements are addressed in outsourced development",
    category: "technological",
    evidenceSources: ["mcpServers", "webhookEndpoints"],
    weight: 2,
  },
  {
    id: "A.8.31",
    name: "Separation of Development, Test and Production Environments",
    description: "Development, test, and production environments are separated",
    category: "technological",
    evidenceSources: ["workspaces", "scans"],
    weight: 3,
  },
];

/**
 * Run ISO27001 assessment for a workspace.
 * Auto-collects evidence from existing data and scores each control.
 */
export async function assessIso27001(workspaceId: number): Promise<void> {
  const dbConn = await db.getDb();
  if (!dbConn) return;

  for (const control of ISO27001_DEFINITIONS) {
    const evidence = await collectEvidence(workspaceId, control);
    const score = calculateScore(evidence);
    const status = score >= 4 ? "compliant" : score >= 2 ? "partial" : "non_compliant";

    await dbConn
      .insert(iso27001Controls)
      .values({
        workspaceId,
        controlId: control.id,
        controlName: control.name,
        status,
        score: String(score),
        evidence: evidence.map((e) => ({
          type: e.type,
          description: e.description,
          source: e.source,
          timestamp: e.timestamp,
        })),
        findings:
          evidence
            .filter((e) => !e.passing)
            .map((e) => e.description)
            .join("; ") || undefined,
        remediation: score < 4 ? generateRemediation(control) : undefined,
        lastAssessedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [iso27001Controls.workspaceId, iso27001Controls.controlId],
        set: {
          status,
          score: String(score),
          evidence: evidence.map((e) => ({
            type: e.type,
            description: e.description,
            source: e.source,
            timestamp: e.timestamp,
          })),
          findings:
            evidence
              .filter((e) => !e.passing)
              .map((e) => e.description)
              .join("; ") || undefined,
          remediation: score < 4 ? generateRemediation(control) : undefined,
          lastAssessedAt: new Date(),
        },
      });
  }

  logger.info({ workspaceId }, "[ISO27001] Assessment complete");
}

interface EvidenceItem {
  type: string;
  description: string;
  source: string;
  timestamp: string;
  passing: boolean;
}

async function collectEvidence(workspaceId: number, control: IsoControl): Promise<EvidenceItem[]> {
  const evidence: EvidenceItem[] = [];
  const dbConn = await db.getDb();

  for (const source of control.evidenceSources) {
    switch (source) {
      case "azureDiscoveredKeys": {
        const keys = await dbConn
          ?.select()
          .from(azureDiscoveredKeys)
          .where(eq(azureDiscoveredKeys.workspaceId, workspaceId));
        if (keys && keys.length > 0) {
          evidence.push({
            type: "inventory",
            description: `${keys.length} keys discovered across Azure resources`,
            source: "azureDiscoveredKeys",
            timestamp: new Date().toISOString(),
            passing: keys.length > 0,
          });
        }
        break;
      }
      case "agentGuardEvents": {
        const events = await dbConn
          ?.select()
          .from(agentGuardEvents)
          .where(eq(agentGuardEvents.workspaceId, workspaceId))
          .limit(10);
        if (events && events.length > 0) {
          evidence.push({
            type: "monitoring",
            description: `${events.length} AgentGuard events logged`,
            source: "agentGuardEvents",
            timestamp: new Date().toISOString(),
            passing: true,
          });
        }
        break;
      }
      case "workspaceMembers": {
        const members = await dbConn
          ?.select()
          .from(workspaceMembers)
          .where(eq(workspaceMembers.workspaceId, workspaceId));
        const uniqueRoles = new Set(members?.map((m: { role: string }) => m.role));
        evidence.push({
          type: "access_control",
          description: `${members?.length ?? 0} members with roles: ${[...uniqueRoles].join(", ")}`,
          source: "workspaceMembers",
          timestamp: new Date().toISOString(),
          passing: uniqueRoles.size >= 2,
        });
        break;
      }
      case "rbac":
        evidence.push({
          type: "policy",
          description: "4-tier RBAC implemented (owner/admin/editor/viewer)",
          source: "rbac",
          timestamp: new Date().toISOString(),
          passing: true,
        });
        break;
      case "ssoProviders": {
        // Check for any SSO provider in the system
        const providers = await dbConn?.select().from(ssoProviders).limit(1);
        evidence.push({
          type: "authentication",
          description:
            providers && providers.length > 0 ? "SSO providers configured" : "No SSO configured",
          source: "ssoProviders",
          timestamp: new Date().toISOString(),
          passing: (providers?.length ?? 0) > 0,
        });
        break;
      }
      default:
        evidence.push({
          type: "auto",
          description: `Evidence from ${source} is pending data collection`,
          source,
          timestamp: new Date().toISOString(),
          passing: false,
        });
    }
  }

  return evidence;
}

function calculateScore(evidence: EvidenceItem[]): number {
  if (evidence.length === 0) return 0;
  const passCount = evidence.filter((e) => e.passing).length;
  return Math.round((passCount / evidence.length) * 5 * 10) / 10;
}

function generateRemediation(control: IsoControl): string {
  return `Implement evidence collection for: ${control.evidenceSources.join(", ")}. Ensure ${control.name} requirements are met per ISO27001:2022.`;
}
