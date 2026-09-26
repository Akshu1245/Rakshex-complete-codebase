import { describe, expect, it } from "vitest";
import { isBlockedHost, validateTargetUrl } from "./guard";

// Regression: non-canonical IP literal forms must be blocked. The WHATWG URL
// parser normalizes decimal/octal/hex/shorthand forms to canonical dotted-quad
// in url.hostname before isBlockedHost ever sees them — these tests lock that in.
describe("quick-scan SSRF guard", () => {
  it.each([
    "http://2130706433/", // decimal -> 127.0.0.1
    "http://0x7f.0.0.1/", // hex parts -> 127.0.0.1
    "http://0177.0.0.1/", // octal parts -> 127.0.0.1
    "http://127.1/", // shorthand -> 127.0.0.1
    "http://0x7f000001/", // hex dword -> 127.0.0.1
    "http://3232235777/", // decimal -> 192.168.1.1
    "http://127.0.0.1/",
    "http://10.0.0.5/",
    "http://169.254.169.254/",
    "http://localhost:3000/",
  ])("blocks %s", (raw) => {
    expect(validateTargetUrl(raw).ok).toBe(false);
  });

  it.each(["https://example.com/", "https://rakshex.in/docs"])("allows %s", (raw) => {
    const v = validateTargetUrl(raw);
    expect(v.ok).toBe(true);
  });

  it("rejects non-http schemes and embedded credentials", () => {
    expect(validateTargetUrl("ftp://example.com/").ok).toBe(false);
    expect(validateTargetUrl("https://user:pass@example.com/").ok).toBe(false);
  });

  it("isBlockedHost covers private ranges on canonical input", () => {
    for (const h of [
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.0.1",
      "127.0.0.1",
      "0.0.0.0",
      "169.254.10.20",
      "::1",
      "localhost",
    ]) {
      expect(isBlockedHost(h)).toBe(true);
    }
    expect(isBlockedHost("example.com")).toBe(false);
    expect(isBlockedHost("8.8.8.8")).toBe(false);
  });
});
