import { describe, it, expect } from "vitest";
import {
  calculateConfidence,
  confidenceLevel,
  normalizeSeverity,
  generateFingerprint,
  deduplicateFindings,
  prioritizeFindings,
  enrichFinding,
  type EnrichedFinding,
} from "./scanningQuality";

describe("scanningQuality", () => {
  describe("calculateConfidence", () => {
    it("returns base confidence with minimal evidence", () => {
      const score = calculateConfidence(1, false, false, 0.5);
      expect(score).toBeGreaterThanOrEqual(30);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("boosts confidence with rich context", () => {
      const low = calculateConfidence(1, false, false, 0.5);
      const high = calculateConfidence(3, true, true, 1.0);
      expect(high).toBeGreaterThan(low);
    });

    it("caps at 100", () => {
      expect(calculateConfidence(10, true, true, 1.0)).toBe(100);
    });
  });

  describe("confidenceLevel", () => {
    it("classifies scores correctly", () => {
      expect(confidenceLevel(90)).toBe("critical");
      expect(confidenceLevel(75)).toBe("high");
      expect(confidenceLevel(60)).toBe("medium");
      expect(confidenceLevel(30)).toBe("low");
    });
  });

  describe("normalizeSeverity", () => {
    it("downgrades low-confidence Critical to High", () => {
      expect(normalizeSeverity("Critical", 30)).toBe("High");
    });

    it("upgrades high-confidence Medium to High", () => {
      expect(normalizeSeverity("Medium", 95)).toBe("High");
    });

    it("never goes below Low", () => {
      expect(normalizeSeverity("Low", 10)).toBe("Low");
    });

    it("never goes above Critical", () => {
      expect(normalizeSeverity("Critical", 99)).toBe("Critical");
    });
  });

  describe("generateFingerprint", () => {
    it("generates same fingerprint for similar endpoints", () => {
      const fp1 = generateFingerprint("/users/123", "GET", "auth", "CWE-306");
      const fp2 = generateFingerprint("/users/456", "GET", "auth", "CWE-306");
      expect(fp1).toBe(fp2);
    });

    it("generates different fingerprints for different categories", () => {
      const fp1 = generateFingerprint("/users", "GET", "auth", "CWE-306");
      const fp2 = generateFingerprint("/users", "GET", "crypto", "CWE-319");
      expect(fp1).not.toBe(fp2);
    });
  });

  describe("deduplicateFindings", () => {
    it("merges duplicate findings and keeps highest confidence", () => {
      const findings: EnrichedFinding[] = [
        {
          id: "1",
          title: "Test",
          severity: "High",
          confidence: 60,
          confidenceLevel: "medium",
          fingerprint: "same",
          evidence: ["a"],
          references: ["ref1"],
          suppressible: true,
          whatHappened: "",
          whyItMatters: "",
          howDangerous: "",
          howToFix: "",
          fixConfidence: 70,
          description: "",
          category: "",
          remediation: "",
          cweId: "",
        },
        {
          id: "2",
          title: "Test",
          severity: "Critical",
          confidence: 90,
          confidenceLevel: "critical",
          fingerprint: "same",
          evidence: ["b"],
          references: ["ref2"],
          suppressible: true,
          whatHappened: "",
          whyItMatters: "",
          howDangerous: "",
          howToFix: "",
          fixConfidence: 80,
          description: "",
          category: "",
          remediation: "",
          cweId: "",
        },
      ];

      const result = deduplicateFindings(findings);
      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe("Critical");
      expect(result[0].confidence).toBe(90);
      expect(result[0].evidence).toContain("a");
      expect(result[0].evidence).toContain("b");
    });
  });

  describe("prioritizeFindings", () => {
    it("sorts by severity then confidence", () => {
      const findings: EnrichedFinding[] = [
        {
          id: "1",
          severity: "Medium",
          confidence: 90,
          title: "",
          confidenceLevel: "high",
          fingerprint: "a",
          evidence: [],
          references: [],
          suppressible: true,
          whatHappened: "",
          whyItMatters: "",
          howDangerous: "",
          howToFix: "",
          fixConfidence: 50,
          description: "",
          category: "",
          remediation: "",
          cweId: "",
        },
        {
          id: "2",
          severity: "Critical",
          confidence: 50,
          title: "",
          confidenceLevel: "medium",
          fingerprint: "b",
          evidence: [],
          references: [],
          suppressible: true,
          whatHappened: "",
          whyItMatters: "",
          howDangerous: "",
          howToFix: "",
          fixConfidence: 50,
          description: "",
          category: "",
          remediation: "",
          cweId: "",
        },
        {
          id: "3",
          severity: "High",
          confidence: 80,
          title: "",
          confidenceLevel: "high",
          fingerprint: "c",
          evidence: [],
          references: [],
          suppressible: true,
          whatHappened: "",
          whyItMatters: "",
          howDangerous: "",
          howToFix: "",
          fixConfidence: 50,
          description: "",
          category: "",
          remediation: "",
          cweId: "",
        },
      ];

      const result = prioritizeFindings(findings);
      expect(result[0].severity).toBe("Critical");
      expect(result[1].severity).toBe("High");
      expect(result[2].severity).toBe("Medium");
    });
  });

  describe("enrichFinding", () => {
    it("enriches a raw finding with all quality fields", () => {
      const enriched = enrichFinding({
        id: "test-1",
        title: "Cleartext HTTP",
        severity: "High",
        description: "Endpoint uses HTTP",
        category: "Cryptographic Failures (OWASP A02)",
        remediation: "Use HTTPS",
        cweId: "CWE-319",
        endpoint: "http://api.example.com/users",
        method: "GET",
        evidence: ["Header: Host: api.example.com"],
      });

      expect(enriched.confidence).toBeGreaterThan(0);
      expect(enriched.confidenceLevel).toBeDefined();
      expect(enriched.whatHappened).toBe("Endpoint uses HTTP");
      expect(enriched.whyItMatters).toContain("Unencrypted traffic");
      expect(enriched.howDangerous).toContain("significantly weakens");
      expect(enriched.fingerprint).toMatch(/^fp_/);
      expect(enriched.evidence).toHaveLength(1);
      expect(enriched.references.length).toBeGreaterThan(0);
      expect(enriched.suppressible).toBe(true);
    });
  });
});
