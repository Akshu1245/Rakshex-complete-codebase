"use client";
import { useState, useCallback } from "react";
import { WorkspaceProvider, useEnterpriseWorkspace } from "./WorkspaceContext";
import { OverviewTab } from "./OverviewTab";
import { KeyInventoryTab } from "./KeyInventoryTab";
import { SecurityRisksTab } from "./SecurityRisksTab";
import { CopilotGovernanceTab } from "./CopilotGovernanceTab";
import { AzureConnectionsTab } from "./AzureConnectionsTab";
import { AgentGuardTab } from "./AgentGuardTab";
import { ComplianceTab } from "./ComplianceTab";
import { OnboardingWizard } from "./OnboardingWizard";

const tabs = [
  { id: "overview", label: "Overview", icon: "dashboard" },
  { id: "keys", label: "Key Inventory", icon: "vpn_key" },
  { id: "security", label: "Security Risks", icon: "gpp_bad" },
  { id: "copilot", label: "Copilot Governance", icon: "smart_toy" },
  { id: "azure", label: "Azure Connections", icon: "cloud" },
  { id: "agentguard", label: "AgentGuard", icon: "security" },
  { id: "compliance", label: "Compliance", icon: "verified" },
];

function DashboardInner() {
  const { workspaceId, workspaceName, isLoading } = useEnterpriseWorkspace();
  const [activeTab, setActiveTab] = useState("overview");
  const [showOnboarding, setShowOnboarding] = useState(true);

  const renderTab = useCallback(() => {
    switch (activeTab) {
      case "overview":
        return <OverviewTab />;
      case "keys":
        return <KeyInventoryTab />;
      case "security":
        return <SecurityRisksTab />;
      case "copilot":
        return <CopilotGovernanceTab />;
      case "azure":
        return <AzureConnectionsTab />;
      case "agentguard":
        return <AgentGuardTab />;
      case "compliance":
        return <ComplianceTab />;
      default:
        return <OverviewTab />;
    }
  }, [activeTab]);

  return (
    <div className="space-y-6">
      {/* Header with Workspace ID */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#14b8a6]/15 border border-[#14b8a6]/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-[#14b8a6] text-xl">apartment</span>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">Rakshex Enterprise</h1>
              <span className="px-2 py-0.5 bg-[#14b8a6]/10 border border-[#14b8a6]/30 rounded text-[#14b8a6] text-xs font-mono">
                WS-{workspaceId}
              </span>
            </div>
            <p className="text-gray-500 text-sm">API key & identity governance · {workspaceName}</p>
          </div>
        </div>
        {isLoading && (
          <div className="w-5 h-5 border-2 border-[#14b8a6] border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* Onboarding */}
      {showOnboarding && (
        <OnboardingWizard
          onComplete={() => setShowOnboarding(false)}
          onDismiss={() => setShowOnboarding(false)}
        />
      )}

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-white/5 overflow-x-auto pb-0.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            data-tab={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all
              ${
                activeTab === tab.id
                  ? "text-[#14b8a6] border-[#14b8a6] bg-[#14b8a6]/5"
                  : "text-gray-400 border-transparent hover:text-white hover:border-white/20"
              }`}
          >
            <span className="material-symbols-outlined text-lg">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {renderTab()}
    </div>
  );
}

export function EnterpriseDashboard() {
  return (
    <WorkspaceProvider>
      <DashboardInner />
    </WorkspaceProvider>
  );
}
