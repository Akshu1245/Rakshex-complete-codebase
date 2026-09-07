import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  sendWaitlistConfirmationEmail: vi.fn(),
}));

vi.mock("../db", () => ({ getDb: mocks.getDb }));
vi.mock("../email", () => ({ sendWaitlistConfirmationEmail: mocks.sendWaitlistConfirmationEmail }));

import { waitlistRouter } from "./waitlist";

function createCaller() {
  return waitlistRouter.createCaller({
    req: { headers: { "x-api-key": "test" }, ip: "127.0.0.1" },
    res: {},
  } as never);
}

describe("waitlist router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insert.mockReturnValue({ values: mocks.values });
    mocks.getDb.mockResolvedValue({ insert: mocks.insert });
  });

  it("records a normalized request and sends a confirmation for a new email", async () => {
    mocks.values.mockResolvedValue(undefined);
    const caller = createCaller();

    await expect(
      caller.join({ email: " Pilot@Example.com ", plan: "Enterprise" }),
    ).resolves.toMatchObject({
      success: true,
      alreadyExists: false,
      email: "pilot@example.com",
    });
    expect(mocks.values).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "pilot@example.com",
        plan: "Enterprise",
        source: "landing_page",
      }),
    );
    expect(mocks.sendWaitlistConfirmationEmail).toHaveBeenCalledWith(
      "pilot@example.com",
      "Enterprise",
    );
  });

  it("treats a PostgreSQL unique violation as an idempotent duplicate join", async () => {
    mocks.values.mockRejectedValue(Object.assign(new Error("duplicate key"), { code: "23505" }));
    const caller = createCaller();

    await expect(caller.join({ email: "pilot@example.com" })).resolves.toMatchObject({
      success: true,
      alreadyExists: true,
      email: "pilot@example.com",
    });
    expect(mocks.sendWaitlistConfirmationEmail).not.toHaveBeenCalled();
  });

  it("does not report success when persistence is unavailable", async () => {
    mocks.getDb.mockResolvedValue(null);
    const caller = createCaller();

    await expect(caller.join({ email: "pilot@example.com" })).rejects.toThrow("Unable to record");
  });
});
