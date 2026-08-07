import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateCsrfToken } from "../utils/security";

const mocks = vi.hoisted(() => ({
  requireWorkspacePermission: vi.fn(),
  createWebhookEndpoint: vi.fn(),
  listWebhookEndpointsByWorkspaceId: vi.fn(),
  getWebhookEndpointByWorkspaceId: vi.fn(),
  deliverToWorkspace: vi.fn(),
}));

vi.mock("../services/authorization", () => ({
  requireWorkspacePermission: mocks.requireWorkspacePermission,
}));

vi.mock("../db", () => ({
  createWebhookEndpoint: mocks.createWebhookEndpoint,
  listWebhookEndpointsByWorkspaceId: mocks.listWebhookEndpointsByWorkspaceId,
  getWebhookEndpointByWorkspaceId: mocks.getWebhookEndpointByWorkspaceId,
}));

vi.mock("../services/webhookDelivery", () => ({
  deliverToWorkspace: mocks.deliverToWorkspace,
  buildSignature: vi.fn(),
}));

import { webhooksRouter } from "./webhooks";

function context() {
  const csrfToken = generateCsrfToken();
  return {
    user: { id: 7 },
    req: {
      headers: {
        cookie: `csrf-token=${csrfToken}`,
        "x-csrf-token": csrfToken,
      },
      protocol: "https",
    },
    res: { clearCookie: () => undefined },
  } as never;
}

describe("workspace webhook isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireWorkspacePermission.mockResolvedValue("admin");
    mocks.createWebhookEndpoint.mockResolvedValue({ id: "wh_1" });
    mocks.listWebhookEndpointsByWorkspaceId.mockResolvedValue([]);
  });

  it("stores new endpoints with the authorized workspace", async () => {
    const caller = webhooksRouter.createCaller(context());
    await caller.register({
      workspaceId: 42,
      url: "https://hooks.example.com/rakshex",
      events: ["scan.complete"],
    });

    expect(mocks.requireWorkspacePermission).toHaveBeenCalledWith(42, 7, "webhooks", "write");
    expect(mocks.createWebhookEndpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        workspaceId: 42,
        url: "https://hooks.example.com/rakshex",
      }),
    );
  });

  it("lists endpoints only through a workspace-scoped query", async () => {
    const caller = webhooksRouter.createCaller(context());
    await caller.list({ workspaceId: 42 });

    expect(mocks.requireWorkspacePermission).toHaveBeenCalledWith(42, 7, "webhooks", "read");
    expect(mocks.listWebhookEndpointsByWorkspaceId).toHaveBeenCalledWith(42);
  });
});
