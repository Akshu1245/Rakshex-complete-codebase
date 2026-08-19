import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  connectAdmin: vi.fn(),
  connectGateway: vi.fn(),
  connectOpenRouterGateway: vi.fn(),
  createAccount: vi.fn(),
  setBudget: vi.fn(),
  setKillSwitch: vi.fn(),
  syncProvider: vi.fn(),
}));

const refetch = vi.fn();
const query = (data: unknown) => ({ data, isLoading: false, refetch });

vi.mock("@/lib/trpc", () => {
  const gatewayAccount = {
    id: 7,
    provider: "openai",
    accountType: "gateway_inference",
    connectionStatus: "gateway_enforced",
    syncStatus: "healthy",
  };
  const adminAccount = {
    id: 8,
    provider: "openai",
    accountType: "admin_telemetry",
    connectionStatus: "admin_authorized",
    syncStatus: "not_connected",
  };
  return {
    trpc: {
      workspaces: { listMine: { useQuery: () => query([{ id: 12, name: "Acme" }]) } },
      controlPlane: {
        summary: {
          useQuery: () =>
            query({ providers: 2, credentials: 2, openFindings: 0, subscriptions: 0 }),
        },
        recentEvidence: { useQuery: () => query([]) },
        providers: {
          catalog: {
            useQuery: () =>
              query([
                {
                  id: "openai",
                  name: "OpenAI",
                  category: "api",
                  capabilities: { promptGateway: true, discoverUsage: true },
                },
              ]),
          },
          accounts: { useQuery: () => query([gatewayAccount, adminAccount]) },
          upsertAccount: {
            useMutation: () => ({
              isPending: false,
              mutate: (input: unknown, options?: { onSuccess?: () => void }) => {
                mocks.createAccount(input);
                options?.onSuccess?.();
              },
            }),
          },
          connectOpenAiGateway: {
            useMutation: (options: { onSuccess?: (value: unknown) => void }) => ({
              isPending: false,
              mutate: (input: unknown) => {
                mocks.connectGateway(input);
                options.onSuccess?.({ gatewayPath: "/v1/chat/completions" });
              },
            }),
          },
          connectOpenAiAdministration: {
            useMutation: (options: { onSuccess?: (value: unknown) => void }) => ({
              isPending: false,
              mutate: (input: unknown) => {
                mocks.connectAdmin(input);
                options.onSuccess?.({ organizationId: "org_test" });
              },
            }),
          },
          connectOpenRouterGateway: {
            useMutation: (options: { onSuccess?: (value: unknown) => void }) => ({
              isPending: false,
              mutate: (input: unknown) => {
                mocks.connectOpenRouterGateway(input);
                options.onSuccess?.({ gatewayPath: "/v1/chat/completions" });
              },
            }),
          },
        },
        discovery: { list: { useQuery: () => query([]) } },
        subscriptions: {
          list: { useQuery: () => query([]) },
          import: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
        },
        resources: { list: { useQuery: () => query([]) } },
        credentials: { list: { useQuery: () => query([]) } },
        usage: {
          summary: { useQuery: () => query({ totalCostUsd: 0, totalRequests: 0, byUser: [] }) },
        },
      },
      teamGovernance: {
        listBudgets: {
          useQuery: () =>
            query([
              {
                id: 23,
                identityId: null,
                enforcementMode: "gateway",
                hardLimit: true,
                limitUsd: 100,
                currentSpendUsd: 0,
              },
            ]),
        },
        listKillSwitches: { useQuery: () => query([]) },
        syncProvider: {
          useMutation: (options: { onSuccess?: (value: unknown) => void }) => ({
            isPending: false,
            mutate: (input: unknown) => {
              mocks.syncProvider(input);
              options.onSuccess?.({ status: "success", seatsSynced: 2, usageEventsSynced: 3 });
            },
          }),
        },
        setBudget: {
          useMutation: (options: { onSuccess?: () => void }) => ({
            isPending: false,
            mutate: (input: unknown) => {
              mocks.setBudget(input);
              options.onSuccess?.();
            },
          }),
        },
        setKillSwitch: {
          useMutation: (options: { onSuccess?: (value: unknown) => void }) => ({
            isPending: false,
            mutate: (input: unknown) => {
              mocks.setKillSwitch(input);
              options.onSuccess?.({ note: "Blocked at gateway for routed traffic" });
            },
          }),
        },
      },
    },
  };
});

