import { afterEach, describe, expect, it, vi } from "vitest";
import { createCopilotAdapter } from "./copilot";

describe("GitHub Copilot governance adapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("syncs seats and the official signed per-user NDJSON report", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            seats: [
              {
                assignee: { login: "octocat", name: "Octo Cat", id: 123 },
                assigned_at: "2026-07-01T00:00:00Z",
                plan_type: "business",
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            download_links: ["https://reports.github.example/users.ndjson"],
            report_start_day: "2026-06-23",
            report_end_day: "2026-07-20",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          `${JSON.stringify({
            user_id: 123,
            user_login: "octocat",
            ai_credits_used: 14,
            used_chat: true,
            used_code_completions: true,
            ai_adoption_phase: "engaged",
          })}\n`,
          { status: 200 },
        ),
      );

    const result = await createCopilotAdapter().sync({
      workspaceId: 1,
      adminCredential: "github-admin-token",
      orgName: "acme",
    });

    expect(result.status).toBe("success");
    if (result.status !== "success" && result.status !== "partial") return;
    expect(result.seats[0]).toMatchObject({
      externalUserId: "octocat",
      displayName: "Octo Cat",
    });
    expect(result.usageEvents[0]).toMatchObject({
      externalUserId: "octocat",
      requestCount: 14,
      costUsd: 0,
      product: "github_copilot",
    });
    expect(result.usageEvents[0]?.externalEventId).toContain("2026-06-23:2026-07-20");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("reports API failures instead of converting them into empty success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 }),
    );

    const result = await createCopilotAdapter().sync({
      workspaceId: 1,
      adminCredential: "bad-token",
      orgName: "acme",
    });

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.errorMessage).toContain("403");
    }
  });
});
