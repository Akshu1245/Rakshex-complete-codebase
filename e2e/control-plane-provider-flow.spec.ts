import { expect, test } from "@playwright/test";

type ProviderAccount = {
  id: number;
  provider: "openai";
  accountType: "gateway_inference" | "admin_telemetry";
  connectionStatus: "gateway_enforced" | "admin_authorized";
  syncStatus: "healthy" | "not_connected";
};

function trpcResult(data: unknown) {
  return { result: { data: { json: data } } };
}

test.describe("Provider control plane browser journey", () => {
  test.beforeEach(async ({ page }) => {
    let gatewayConnected = false;
    let administrationConnected = false;
    let budgetEnabled = false;
    let routedTrafficStopped = false;
    const evidence: Array<{ id: number; eventType: string; createdAt: string }> = [];

    await page.addInitScript(() => {
      window.localStorage.setItem(
        "rakshex.cookieConsent.v1",
        JSON.stringify({ choice: "accepted", at: new Date().toISOString() }),
      );
    });

    await page.context().addCookies([
      {
        name: "access_token",
        value: "test-session-provider-control",
        url: "http://localhost:3001",
      },
    ]);

    // The browser uses the real Next.js route and form interactions. Provider
    // requests are intentionally mocked: customer credentials and external
    // provider administration APIs are not used in CI.
    await page.route("**/api/trpc/**", async (route) => {
      const accounts: ProviderAccount[] = [
        ...(gatewayConnected
          ? [
              {
                id: 91,
                provider: "openai" as const,
                accountType: "gateway_inference" as const,
                connectionStatus: "gateway_enforced" as const,
                syncStatus: "healthy" as const,
              },
            ]
          : []),
        ...(administrationConnected
          ? [
              {
                id: 92,
                provider: "openai" as const,
                accountType: "admin_telemetry" as const,
                connectionStatus: "admin_authorized" as const,
                syncStatus: "not_connected" as const,
              },
            ]
          : []),
      ];

      const responseFor = (path: string): unknown => {
        if (path === "auth.me") {
          return { id: 7, email: "operator@example.test", name: "CI Operator", plan: "pro" };
        }
        if (path === "workspaces.listMine") return [{ id: 12, name: "Acme" }];
        if (path === "controlPlane.providers.catalog") {
          return [
            {
              id: "openai",
              name: "OpenAI",
              category: "api",
              capabilities: { promptGateway: true, discoverUsage: true },
            },
          ];
        }
        if (path === "controlPlane.summary") {
          return {
            providers: accounts.length,
            credentials: accounts.length,
            openFindings: 0,
            subscriptions: 0,
          };
        }
        if (path === "controlPlane.providers.accounts") return accounts;
        if (path === "controlPlane.discovery.list") return [];
        if (path === "controlPlane.subscriptions.list") return [];
        if (path === "controlPlane.resources.list") return [];
        if (path === "controlPlane.credentials.list") return [];
        if (path === "controlPlane.usage.summary") {
          return { totalCostUsd: 0, totalRequests: 0, byUser: [] };
        }
        if (path === "teamGovernance.listBudgets") {
          return budgetEnabled
            ? [
                {
                  id: 31,
                  identityId: null,
                  enforcementMode: "gateway",
                  hardLimit: true,
                  limitUsd: 25,
                  currentSpendUsd: 0,
                },
              ]
            : [];
        }
        if (path === "teamGovernance.listKillSwitches") {
          return routedTrafficStopped
            ? [{ id: 41, scopeType: "workspace", scopeId: "12", active: true }]
            : [];
        }
        if (path === "controlPlane.recentEvidence") return evidence;

        if (path === "controlPlane.providers.connectOpenAiAdministration") {
          administrationConnected = true;
          evidence.push({
            id: 1,
            eventType: "openai_administration_connected",
            createdAt: new Date().toISOString(),
          });
          return { organizationId: "org_ci_authorized" };
        }
        if (path === "controlPlane.providers.connectOpenAiGateway") {
          gatewayConnected = true;
          evidence.push({
            id: 2,
            eventType: "openai_gateway_connected",
            createdAt: new Date().toISOString(),
          });
          return { gatewayPath: "/v1/chat/completions" };
        }
        if (path === "teamGovernance.setBudget") {
          budgetEnabled = true;
          evidence.push({
            id: 3,
            eventType: "team_governance_budget_set",
            createdAt: new Date().toISOString(),
          });
          return { success: true };
        }
        if (path === "teamGovernance.setKillSwitch") {
          routedTrafficStopped = true;
          evidence.push({
            id: 4,
            eventType: "team_governance_kill_switch_set",
            createdAt: new Date().toISOString(),
          });
          return { note: "Blocked at gateway for routed traffic" };
        }
        if (path === "teamGovernance.syncProvider") {
          return { status: "success", seatsSynced: 2, usageEventsSynced: 3 };
        }

        return {};
      };

      const procedurePath = new URL(route.request().url()).pathname
        .split("/api/trpc/")
        .at(-1)
        ?.split(",")
        .filter(Boolean);
      const results = (procedurePath ?? []).map((path) => trpcResult(responseFor(path)));
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(results),
      });
    });
  });

  test("authorizes administration, connects the gateway, sets a hard budget, and stops routed traffic", async ({
    page,
  }) => {
    const administrationKey = "ci-admin-key-not-a-real-provider-secret";
    const inferenceKey = "ci-inference-key-not-a-real-provider-secret";

    await page.goto("/control-plane");
    await expect(
      page.getByRole("heading", { name: "Everything your team uses to build with AI" }),
    ).toBeVisible();

    await page.getByLabel("OpenAI Admin API key").fill(administrationKey);
    await page.getByRole("button", { name: "Authorize telemetry" }).click();
    await expect(page.getByRole("status")).toContainText(
      "OpenAI organization org_ci_authorized is authorized for administration telemetry",
    );

    await page.getByLabel("OpenAI inference key").fill(inferenceKey);
    await page.getByRole("button", { name: "Connect enforced gateway" }).click();
    await expect(page.getByText("OpenAI gateway connected", { exact: true })).toBeVisible();
    await expect(page.getByRole("status")).toContainText(
      "Route application calls through /v1/chat/completions",
    );
    await expect(page.locator("main")).not.toContainText(administrationKey);
    await expect(page.locator("main")).not.toContainText(inferenceKey);

    await page.getByLabel("Monthly limit in USD").fill("25");
    await page.getByRole("button", { name: "Enforce this budget" }).click();
    await expect(page.getByRole("status")).toContainText(
      "Hard gateway budget saved. RaksHex reserves the next routed request before provider execution.",
    );
    await expect(page.getByText("Active: $25 limit · $0 used")).toBeVisible();

    await page.getByRole("button", { name: "Stop routed traffic now" }).click();
    await expect(page.getByRole("status")).toContainText("Blocked at gateway for routed traffic");
    await expect(page.getByRole("button", { name: "Restore routed traffic" })).toBeVisible();
    await expect(
      page.getByText(
        "The workspace kill switch is active. RaksHex rejects new routed requests before they reach the provider.",
      ),
    ).toBeVisible();
  });

  for (const viewport of [
    { name: "desktop", width: 1440, height: 960 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    test(`keeps the provider control plane usable at ${viewport.name} viewport`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("/control-plane");

      await expect(
        page.getByRole("heading", { name: "Everything your team uses to build with AI" }),
      ).toBeVisible();
      await expect(page.getByLabel("OpenAI inference key")).toBeVisible();
      await expect(page.getByLabel("Monthly limit in USD")).toBeVisible();
      await expect(page.getByRole("button", { name: "Stop routed traffic now" })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      ).toBeTruthy();
    });
  }
});
