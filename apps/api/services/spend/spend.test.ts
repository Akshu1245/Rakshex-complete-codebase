/**
 * Spend service tests (Team B, meter core).
 *
 * Reservation/ledger tests run against a fake SpendDb executor so they need
 * no Postgres; they assert the atomic SQL contract (single conditional
 * UPDATE, INSERT ... RETURNING) and fail-closed behavior instead.
 */
import { describe, expect, it, vi } from "vitest";
import { abort, reserve, settle, sumOutstandingUsd, type SpendDb } from "./reservation";
import { appendSpendLedgerEntry, sumLedgerSpendUsd } from "./ledger";
import { detectDirectProviderKeyBypass, DIRECT_PROVIDER_KEY_BYPASS } from "./bypassDetector";

function fakeDb(rows: Record<string, unknown>[] = [], rowCount: number | null = 1): SpendDb {
  return { execute: vi.fn(async () => ({ rows, rowCount })) };
}

/** Raw SQL text of a drizzle sql`` template (params stay as placeholders). */
function chunkText(chunk: unknown): string {
  if (chunk !== null && typeof chunk === "object") {
    if ("value" in chunk && Array.isArray((chunk as { value: unknown }).value)) {
      return (chunk as { value: unknown[] }).value.map(String).join("");
    }
    if ("queryChunks" in chunk && Array.isArray((chunk as { queryChunks: unknown }).queryChunks)) {
      return (chunk as { queryChunks: unknown[] }).queryChunks.map(chunkText).join("");
    }
  }
  return "?";
}

function sqlText(db: SpendDb): string {
  const arg = (db.execute as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
    queryChunks?: unknown[];
  };
  return (arg?.queryChunks ?? []).map(chunkText).join("");
}


describe("reserve", () => {
  it("inserts a reserved row and returns a res_ id", async () => {
    const db = fakeDb();
    const { reservationId } = await reserve(db, {
      workspaceId: 7,
      scopeKind: "agent",
      scopeId: "agt_1",
      estimatedUsd: 0.5,
    });
    expect(reservationId).toMatch(/^res_[0-9a-f]{32}$/);
    const query = sqlText(db);
    expect(query).toContain("spend_reservations");
    expect(query).toContain("reserved");
  });

  it("rejects negative estimates", async () => {
    await expect(
      reserve(fakeDb(), { workspaceId: 7, scopeKind: "agent", scopeId: "a", estimatedUsd: -1 }),
    ).rejects.toThrow(/non-negative/);
  });
});

describe("settle", () => {
  it("settles with a single conditional UPDATE", async () => {
    const db = fakeDb([], 1);
    await settle(db, { reservationId: "res_x", actualUsd: 0.12 });
    const query = sqlText(db);
    expect(query).toMatch(/status = 'settled'/);
    expect(query).toMatch(/status = 'reserved'/);
  });

  it("fails closed on double settle (zero rows affected)", async () => {
    await expect(settle(fakeDb([], 0), { reservationId: "res_x", actualUsd: 0.1 })).rejects.toThrow(
      /not in reserved state/,
    );
  });
});

describe("abort", () => {
  it("aborts a reserved row", async () => {
    const db = fakeDb([], 1);
    await abort(db, { reservationId: "res_x" });
    const query = sqlText(db);
    expect(query).toMatch(/status = 'aborted'/);
  });

  it("fails closed when the reservation is already settled", async () => {
    await expect(abort(fakeDb([], 0), { reservationId: "res_x" })).rejects.toThrow(
      /not in reserved state/,
    );
  });
});

describe("sumOutstandingUsd", () => {
  it("parses the numeric total the driver returns as a string", async () => {
    const total = await sumOutstandingUsd(fakeDb([{ total: "2.5000000000" }]), {
      workspaceId: 7,
      scopeKind: "agent",
      scopeId: "agt_1",
    });
    expect(total).toBeCloseTo(2.5, 10);
  });

  it("returns 0 on empty results", async () => {
    const total = await sumOutstandingUsd(fakeDb([]), {
      workspaceId: 7,
      scopeKind: "user",
      scopeId: "42",
    });
    expect(total).toBe(0);
  });
});

