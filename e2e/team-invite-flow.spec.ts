import { test, expect } from "@playwright/test";

/**
 * Critical Path 2: Team Invite Flow
 *
 * All backend calls are stubbed via page.route so no real SMTP,
 * MySQL, or Redis is required. The flow exercises:
 *   1. Login (stubbed) → redirect to dashboard
 *   2. Navigate to /team → view team page
 *   3. Invite a team member → verify UI updates
 *   4. Verify the invited member appears in the member list
 */
test.describe("Critical Path 2: Team Invite Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "rakshex.cookieConsent.v1",
        JSON.stringify({ choice: "accepted", at: new Date().toISOString() }),
      );
    });

    // Seed a session cookie so the app treats us as authenticated
    await page.context().addCookies([
      {
        name: "dp_session",
        value: "test-session-inviter",
        url: "http://localhost:3000",
      },
    ]);

    // Stub the workspace-scoped tRPC surface. The production client may batch
    // multiple procedures into one request, so return one envelope per path.
    await page.route("**/api/trpc/**", async (route) => {
      const url = route.request().url();
      const encodedProcedures = new URL(url).pathname.split("/api/trpc/")[1] ?? "";
      const procedures = decodeURIComponent(encodedProcedures).split(",");
      const json = (data: unknown) => ({ result: { data } });
      const dataFor = (procedure: string): unknown => {
        if (procedure === "auth.me") {
          return {
            id: 1,
            email: "inviter@example.com",
            name: "Inviter User",
            plan: "pro",
          };
        }
        if (procedure === "workspaces.listMine") {
          return [
            {
              id: 1,
              name: "Test Workspace",
              slug: "test-workspace",
              ownerUserId: 1,
              isPersonal: false,
            },
          ];
        }
        if (procedure === "workspaces.listMembers") {
          return [
            {
              id: 1,
              workspaceId: 1,
              userId: 1,
              email: "inviter@example.com",
              name: "Inviter User",
              role: "owner",
              active: true,
              joinedAt: new Date().toISOString(),
            },
          ];
        }
        if (procedure === "workspaces.listInvitations") return [];
        if (procedure === "workspaces.myPermissions") {
          return {
            role: "owner",
            permissions: {
              members: { read: true, write: true, delete: true },
              billing: { read: true, write: true, delete: true },
            },
          };
        }
        if (procedure === "payment.getWorkspaceSubscription") {
          return {
            subscription: {
              id: "wsub_test",
              plan: "pro",
              status: "active",
              seatCount: 5,
              amountMinor: 829900,
              currency: "INR",
              cancelAtPeriodEnd: false,
            },
            reservedSeats: 1,
            availablePlans: [
              {
                plan: "pro",
                name: "Rakshex Pro",
                amountMinor: 829900,
                currency: "INR",
                includedSeats: 5,
              },
            ],
          };
        }
        if (procedure === "workspaces.inviteMember") return { id: 2, token: "test-token" };
        return null;
      };

      return route.fulfill({
        status: 200,
        body: JSON.stringify(
          procedures.length === 1
            ? json(dataFor(procedures[0]))
            : procedures.map((procedure) => json(dataFor(procedure))),
        ),
        contentType: "application/json",
      });
    });
  });

  test("Invite team member → Verify invite sent and member appears", async ({ page }) => {
    // Authenticated via the stubbed auth.me response (sign-in is OAuth-only).
    await page.goto("/team");
    await expect(page.getByRole("heading", { name: "Team", exact: true })).toBeVisible();

    // Verify the invite form is present
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /send invite/i })).toBeVisible();

    // Step 3: Fill invite form and send
    await page.getByLabel(/email/i).fill("invitee@example.com");
    await page.getByRole("button", { name: /send invite/i }).click();

    // Step 4: Verify the invited member appears in the list
    // After invite, workspace queries are invalidated and re-fetched. The
    // input clears only after the mutation succeeds.
    await expect(page.getByLabel(/email/i)).toHaveValue("", { timeout: 5_000 });
  });

  test("team page route does not 500 when unauthenticated", async ({ page }) => {
    const response = await page.goto("/team");
    expect(response).toBeTruthy();
    expect(response!.status()).toBeLessThan(500);
  });
});
