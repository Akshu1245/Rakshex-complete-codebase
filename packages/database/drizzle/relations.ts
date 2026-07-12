import { relations } from "drizzle-orm";
import {
  users,
  vscodeActivities,
  collections,
  scans,
  findings,
  shadowAPIs,
  tokenUsage,
  killSwitchEvents,
  killSwitchSettings,
  complianceReports,
  teamMembers,
  onboardingProgress,
  subscriptions,
  payments,
  passwordResetTokens,
  userSessions,
  emailPreferences,
  auditLog,
  webhookEndpoints,
  webhookDeliveries,
  processedWebhookEvents,
  mcpServers,
  mcpTools,
  mcpInvocationLog,
  gatewayAudit,
  tokenBudgets,
  shadowAiEvents,
  aiAllowlist,
  redteamRuns,
  redteamFindings,
  redteamSchedules,
  autofixSuggestions,
  copilotConversations,
  copilotMessages,
  tenantPolicies,
  alertRules,
  alertEvents,
  ssoProviders,
  ssoLoginRequests,
  workspaces,
  workspaceMembers,
  workspaceInvitations,
  importHistory,
} from "./schema";

// ─── users ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many, one }) => ({
  vscodeActivities: many(vscodeActivities),
  collections: many(collections),
  scans: many(scans),
  findings: many(findings),
  shadowAPIs: many(shadowAPIs),
  tokenUsage: many(tokenUsage),
  killSwitchEvents: many(killSwitchEvents),
  killSwitchSettings: one(killSwitchSettings, {
    fields: [users.id],
    references: [killSwitchSettings.userId],
  }),
  complianceReports: many(complianceReports),
  teamMembersOwned: many(teamMembers, { relationName: "owner" }),
  onboardingProgress: one(onboardingProgress, {
    fields: [users.id],
    references: [onboardingProgress.userId],
  }),
  subscriptions: one(subscriptions, {
    fields: [users.id],
    references: [subscriptions.userId],
  }),
  payments: many(payments),
  passwordResetTokens: many(passwordResetTokens),
  userSessions: many(userSessions),
  emailPreferences: one(emailPreferences, {
    fields: [users.id],
    references: [emailPreferences.userId],
  }),
  auditLog: many(auditLog),
  webhookEndpoints: many(webhookEndpoints),
  mcpServers: many(mcpServers),
  mcpInvocationLog: many(mcpInvocationLog),
  gatewayAudit: many(gatewayAudit),
  tokenBudgets: one(tokenBudgets, {
    fields: [users.id],
    references: [tokenBudgets.userId],
  }),
  shadowAiEvents: many(shadowAiEvents),
  aiAllowlist: many(aiAllowlist),
  redteamRuns: many(redteamRuns),
  autofixSuggestions: many(autofixSuggestions),
  copilotConversations: many(copilotConversations),
  tenantPolicies: many(tenantPolicies),
  alertRules: many(alertRules),
  alertEvents: many(alertEvents),
  ssoProviders: many(ssoProviders),
  ownedWorkspaces: many(workspaces, { relationName: "owner" }),
  workspaceMemberships: many(workspaceMembers),
  sentInvitations: many(workspaceInvitations, { relationName: "inviter" }),
}));

// ─── vscodeActivities ─────────────────────────────────────────────────────

export const vscodeActivitiesRelations = relations(vscodeActivities, ({ one }) => ({
  user: one(users, {
    fields: [vscodeActivities.userId],
    references: [users.id],
  }),
}));

// ─── collections ──────────────────────────────────────────────────────────

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  user: one(users, {
    fields: [collections.userId],
    references: [users.id],
  }),
  scans: many(scans),
  findings: many(findings),
  shadowAPIs: many(shadowAPIs),
  complianceReports: many(complianceReports),
}));

// ─── scans ────────────────────────────────────────────────────────────────

export const scansRelations = relations(scans, ({ one, many }) => ({
  user: one(users, {
    fields: [scans.userId],
    references: [users.id],
  }),
  collection: one(collections, {
    fields: [scans.collectionId],
    references: [collections.id],
  }),
  findings: many(findings),
  shadowAPIs: many(shadowAPIs),
}));

// ─── findings ─────────────────────────────────────────────────────────────

export const findingsRelations = relations(findings, ({ one }) => ({
  user: one(users, {
    fields: [findings.userId],
    references: [users.id],
  }),
  scan: one(scans, {
    fields: [findings.scanId],
    references: [scans.id],
  }),
  collection: one(collections, {
    fields: [findings.collectionId],
    references: [collections.id],
  }),
}));

