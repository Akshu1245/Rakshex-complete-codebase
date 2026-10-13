import { describe, expect, it } from "vitest";
import { normalizeSemanticAction, semanticActionCatalog } from "./semanticActions";
import {
  ACTION_CLASS_MATRIX,
  UNKNOWN_ACTION_CLASS,
  classifySemanticAction,
} from "./actionClasses";

describe("action class inventory — deployment gated", () => {
  it("lists every known semanticActions.ts definition once with matching domain/effect", () => {
    const catalog = semanticActionCatalog();
    expect(ACTION_CLASS_MATRIX).toHaveLength(catalog.length);
    expect(new Set(ACTION_CLASS_MATRIX.map((row) => row.name)).size).toBe(catalog.length);
    for (const action of catalog) {
      const row = ACTION_CLASS_MATRIX.find((entry) => entry.name === action.name);
      expect(row, action.name).toBeDefined();
      expect(row?.domain).toBe(action.domain);
      expect(row?.effect).toBe(action.effect);
      expect(row?.revocationSources.length).toBeGreaterThan(0);
      expect(row?.failMode).toBe("DENY_UNLESS_AUTHORITATIVE_AND_RECEIPTED");
    }
  });

  it("requires Class A for all money-moving and write/destructive actions", () => {
    for (const row of ACTION_CLASS_MATRIX) {
      if (row.domain === "financial" || row.effect === "write" || row.effect === "destructive") {
        expect(row.actionClass, row.name).toBe("A");
      }
    }
  });

  it("does not automatically grant cached Class B to database reads", () => {
    const read = normalizeSemanticAction({
      provider: "postgres",
      operation: "query",
      parameters: { sql: "SELECT * FROM secrets" },
    });
    expect(read.name).toBe("database.read");
    expect(classifySemanticAction(read).actionClass).toBe("A");
    expect(classifySemanticAction(read).bReadiness).toBe("candidate-requires-review");
  });

  it("holds even for side-effecting SQL mis-normalized as database.read", () => {
    const query = normalizeSemanticAction({
      provider: "postgres",
      operation: "query",
      parameters: { sql: "WITH deleted AS (DELETE FROM customers RETURNING id) SELECT id FROM deleted" },
    });
    // This observes a current matching limitation; security is protected by fail-closed Class A.
    expect(classifySemanticAction(query).actionClass).toBe("A");
  });

  it("unknown operations remain Class A", () => {
    const unknown = normalizeSemanticAction({ provider: "mcp", operation: "custom_unregistered" });
    expect(unknown.known).toBe(false);
    expect(classifySemanticAction(unknown)).toEqual(UNKNOWN_ACTION_CLASS);
  });

  it("fails Class A for forged or conflicting metadata", () => {
    expect(
      classifySemanticAction({
        name: "database.read",
        known: true,
        domain: "database",
        effect: "destructive",
      }),
    ).toEqual(UNKNOWN_ACTION_CLASS);
    expect(
      classifySemanticAction({
        name: "database.read",
        known: false,
        domain: "database",
        effect: "read",
      }),
    ).toEqual(UNKNOWN_ACTION_CLASS);
  });

  it("does not activate any Class B routes without a proven signed policy path", () => {
    expect(ACTION_CLASS_MATRIX.filter((row) => row.actionClass === "B")).toEqual([]);
  });
});
