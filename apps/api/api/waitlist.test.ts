import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addWaitlistEmail: vi.fn(),
  sendWaitlistConfirmationEmail: vi.fn(),
}));

vi.mock("../db", () => ({ addWaitlistEmail: mocks.addWaitlistEmail }));
vi.mock("../email", () => ({ sendWaitlistConfirmationEmail: mocks.sendWaitlistConfirmationEmail }));

import { generateCsrfToken } from "../utils/security";
import { waitlistRouter } from "./waitlist";

function createCaller() {
  const csrf = generateCsrfToken();
  return waitlistRouter.createCaller({
    req: {
      headers: {
        cookie: `csrf-token=${csrf}`,
        "x-csrf-token": csrf,
      },
      ip: "127.0.0.1",
    },
    res: {},
  } as never);
}

describe("waitlist router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records a request and sends a confirmation for a new email", async () => {
    mocks.addWaitlistEmail.mockResolvedValue({ success: true, alreadyExists: false });
    const caller = createCaller();

    await expect(
      caller.join({ email: "pilot@example.com", plan: "Enterprise" }),
    ).resolves.toMatchObject({
      success: true,
      alreadyExists: false,
      email: "pilot@example.com",
    });
    expect(mocks.sendWaitlistConfirmationEmail).toHaveBeenCalledWith(
      "pilot@example.com",
      "Enterprise",
    );
  });

  it("does not report success when persistence is unavailable", async () => {
    mocks.addWaitlistEmail.mockResolvedValue({ success: false, alreadyExists: false });
    const caller = createCaller();

    await expect(caller.join({ email: "pilot@example.com" })).rejects.toThrow("Unable to record");
  });
});
