import { afterEach, describe, expect, it, vi } from "vitest";
import { createCursorAdapter } from "./cursor";

describe("Cursor governance adapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("syncs members and current-cycle overall spend without double-count IDs", async () => {
    const cycleStart = Date.UTC(2026, 6, 1);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            teamMembers: [
              {
                id: "user_1",
                email: "dev@acme.example",
                name: "Dev",
                role: "member",
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            teamMemberSpend: [
              {
                userId: "user_1",
                email: "dev@acme.example",
                spendCents: 125,
                overallSpendCents: 2_450.5,
                fastPremiumRequests: 80,
                monthlyLimitDollars: 100,
                effectivePerUserLimitDollars: 100,
              },
            ],
            subscriptionCycleStart: cycleStart,
            totalPages: 1,
          }),
          { status: 200 },
        ),
      );

    const result = await createCursorAdapter().sync({
      workspaceId: 1,
      adminCredential: "cursor-team-key",
    });

    expect(result.status).toBe("success");
    if (result.status !== "success" && result.status !== "partial") return;
    expect(result.seats[0]?.externalUserId).toBe("user_1");
    expect(result.usageEvents[0]).toMatchObject({
      externalUserId: "user_1",
      costUsd: 24.505,
      requestCount: 80,
    });
    expect(result.usageEvents[0]?.externalEventId).toBe("cursor:spend:user_1:2026-07-01");
    const spendRequest = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(String(spendRequest.body))).toEqual({
      page: 1,
      pageSize: 500,
    });
  });

  it("sets the documented email-based integer spend limit", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    const result = await createCursorAdapter().setUserSpendLimit!(
      { workspaceId: 1, adminCredential: "cursor-team-key" },
      "user_1",
      25.2,
      "dev@acme.example",
    );

    expect(result).toEqual({ ok: true, mode: "provider_native" });
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      userEmail: "dev@acme.example",
      spendLimitDollars: 26,
    });
  });

  it("refuses provider-native limits when identity email is unresolved", async () => {
    const result = await createCursorAdapter().setUserSpendLimit!(
      { workspaceId: 1, adminCredential: "cursor-team-key" },
      "user_1",
      25,
    );

    expect(result).toMatchObject({
      ok: false,
      errorCode: "IDENTITY_EMAIL_REQUIRED",
    });
  });
});