// ─── shadowAPIs ───────────────────────────────────────────────────────────

export const shadowAPIsRelations = relations(shadowAPIs, ({ one }) => ({
  user: one(users, {
    fields: [shadowAPIs.userId],
    references: [users.id],
  }),
  scan: one(scans, {
    fields: [shadowAPIs.scanId],
    references: [scans.id],
  }),
  collection: one(collections, {
    fields: [shadowAPIs.collectionId],
    references: [collections.id],
  }),
}));

// ─── tokenUsage ───────────────────────────────────────────────────────────

export const tokenUsageRelations = relations(tokenUsage, ({ one }) => ({
  user: one(users, {
    fields: [tokenUsage.userId],
    references: [users.id],
  }),
}));

// ─── killSwitchEvents ─────────────────────────────────────────────────────

export const killSwitchEventsRelations = relations(killSwitchEvents, ({ one }) => ({
  user: one(users, {
    fields: [killSwitchEvents.userId],
    references: [users.id],
  }),
}));

// ─── killSwitchSettings ───────────────────────────────────────────────────

export const killSwitchSettingsRelations = relations(killSwitchSettings, ({ one }) => ({
  user: one(users, {
    fields: [killSwitchSettings.userId],
    references: [users.id],
  }),
}));

// ─── complianceReports ────────────────────────────────────────────────────

export const complianceReportsRelations = relations(complianceReports, ({ one }) => ({
  user: one(users, {
    fields: [complianceReports.userId],
    references: [users.id],
  }),
  collection: one(collections, {
    fields: [complianceReports.collectionId],
    references: [collections.id],
  }),
}));

// ─── teamMembers ──────────────────────────────────────────────────────────

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  owner: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
    relationName: "owner",
  }),
  member: one(users, {
    fields: [teamMembers.memberUserId],
    references: [users.id],
  }),
}));

// ─── onboardingProgress ───────────────────────────────────────────────────

export const onboardingProgressRelations = relations(onboardingProgress, ({ one }) => ({
  user: one(users, {
    fields: [onboardingProgress.userId],
    references: [users.id],
  }),
}));

// ─── subscriptions ────────────────────────────────────────────────────────

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
  payments: many(payments),
}));

// ─── payments ─────────────────────────────────────────────────────────────

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, {
    fields: [payments.userId],
    references: [users.id],
  }),
  subscription: one(subscriptions, {
    fields: [payments.subscriptionId],
    references: [subscriptions.id],
  }),
}));

// ─── passwordResetTokens ──────────────────────────────────────────────────

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}));

// ─── userSessions ─────────────────────────────────────────────────────────

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id],
  }),
}));

// ─── emailPreferences ─────────────────────────────────────────────────────

export const emailPreferencesRelations = relations(emailPreferences, ({ one }) => ({
  user: one(users, {
    fields: [emailPreferences.userId],
    references: [users.id],
  }),
}));

// ─── auditLog ─────────────────────────────────────────────────────────────

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  user: one(users, {
    fields: [auditLog.userId],
    references: [users.id],
  }),
}));

// ─── webhookEndpoints + webhookDeliveries ─────────────────────────────────

export const webhookEndpointsRelations = relations(webhookEndpoints, ({ one, many }) => ({
  user: one(users, {
    fields: [webhookEndpoints.userId],
    references: [users.id],
  }),
  deliveries: many(webhookDeliveries),
}));

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  endpoint: one(webhookEndpoints, {
    fields: [webhookDeliveries.webhookId],
    references: [webhookEndpoints.id],
  }),
}));

// ─── MCP Governance ───────────────────────────────────────────────────────

export const mcpServersRelations = relations(mcpServers, ({ one, many }) => ({
  user: one(users, {
    fields: [mcpServers.userId],
    references: [users.id],
  }),
  tools: many(mcpTools),
  invocations: many(mcpInvocationLog),
}));

export const mcpToolsRelations = relations(mcpTools, ({ one, many }) => ({
  server: one(mcpServers, {
    fields: [mcpTools.serverId],
    references: [mcpServers.id],
  }),
  invocations: many(mcpInvocationLog),
}));

export const mcpInvocationLogRelations = relations(mcpInvocationLog, ({ one }) => ({
  user: one(users, {
    fields: [mcpInvocationLog.userId],
    references: [users.id],
  }),
  server: one(mcpServers, {
    fields: [mcpInvocationLog.serverId],
    references: [mcpServers.id],
  }),
  tool: one(mcpTools, {
    fields: [mcpInvocationLog.toolId],
    references: [mcpTools.id],
  }),
}));

