import { generateKeyPairSync, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { scanTextForSecrets } from "./secrets.js";
import { evaluateGate, DEFAULT_POLICY } from "./secrets-policy.js";

// Headers are assembled at runtime so this file itself carries no PEM marker.
const KIND = (k: string) => (k ? `${k} ` : "");
const BEGIN = (k = "RSA") => "-----" + "BEGIN " + KIND(k) + "PRIVATE KEY-----";
const END = (k = "RSA") => "-----" + "END " + KIND(k) + "PRIVATE KEY-----";
const pem = (f: ReturnType<typeof scanTextForSecrets>) =>
  f.filter((x) => x.ruleId === "secret.private_key_header");
const gate = (text: string, file = "src/x.ts") =>
  evaluateGate(
    scanTextForSecrets(text, file),
    DEFAULT_POLICY,
    { entries: [], errors: [] },
    new Date("2026-10-15"),
  );

describe("PEM private key classification", () => {
  it("bare header without key body is Low/ambiguous and does not fail the gate", () => {
    for (const k of ["RSA", "EC", "OPENSSH", ""]) {
      const f = pem(
        scanTextForSecrets(`const marker = "${BEGIN(k)}";\nexport {};`, "src/detect.ts"),
      );
      expect(f).toHaveLength(1);
      expect(f[0]!.severity).toBe("Low");
      expect(f[0]!.classification).toBe("ambiguous");
      expect(f[0]!.signals.join()).toMatch(/header-without-key-body/);
      expect(f[0]!.verification_status).toBe("not_verified");
    }
    expect(gate(`${BEGIN()}\nsafe line`).decisions.every((d) => d.outcome !== "fail")).toBe(true);
  });

  it("header followed by an END marker but no body stays non-gating", () => {
    expect(pem(scanTextForSecrets(`${BEGIN()}\n${END()}`, "a.pem"))[0]!.severity).toBe("Low");
  });

  it("real generated keys (RSA pkcs1, PKCS8, EC) with body are Critical, high confidence, and fail the gate", () => {
    const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
    const ec = generateKeyPairSync("ec", { namedCurve: "prime256v1" }).privateKey;
    const keys = [
      rsa.export({ type: "pkcs1", format: "pem" }).toString(),
      rsa.export({ type: "pkcs8", format: "pem" }).toString(),
      ec.export({ type: "sec1", format: "pem" }).toString(),
      ec.export({ type: "pkcs8", format: "pem" }).toString(),
    ];
    for (const k of keys) {
      for (const file of ["deploy/key.pem", "tests/fixtures/key.pem"]) {
        const f = pem(scanTextForSecrets(k, file));
        expect(f).toHaveLength(1);
        expect(f[0]!.severity).toBe("Critical");
        expect(f[0]!.classification).toBe("plausible_credential");
        const g = evaluateGate(
          scanTextForSecrets(k, file),
          DEFAULT_POLICY,
          { entries: [], errors: [] },
          new Date("2026-10-15"),
        );
        expect(g.decisions.some((d) => d.outcome === "fail")).toBe(true);
      }
    }
  });

  it("key embedded as escaped \\n in a JSON/env string stays Critical", () => {
    const k = generateKeyPairSync("ec", { namedCurve: "prime256v1" })
      .privateKey.export({ type: "pkcs8", format: "pem" })
      .toString();
    const json = JSON.stringify({ private_key: k });
    expect(pem(scanTextForSecrets(json, "svc.json"))[0]!.severity).toBe("Critical");
    const env = `PRIVATE_KEY="${k.replace(/\n/g, "\\n")}"`;
    expect(pem(scanTextForSecrets(env, ".env"))[0]!.severity).toBe("Critical");
  });

  it("random base64 body without END marker (truncated paste) stays Critical, medium confidence", () => {
    const body = randomBytes(300)
      .toString("base64")
      .match(/.{1,64}/g)!
      .join("\n");
    const f = pem(scanTextForSecrets(`${BEGIN()}\n${body}\n`, "notes.md"))[0]!;
    expect(f.severity).toBe("Critical");
    expect(f.detection_confidence).toBe("medium");
  });

  it("body containing words like 'example'/'test' is not exempted", () => {
    const b = randomBytes(240).toString("base64");
    const body = (b.slice(0, 50) + "EXAMPLEtestFAKE" + b.slice(50)).match(/.{1,64}/g)!.join("\n");
    const f = pem(
      scanTextForSecrets(`${BEGIN()}\n${body}\n${END()}`, "tests/example/fake.pem"),
    )[0]!;
    expect(f.severity).toBe("Critical");
  });

  it("synthetic bodies (repeated chars / repeated pattern) are Info placeholders", () => {
    for (const body of ["A".repeat(256), "MIIEexample".repeat(30), "abcd".repeat(80)]) {
      const f = pem(
        scanTextForSecrets(
          `${BEGIN()}\n${body.match(/.{1,64}/g)!.join("\n")}\n${END()}`,
          "docs/x.md",
        ),
      )[0]!;
      expect(f.severity).toBe("Info");
      expect(f.classification).toBe("synthetic_placeholder");
    }
  });

  it("short ellipsis bodies like 'MIIE...' are header-only (no key material)", () => {
    expect(pem(scanTextForSecrets(`${BEGIN()}\nMIIE...`, "doc.md"))[0]!.severity).toBe("Low");
  });
});
