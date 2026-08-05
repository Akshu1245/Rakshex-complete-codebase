/**
 * Credential-broker network integration tests.
 *
 * The unit tests in credentialBroker.test.ts drive executeBrokeredCall with a
 * mocked fetch, which proves the logic but not the wire behaviour. These run
 * a real HTTP server on loopback and make real requests through the platform
 * fetch, so they catch the things a mock cannot: whether the credential
 * actually arrives in the right header, whether a redirect is really not
 * followed, whether the abort signal genuinely cancels a hung upstream.
 *
 * Note these exercise executeBrokeredCall only — the SSRF/private-host guard
 * lives in authorizeBrokeredRequest and would (correctly) refuse a loopback
 * target, so authorization is covered separately in the unit tests.
 */
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { executeBrokeredCall } from "./credentialBroker";

interface Captured {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

let server: Server;
let baseUrl: string;
let captured: Captured[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => {
      captured.push({
        method: req.method ?? "",
        url: req.url ?? "",
        headers: req.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      });

      if (req.url === "/redirect") {
        res.writeHead(302, { location: "https://evil.example.com/steal" });
        res.end();
        return;
      }
      if (req.url === "/slow") {
        // Never responds — used to prove the timeout actually aborts.
        return;
      }
      if (req.url === "/echo-key") {
        // Simulates a provider echoing the credential back in an error body.
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid API key: sk_live_supersecret123" }));
        return;
      }
      if (req.url === "/text") {
        res.writeHead(500, { "content-type": "text/plain" });
        res.end("upstream exploded");
        return;
      }
      res.writeHead(200, {
        "content-type": "application/json",
        "set-cookie": "sid=abc; HttpOnly",
      });
      res.end(JSON.stringify({ ok: true, id: "re_123" }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("failed to bind test server");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const call = (path: string, over: Partial<Parameters<typeof executeBrokeredCall>[0]> = {}) =>
  executeBrokeredCall({
    targetUrl: `${baseUrl}${path}`,
    method: "POST",
    secret: "sk_live_supersecret123",
    injection: "bearer",
    headerName: null,
    body: { amount: 500 },
    ...over,
  });

describe("executeBrokeredCall over a real socket", () => {
  beforeAll(() => {
    captured = [];
  });

  it("delivers the credential as a real Authorization header", async () => {
    captured = [];
    const result = await call("/v1/refunds");
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true, id: "re_123" });
    expect(captured[0]!.headers.authorization).toBe("Bearer sk_live_supersecret123");
    expect(captured[0]!.method).toBe("POST");
    expect(captured[0]!.body).toBe(JSON.stringify({ amount: 500 }));
    expect(captured[0]!.headers["content-type"]).toBe("application/json");
  });

  it("delivers a custom header credential", async () => {
    captured = [];
    await call("/v1/refunds", { injection: "header", headerName: "X-Api-Key" });
    expect(captured[0]!.headers["x-api-key"]).toBe("sk_live_supersecret123");
    expect(captured[0]!.headers.authorization).toBeUndefined();
  });

  it("delivers a basic-auth credential with an empty password", async () => {
    captured = [];
    await call("/v1/refunds", { injection: "basic" });
    const header = String(captured[0]!.headers.authorization);
    expect(Buffer.from(header.replace("Basic ", ""), "base64").toString()).toBe(
      "sk_live_supersecret123:",
    );
  });

  it("never forwards a caller-supplied authorization header", async () => {
    captured = [];
    await call("/v1/refunds", {
      headers: { Authorization: "Bearer attacker-token", "X-Trace": "t1" },
    });
    // Only the broker's own credential is present, and the benign header survived.
    expect(captured[0]!.headers.authorization).toBe("Bearer sk_live_supersecret123");
    expect(captured[0]!.headers["x-trace"]).toBe("t1");
  });

  it("does NOT follow a redirect — the secret must not reach a second host", async () => {
    captured = [];
    const result = await call("/redirect");
    // redirect: "manual" surfaces the 302 rather than chasing it. Exactly one
    // request was made, so the credential never left for evil.example.com.
    expect([302, 0]).toContain(result.status);
    expect(captured).toHaveLength(1);
    expect(captured[0]!.url).toBe("/redirect");
  });

  it("strips set-cookie from the provider response", async () => {
    const result = await call("/v1/refunds");
    expect(result.headers["set-cookie"]).toBeUndefined();
    expect(result.headers["content-type"]).toContain("application/json");
  });

  it("returns raw text when the provider does not send json", async () => {
    const result = await call("/text");
    expect(result.status).toBe(500);
    expect(result.body).toBe("upstream exploded");
  });

  it("still surfaces the credential echo so the caller can redact it", async () => {
    // executeBrokeredCall returns the body verbatim; redaction is applied by
    // the router via redactSecret. This asserts the echo really happens over
    // the wire, which is what makes that redaction step necessary.
    const result = await call("/echo-key");
    expect(JSON.stringify(result.body)).toContain("sk_live_supersecret123");
  });

  it("aborts a hung upstream instead of hanging forever", async () => {
    const started = Date.now();
    await expect(call("/slow", { timeoutMs: 400 })).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it("reports a plausible duration", async () => {
    const result = await call("/v1/refunds");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.durationMs).toBeLessThan(10_000);
  });
});
