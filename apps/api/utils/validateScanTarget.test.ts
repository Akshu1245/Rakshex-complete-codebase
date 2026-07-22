import { describe, expect, it } from "vitest";
import { isBlockedIp, validateScanTarget } from "./validateScanTarget";

describe("isBlockedIp", () => {
  it("blocks loopback, private, link-local and metadata addresses", () => {
    expect(isBlockedIp("127.0.0.1")).toBe(true);
    expect(isBlockedIp("10.1.2.3")).toBe(true);
    expect(isBlockedIp("172.16.0.1")).toBe(true);
    expect(isBlockedIp("172.31.255.255")).toBe(true);
    expect(isBlockedIp("192.168.1.1")).toBe(true);
    expect(isBlockedIp("169.254.169.254")).toBe(true); // cloud metadata
    expect(isBlockedIp("0.0.0.0")).toBe(true);
    expect(isBlockedIp("::1")).toBe(true);
    expect(isBlockedIp("::ffff:127.0.0.1")).toBe(true);
  });

  it("allows public addresses", () => {
    expect(isBlockedIp("8.8.8.8")).toBe(false);
    expect(isBlockedIp("1.1.1.1")).toBe(false);
    expect(isBlockedIp("172.15.0.1")).toBe(false); // just outside 172.16/12
    expect(isBlockedIp("172.32.0.1")).toBe(false);
  });
});

describe("validateScanTarget", () => {
  it("rejects non-http(s) and malformed URLs", async () => {
    expect((await validateScanTarget("ftp://example.com")).ok).toBe(false);
    expect((await validateScanTarget("not a url")).ok).toBe(false);
  });

  it("rejects internal hostnames and literal internal IPs", async () => {
    expect((await validateScanTarget("http://localhost:6379")).ok).toBe(false);
    expect((await validateScanTarget("http://127.0.0.1/x")).ok).toBe(false);
    expect((await validateScanTarget("http://169.254.169.254/latest/meta-data")).ok).toBe(false);
    expect((await validateScanTarget("http://192.168.0.10/api")).ok).toBe(false);
  });

  it("allows a normal public https URL", async () => {
    const r = await validateScanTarget("https://8.8.8.8/openapi.json");
    expect(r.ok).toBe(true);
  });
});