describe("appendSpendLedgerEntry", () => {
  it("appends and returns the inserted id", async () => {
    const db = fakeDb([{ id: 11 }]);
    const { id } = await appendSpendLedgerEntry(db, {
      workspaceId: 7,
      agentId: "agt_1",
      action: "ai.chat",
      provider: "openai",
      model: "gpt-4o-mini",
      inputTokens: 100,
      outputTokens: 50,
      costUsd: 0.000045,
      signalLabel: "observed",
    });
    expect(id).toBe(11);
    const query = sqlText(db);
    expect(query).toContain("spend_ledger");
    expect(query).toContain("RETURNING id");
  });

  it("fails closed when no id comes back", async () => {
    await expect(
      appendSpendLedgerEntry(fakeDb([]), {
        workspaceId: 7,
        agentId: "agt_1",
        action: "ai.chat",
        provider: "openai",
        model: "gpt-4o-mini",
        inputTokens: 1,
        outputTokens: 1,
        costUsd: 0,
        signalLabel: "estimated",
      }),
    ).rejects.toThrow(/no id/);
  });

  it("rejects invalid input before touching the db", async () => {
    const db = fakeDb([{ id: 1 }]);
    await expect(
      appendSpendLedgerEntry(db, {
        workspaceId: 0,
        agentId: "agt_1",
        action: "ai.chat",
        provider: "openai",
        model: "gpt-4o-mini",
        inputTokens: 1,
        outputTokens: 1,
        costUsd: 0.1,
        signalLabel: "observed",
      }),
    ).rejects.toThrow(/positive workspaceId/);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it("exposes no update or delete operations (append-only contract)", async () => {
    const ledger = await import("./ledger");
    const names = Object.keys(ledger);
    expect(names).not.toContain("updateSpendLedgerEntry");
    expect(names).not.toContain("deleteSpendLedgerEntry");
    expect(names).toContain("appendSpendLedgerEntry");
  });
});

describe("sumLedgerSpendUsd", () => {
  it("sums realized spend for a scope", async () => {
    const total = await sumLedgerSpendUsd(fakeDb([{ total: "12.3400000000" }]), {
      workspaceId: 7,
      scopeKind: "agent",
      scopeId: "agt_1",
    });
    expect(total).toBeCloseTo(12.34, 10);
  });
});

describe("detectDirectProviderKeyBypass", () => {
  const issued = new Set(["fp_broker_1", "fp_broker_2"]);

  it("flags spend on a fingerprint the broker never issued", () => {
    const findings = detectDirectProviderKeyBypass(issued, [
      { keyFingerprint: "fp_broker_1", provider: "openai", costUsd: 1.2 },
      { keyFingerprint: "fp_shadow_9", provider: "openai", costUsd: 45.67 },
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      type: DIRECT_PROVIDER_KEY_BYPASS,
      keyFingerprint: "fp_shadow_9",
      provider: "openai",
      costUsd: 45.67,
      issuedByBroker: false,
    });
    expect(findings[0]?.detail).toContain("never issued");
  });

  it("returns no findings when every fingerprint was broker-issued", () => {
    expect(
      detectDirectProviderKeyBypass(issued, [
        { keyFingerprint: "fp_broker_1", provider: "openai", costUsd: 1 },
        { keyFingerprint: "fp_broker_2", provider: "anthropic", costUsd: 2 },
      ]),
    ).toEqual([]);
  });

  it("skips unattributable rows instead of flagging them", () => {
    expect(
      detectDirectProviderKeyBypass(issued, [{ keyFingerprint: "  ", provider: "openai", costUsd: 9 }]),
    ).toEqual([]);
  });

  it("never punishes — output is findings only", () => {
    const findings = detectDirectProviderKeyBypass(issued, [
      { keyFingerprint: "fp_evil", provider: "openai", costUsd: 1 },
    ]);
    expect(Object.keys(findings[0] ?? {})).not.toContain("revoke");
    expect(Object.keys(findings[0] ?? {})).not.toContain("punish");
  });
});
