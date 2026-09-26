/**
 * Waitlist route: input validation, welcome-email copy honesty, and the
 * POST handler (D1 insert via mocked store, MailChannels via stubbed fetch).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../src/env";
import {
  app,
  buildWelcomeEmail,
  timingSafeEqual,
  validateWaitlistInput,
} from "../src/routes/waitlist";

// Vitest allows `mock`-prefixed variables inside hoisted mock factories.
let mockReturningRows: { id: number }[] = [{ id: 1 }];
let mockSelectRows: Array<{
  id: number;
  email: string;
  plan: string;
  source: string;
  createdAt: number;
}> = [];

vi.mock("../src/db", () => ({
  createDb: () => ({
    insert: () => ({
      values: () => ({
        onConflictDoNothing: () => ({
          returning: async () => mockReturningRows,
        }),
      }),
    }),
    select: () => ({
      from: () => ({
        orderBy: async () => mockSelectRows,
      }),
    }),
  }),
}));

const baseEnv = { MAILCHANNELS_FROM: "welcome@rakshex.in", DB: {} } as Env;

let ipCounter = 0;
function uniqueIp(): string {
  ipCounter += 1;
  return `10.0.0.${ipCounter}`;
}

async function postJoin(body: unknown, ip = uniqueIp(), env: Env = baseEnv) {
  return app.request(
    "/",
    {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": ip },
      body: JSON.stringify(body),
    },
    env,
  );
}

function stubMailFetch(ok = true) {
  const fetchMock = vi
    .fn()
    .mockImplementation(() =>
      ok
        ? Promise.resolve(new Response("{}", { status: 200 }))
        : Promise.reject(new Error("network down")),
    );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  mockReturningRows = [{ id: 1 }];
  mockSelectRows = [];
});

describe("validateWaitlistInput", () => {
  it("accepts a valid email and plan, normalizing the email", () => {
    const result = validateWaitlistInput({ email: "Boss@Example.COM ", plan: "Pro" });
    expect(result).toEqual({ ok: true, input: { email: "boss@example.com", plan: "Pro" } });
  });

  it("rejects invalid emails", () => {
    for (const body of [
      { email: "not-an-email", plan: "Free" },
      { email: "", plan: "Free" },
      { plan: "Free" },
      null,
      "just a string",
    ]) {
      expect(validateWaitlistInput(body).ok).toBe(false);
    }
  });

  it("rejects unknown plans", () => {
    const result = validateWaitlistInput({ email: "a@b.com", plan: "Unlimited" });
    expect(result.ok).toBe(false);
  });
});

describe("buildWelcomeEmail", () => {
  it("welcomes to the family with honest, claim-free copy", () => {
    const { subject, text, html } = buildWelcomeEmail();
    expect(subject).toBe("Welcome to the RaksHex family");
    expect(text).toContain("Thanks for joining the RaksHex waitlist.");
    expect(text).toContain("I read every response");
    expect(text).toContain("rakshex.in");
    // No invented traction, certifications, or metrics.
    for (const forbidden of ["SOC 2 certified", "ISO 27001", "trusted by", "10,000+"]) {
      expect(text).not.toContain(forbidden);
      expect(html).not.toContain(forbidden);
    }
    expect(html).toContain("Thanks for joining the RaksHex waitlist.");
  });
});

describe("POST /v1/waitlist", () => {
  it("stores the signup and sends the welcome email", async () => {
    const fetchMock = stubMailFetch(true);
    const res = await postJoin({ email: "new@example.com", plan: "Free" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ ok: true, alreadyExists: false, emailSent: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.mailchannels.net/tx/v1/send");
  });

  it("reports alreadyExists and skips the welcome email on duplicates", async () => {
    mockReturningRows = []; // onConflictDoNothing -> no row returned
    const fetchMock = stubMailFetch(true);
    const res = await postJoin({ email: "dup@example.com", plan: "Pro" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ ok: true, alreadyExists: true, emailSent: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid input without touching mail", async () => {
    const fetchMock = stubMailFetch(true);
    const res = await postJoin({ email: "bad", plan: "Free" });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still records the signup when mail sending fails (emailSent: false)", async () => {
    const fetchMock = stubMailFetch(false);
    const res = await postJoin({ email: "mailfail@example.com", plan: "Enterprise" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ ok: true, alreadyExists: false, emailSent: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rate-limits abusive clients", async () => {
    stubMailFetch(true);
    const ip = uniqueIp();
    let lastStatus = 200;
    for (let i = 0; i < 12; i++) {
      const res = await postJoin({ email: `rl${i}@example.com`, plan: "Free" }, ip);
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});

describe("GET /v1/waitlist (CEO admin)", () => {
  const adminEnv = { ...baseEnv, ADMIN_API_KEY: "ceo-secret-key" } as Env;

  function getList(headers: Record<string, string> = {}, env: Env = adminEnv) {
    return app.request("/", { method: "GET", headers }, env);
  }

  it("fails closed with 500 when ADMIN_API_KEY is unset", async () => {
    const res = await getList({ Authorization: "Bearer anything" }, baseEnv);
    expect(res.status).toBe(500);
  });

  it("returns 401 without a bearer key", async () => {
    const res = await getList();
    expect(res.status).toBe(401);
  });

  it("returns 401 for a wrong key", async () => {
    const res = await getList({ Authorization: "Bearer wrong-key" });
    expect(res.status).toBe(401);
  });

  it("lists signups for the CEO key", async () => {
    mockSelectRows = [
      { id: 2, email: "b@example.com", plan: "Pro", source: "web", createdAt: 1_700_000_000_000 },
      { id: 1, email: "a@example.com", plan: "Free", source: "web", createdAt: 1_699_000_000_000 },
    ];
    const res = await getList({ Authorization: "Bearer ceo-secret-key" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entries: Array<Record<string, unknown>>; total: number };
    expect(body.total).toBe(2);
    expect(body.entries[0]!).toMatchObject({
      id: 2,
      email: "b@example.com",
      plan: "Pro",
      source: "web",
    });
    // createdAt is serialized as ISO for the dashboard.
    expect(typeof body.entries[0]!.createdAt).toBe("string");
  });

  it("returns an empty list when nobody signed up", async () => {
    mockSelectRows = [];
    const res = await getList({ Authorization: "Bearer ceo-secret-key" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ entries: [], total: 0 });
  });
});

describe("timingSafeEqual", () => {
  it("accepts equal keys and rejects the rest", () => {
    expect(timingSafeEqual("ceo-secret-key", "ceo-secret-key")).toBe(true);
    expect(timingSafeEqual("ceo-secret-key", "ceo-secret-keZ")).toBe(false);
    expect(timingSafeEqual("ceo-secret-key", "ceo-secret-key!")).toBe(false);
    expect(timingSafeEqual("", "")).toBe(true);
  });
});