import ControlPlanePage from "./page";

describe("ControlPlane provider setup journey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("allows keyboard activation of provider administration authorization and announces verified status", async () => {
    const user = userEvent.setup();
    render(<ControlPlanePage />);

    const adminKey = screen.getByLabelText("OpenAI Admin API key");
    adminKey.focus();
    expect(adminKey).toHaveFocus();
    await user.type(adminKey, "sk-admin-customer-authorized");
    const authorize = screen.getByRole("button", { name: "Authorize telemetry" });
    authorize.focus();
    expect(authorize).toHaveFocus();
    await act(async () => {
      await user.keyboard("{Enter}");
      await Promise.resolve();
    });

    expect(mocks.connectAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 12,
        credentialName: "OpenAI organization administration Admin API key",
        secret: "sk-admin-customer-authorized",
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "OpenAI organization org_test is authorized for administration telemetry",
    );
  });

  it("supports keyboard driven gateway, hard budget, scoped stop, and provider synchronization actions", async () => {
    const user = userEvent.setup();
    render(<ControlPlanePage />);

    const gatewayKey = screen.getByLabelText("OpenAI inference key");
    gatewayKey.focus();
    await user.type(gatewayKey, "sk-inference-customer-authorized");
    const connectGateway = screen.getByRole("button", { name: "Connect enforced gateway" });
    connectGateway.focus();
    await act(async () => {
      await user.keyboard("{Enter}");
      await Promise.resolve();
    });

    const budget = screen.getByRole("button", { name: "Enforce this budget" });
    budget.focus();
    expect(budget).toHaveFocus();
    await act(async () => {
      await user.keyboard("{Enter}");
      await Promise.resolve();
    });

    const stop = screen.getByRole("button", { name: "Stop routed traffic now" });
    stop.focus();
    await act(async () => {
      await user.keyboard("{Enter}");
      await Promise.resolve();
    });

    const sync = screen.getByRole("button", { name: "Sync OpenAI now" });
    sync.focus();
    await act(async () => {
      await user.keyboard("{Enter}");
      await Promise.resolve();
    });

    expect(mocks.connectGateway).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 12, secret: "sk-inference-customer-authorized" }),
    );
    expect(mocks.setBudget).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 12, hardLimit: true, enforcementMode: "gateway" }),
    );
    expect(mocks.setKillSwitch).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 12, scopeType: "workspace", active: true }),
    );
    expect(mocks.syncProvider).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 12, provider: "openai", providerAccountId: 8 }),
    );
  });

  it("allows keyboard activation of the separate OpenRouter gateway path without exposing the key", async () => {
    const user = userEvent.setup();
    render(<ControlPlanePage />);

    const openRouterKey = screen.getByLabelText("Dedicated OpenRouter key");
    openRouterKey.focus();
    expect(openRouterKey).toHaveFocus();
    await user.type(openRouterKey, "sk-or-customer-authorized");
    const connect = screen.getByRole("button", { name: "Connect OpenRouter gateway" });
    connect.focus();
    await act(async () => {
      await user.keyboard("{Enter}");
      await Promise.resolve();
    });

    expect(mocks.connectOpenRouterGateway).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 12,
        credentialName: "OpenRouter production gateway API key",
        secret: "sk-or-customer-authorized",
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "OpenRouter is connected. Route application calls through /v1/chat/completions",
    );
  });

  it("records an Azure scope as readiness only and announces the customer authorization boundary", async () => {
    const user = userEvent.setup();
    render(<ControlPlanePage />);

    const azureScope = screen.getByLabelText("Azure subscription or resource group");
    azureScope.focus();
    expect(azureScope).toHaveFocus();
    await user.type(azureScope, "Production AI subscription");
    const prepare = screen.getByRole("button", { name: "Prepare Azure scope" });
    prepare.focus();
    await act(async () => {
      await user.keyboard("{Enter}");
      await Promise.resolve();
    });

    expect(mocks.createAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 12,
        provider: "azure_openai",
        accountType: "azure_subscription",
        authMethod: "cloud_role",
        metadata: expect.objectContaining({ connectionState: "awaiting_customer_azure_rbac" }),
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Azure scope recorded. RaksHex remains in readiness mode",
    );
  });
});