// ─── Gateway Audit ────────────────────────────────────────────────────────

export const gatewayAuditRelations = relations(gatewayAudit, ({ one }) => ({
  user: one(users, {
    fields: [gatewayAudit.userId],
    references: [users.id],
  }),
}));

// ─── Token Budgets ────────────────────────────────────────────────────────

export const tokenBudgetsRelations = relations(tokenBudgets, ({ one }) => ({
  user: one(users, {
    fields: [tokenBudgets.userId],
    references: [users.id],
  }),
}));

// ─── Shadow AI ────────────────────────────────────────────────────────────

export const shadowAiEventsRelations = relations(shadowAiEvents, ({ one }) => ({
  user: one(users, {
    fields: [shadowAiEvents.userId],
    references: [users.id],
  }),
}));

export const aiAllowlistRelations = relations(aiAllowlist, ({ one }) => ({
  user: one(users, {
    fields: [aiAllowlist.userId],
    references: [users.id],
  }),
}));

// ─── Red Team ─────────────────────────────────────────────────────────────

export const redteamRunsRelations = relations(redteamRuns, ({ one, many }) => ({
  user: one(users, {
    fields: [redteamRuns.userId],
    references: [users.id],
  }),
  findings: many(redteamFindings),
}));

export const redteamFindingsRelations = relations(redteamFindings, ({ one }) => ({
  run: one(redteamRuns, {
    fields: [redteamFindings.runId],
    references: [redteamRuns.id],
  }),
}));

// ─── Auto-Fix ─────────────────────────────────────────────────────────────

export const autofixSuggestionsRelations = relations(autofixSuggestions, ({ one }) => ({
  user: one(users, {
    fields: [autofixSuggestions.userId],
    references: [users.id],
  }),
}));

// ─── Security Copilot ─────────────────────────────────────────────────────

export const copilotConversationsRelations = relations(copilotConversations, ({ one, many }) => ({
  user: one(users, {
    fields: [copilotConversations.userId],
    references: [users.id],
  }),
  messages: many(copilotMessages),
}));

export const copilotMessagesRelations = relations(copilotMessages, ({ one }) => ({
  conversation: one(copilotConversations, {
    fields: [copilotMessages.conversationId],
    references: [copilotConversations.id],
  }),
}));

// ─── Tenant Policies ──────────────────────────────────────────────────────

export const tenantPoliciesRelations = relations(tenantPolicies, ({ one }) => ({
  user: one(users, {
    fields: [tenantPolicies.userId],
    references: [users.id],
  }),
}));

// ─── Alert Rules + Events ─────────────────────────────────────────────────

export const alertRulesRelations = relations(alertRules, ({ one, many }) => ({
  user: one(users, {
    fields: [alertRules.userId],
    references: [users.id],
  }),
  events: many(alertEvents),
}));

export const alertEventsRelations = relations(alertEvents, ({ one }) => ({
  user: one(users, {
    fields: [alertEvents.userId],
    references: [users.id],
  }),
  rule: one(alertRules, {
    fields: [alertEvents.ruleId],
    references: [alertRules.id],
  }),
}));

// ─── SSO ──────────────────────────────────────────────────────────────────

export const ssoProvidersRelations = relations(ssoProviders, ({ one, many }) => ({
  user: one(users, {
    fields: [ssoProviders.userId],
    references: [users.id],
  }),
  loginRequests: many(ssoLoginRequests),
}));

export const ssoLoginRequestsRelations = relations(ssoLoginRequests, ({ one }) => ({
  provider: one(ssoProviders, {
    fields: [ssoLoginRequests.providerId],
    references: [ssoProviders.id],
  }),
}));

// ─── Workspaces + RBAC ────────────────────────────────────────────────────

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, {
    fields: [workspaces.ownerUserId],
    references: [users.id],
    relationName: "owner",
  }),
  members: many(workspaceMembers),
  invitations: many(workspaceInvitations),
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMembers.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [workspaceMembers.userId],
    references: [users.id],
  }),
}));

export const workspaceInvitationsRelations = relations(workspaceInvitations, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceInvitations.workspaceId],
    references: [workspaces.id],
  }),
  inviter: one(users, {
    fields: [workspaceInvitations.invitedBy],
    references: [users.id],
    relationName: "inviter",
  }),
}));

// ─── Import History ────────────────────────────────────────────────────────

export const importHistoryRelations = relations(importHistory, ({ one }) => ({
  user: one(users, {
    fields: [importHistory.userId],
    references: [users.id],
  }),
}));
