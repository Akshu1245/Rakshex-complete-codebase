import { describe, expect, it } from "vitest";
import { generatePCIDSSRequirements, generateGDPRRequirements } from "./scanning";

const insecureCollection = {
  item: [{ request: { method: "POST", url: { raw: "http://api.pay.local/charge" } } }],
};
const secureCollection = {
  item: [
    {
      request: {
        method: "POST",
        url: { raw: "https://api.pay.local/api/v1/charge" },
        header: [{ key: "Authorization", value: "Bearer x" }],
      },
    },
  ],
};

describe("PCI DSS v4.0.1 mapping", () => {
  it("uses real v4.0.1 requirement identifiers", () => {
    const reqs = generatePCIDSSRequirements(insecureCollection);
    const ids = reqs.map((r) => r.id);
    expect(ids).toContain("PCI-4.2.1"); // crypto in transit
    expect(ids).toContain("PCI-8.3.1"); // authentication
    expect(ids).toContain("PCI-11.3.1"); // continuous scanning
  });

  it("flags insecure transport + missing auth as not_met", () => {
    const reqs = generatePCIDSSRequirements(insecureCollection);
    expect(reqs.find((r) => r.id === "PCI-4.2.1")?.status).toBe("not_met");
    expect(reqs.find((r) => r.id === "PCI-8.3.1")?.status).toBe("not_met");
  });

  it("marks crypto + auth met for an HTTPS authenticated collection", () => {
    const reqs = generatePCIDSSRequirements(secureCollection);
    expect(reqs.find((r) => r.id === "PCI-4.2.1")?.status).toBe("met");
    expect(reqs.find((r) => r.id === "PCI-8.3.1")?.status).toBe("met");
  });
});

describe("GDPR mapping", () => {
  it("maps to GDPR article identifiers", () => {
    const reqs = generateGDPRRequirements(insecureCollection);
    const ids = reqs.map((r) => r.id);
    expect(ids).toContain("GDPR-Art.32(1)(a)");
    expect(ids).toContain("GDPR-Art.5(1)(f)");
    expect(ids).toContain("GDPR-Art.30");
  });

  it("flags plaintext transport as not_met for Art.32", () => {
    const reqs = generateGDPRRequirements(insecureCollection);
    expect(reqs.find((r) => r.id === "GDPR-Art.32(1)(a)")?.status).toBe("not_met");
  });
});
