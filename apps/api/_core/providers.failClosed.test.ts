import { describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({
  getKillSwitchSettings: vi.fn().mockRejectedValue(new Error("database unavailable")),
}));

describe("legacy provider dispatch safety state", () => {
  it("fails closed before provider selection when a user kill switch lookup is unavailable", async () => {
    const { routeLLM } = await import("./providers");

    await expect(
      routeLLM({
        userId: 42,
        provider: "not-reached",
        messages: [{ role: "user", content: "test" }],
      } as never),
    ).rejects.toMatchObject({
      message:
        "LLM execution is unavailable because the Rakshex safety state could not be verified.",
    });
  });
});
