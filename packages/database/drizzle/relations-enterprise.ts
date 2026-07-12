import { relations } from "drizzle-orm";
import {
  azureConnections,
  azureDiscoveredKeys,
  discoveryRuns,
  keyRiskAssessments,
  shadowKeys,
  agentGuardPolicies,
  agentGuardEvents,
  keyRotationRequests,
  iso27001Controls,
  keyUsageMetrics,
  copilotSyncState,
  orgSyncState,
} from "./schema-enterprise";
import { workspaces } from "./schema";

export const azureConnectionsRelations = relations(azureConnections, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [azureConnections.workspaceId],
    references: [workspaces.id],
  }),
}));

export const azureDiscoveredKeysRelations = relations(azureDiscoveredKeys, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [azureDiscoveredKeys.workspaceId],
    references: [workspaces.id],
  }),
}));

export const discoveryRunsRelations = relations(discoveryRuns, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [discoveryRuns.workspaceId],
    references: [workspaces.id],
  }),
}));

export const keyRiskAssessmentsRelations = relations(keyRiskAssessments, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [keyRiskAssessments.workspaceId],
    references: [workspaces.id],
  }),
}));

export const shadowKeysRelations = relations(shadowKeys, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [shadowKeys.workspaceId],
    references: [workspaces.id],
  }),
}));

export const agentGuardPoliciesRelations = relations(agentGuardPolicies, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [agentGuardPolicies.workspaceId],
    references: [workspaces.id],
  }),
}));

export const agentGuardEventsRelations = relations(agentGuardEvents, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [agentGuardEvents.workspaceId],
    references: [workspaces.id],
  }),
}));

export const keyRotationRequestsRelations = relations(keyRotationRequests, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [keyRotationRequests.workspaceId],
    references: [workspaces.id],
  }),
}));

export const iso27001ControlsRelations = relations(iso27001Controls, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [iso27001Controls.workspaceId],
    references: [workspaces.id],
  }),
}));

export const keyUsageMetricsRelations = relations(keyUsageMetrics, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [keyUsageMetrics.workspaceId],
    references: [workspaces.id],
  }),
}));
