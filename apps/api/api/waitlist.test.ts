import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  verify: vi.fn(),
  count: vi.fn(),
  sendVerify: vi.fn(),
  sendVerified: vi.fn(),
}));

vi.mock("../services/waitlistGrowth", () => ({
  registerWaitlistSignup: mocks.register,
  verifyWaitlistEmail: mocks.verify,
  getWaitlistGrowthCount: mocks.count,
}));
vi.mock("../waitlistEmail", () => ({
  sendWaitlistVerificationEmail: mocks.sendVerify,
  sendWaitlistVerifiedEmail: mocks.sendVerified,
}));

import { waitlistRouter } from "./waitlist";

function createCaller() {
  return waitlistRouter.createCaller({
    req: { headers: { "user-agent": "vitest", "x-forwarded-for": "127.0.0.1" }, ip: "127.0.0.1" },
    res: {},
  } as never);
}

describe("waitlist router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.count.mockResolvedValue(0);
  });

  it("accepts personal email addresses and returns an anti-enumeration response", async () => {
    mocks.register.mockResolvedValue({
      accepted: true,
      normalizedEmail: "pilot@gmail.com",
      verificationToken: "token-token-token-token-token-token",
    });
    const caller = createCaller();
    await expect(
      caller.join({ email: "pilot@gmail.com", agentStage: "production" }),
    ).resolves.toEqual({
      ok: true,
      pendingVerification: true,
    });
    expect(mocks.sendVerify).toHaveBeenCalledOnce();
  });

  it("does not send mail for honeypot-suppressed submissions", async () => {
    mocks.register.mockResolvedValue({
      accepted: true,
      normalizedEmail: "bot@example.com",
      suppressedAsBot: true,
    });
    const caller = createCaller();
    await caller.join({ email: "bot@example.com", website: "spam" });
    expect(mocks.sendVerify).not.toHaveBeenCalled();
  });

  it("returns scanner-safe verification data without exposing the email", async () => {
    mocks.verify.mockResolvedValue({
      verified: true,
      alreadyVerified: false,
      email: "pilot@gmail.com",
      referralCode: "abc123",
      referralCount: 0,
      position: 4,
    });
    const caller = createCaller();
    const result = await caller.verify({ token: "token-token-token-token-token-token" });
    expect(result).toMatchObject({ verified: true, referralCode: "abc123", position: 4 });
    expect(result).not.toHaveProperty("email");
    expect(mocks.sendVerified).toHaveBeenCalledOnce();
  });
});
