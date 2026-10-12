import express from "express";
import { createServer, request, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { registerQuickScanRoute } from "./quickScan";

describe("public Quick Scan request boundary", () => {
  let server: Server;
  let port = 0;

  beforeAll(async () => {
    const app = express();
    registerQuickScanRoute(app);
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test port");
    port = address.port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  function post(body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
    const data = JSON.stringify(body);
    return new Promise((resolve, reject) => {
      const req = request(
        {
          hostname: "127.0.0.1",
          port,
          path: "/api/public/quick-scan",
          method: "POST",
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(data),
          },
        },
        (res) => {
          let text = "";
          res.setEncoding("utf8");
          res.on("data", (chunk: string) => (text += chunk));
          res.on("end", () =>
            resolve({
              status: res.statusCode ?? 0,
              body: JSON.parse(text) as Record<string, unknown>,
            }),
          );
        },
      );
      req.on("error", reject);
      req.end(data);
    });
  }

  it("rejects remote URLs without making any outbound fetch", async () => {
    const outbound = vi.spyOn(globalThis, "fetch");
    const result = await post({ url: "http://169.254.169.254/latest/meta-data/" });
    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(/Remote URL scanning is disabled/);
    expect(outbound).not.toHaveBeenCalled();
    outbound.mockRestore();
  });

  it("rejects URLs even if a document is also supplied", async () => {
    const result = await post({ url: "https://example.com/openapi.json", spec: { paths: {} } });
    expect(result.status).toBe(400);
  });

  it("rejects unrelated JSON instead of claiming it is clean", async () => {
    const result = await post({ spec: { arbitrary: true } });
    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(/OpenAPI/);
  });

  it("continues to scan an inline OpenAPI document", async () => {
    const result = await post({
      spec: {
        openapi: "3.0.3",
        paths: { "/health": { get: { responses: { "200": { description: "OK" } } } } },
      },
    });
    expect(result.status).toBe(200);
    expect(typeof result.body.totalFindings).toBe("number");
    expect(Array.isArray(result.body.findings)).toBe(true);
  });
});
