import { describe, expect, it } from "vitest";
import { normalizeSemanticAction } from "./semanticActions";
import { actionAllowed } from "./authority";

describe("SQL read authority boundary", () => {
  it.each([
    [
      "WITH d AS (DELETE FROM accounts RETURNING *) SELECT * FROM d",
      "database.delete",
      "destructive",
    ],
    [
      "WITH d AS (UPDATE accounts SET active = false RETURNING *) SELECT * FROM d",
      "database.write",
      "write",
    ],
    ["SELECT * FROM accounts; DROP TABLE accounts", "database.delete", "destructive"],
    [
      "WITH d AS (INSERT INTO accounts(id) VALUES(1) RETURNING *) SELECT * FROM d",
      "database.write",
      "write",
    ],
    [
      "SELECT 1; ALTER TABLE accounts ADD COLUMN test integer",
      "database.schema.change",
      "destructive",
    ],
  ])("classifies the full SQL and denies read authority: %s", (sql, name, effect) => {
    const action = normalizeSemanticAction({
      provider: "postgres",
      operation: "query",
      parameters: { sql },
    });
    expect(action).toMatchObject({ name, effect, known: true });
    expect(actionAllowed({ actions: ["database.read"] }, action)).not.toEqual([]);
  });

  it.each([
    "WITH d AS (SELECT 1) SELECT * FROM d",
    "SELECT 'DELETE FROM accounts', 'it''s an update'",
    'SELECT "delete" FROM accounts',
    "SELECT $$DROP TABLE accounts$$",
    "SELECT 1 /* outer /* delete */ drop */ -- update\n",
  ])("preserves ordinary reads: %s", (sql) => {
    const action = normalizeSemanticAction({
      provider: "postgres",
      operation: "query",
      parameters: { sql },
    });
    expect(action).toMatchObject({ name: "database.read", effect: "read" });
    expect(actionAllowed({ actions: ["database.read"] }, action)).toEqual([]);
  });

  it.each([
    "SELECT 'unfinished",
    "SELECT 1 /* unfinished",
    "SELECT E'\\\\' ; DELETE FROM accounts",
  ])("does not assert read-only for ambiguous SQL: %s", (sql) => {
    expect(
      normalizeSemanticAction({ provider: "postgres", operation: "query", parameters: { sql } })
        .known,
    ).toBe(false);
  });
});
