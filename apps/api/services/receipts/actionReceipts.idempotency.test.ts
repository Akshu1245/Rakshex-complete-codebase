import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("../../db", () => ({ getDb: mocks.getDb }));
import { appendActionReceipt } from "./actionReceipts";

function databaseFixture(existing?: Record<string, unknown>) {
  const insert = vi.fn();
  const lock = vi.fn();
  const tx = {
    execute: lock,
    select(projection?: unknown) {
      return {
        from() {
          return this;
        },
        where() {
          return this;
        },
        orderBy() {
          return this;
        },
        async limit() {
          return projection ? [] : existing ? [existing] : [];
        },
      };
    },
    insert() {
      return {
        values(row: Record<string, unknown>) {
          insert(row);
          return {
            async returning() {
              return [{ ...row, id: 7 }];
            },
          };
        },
      };
    },
  };
  mocks.getDb.mockResolvedValue({
    transaction: async (fn: (value: typeof tx) => unknown) => fn(tx),
  });
  return { insert, lock };
}
const event = {
  workspaceId: 42,
  requestId: "retry-fixture",
  eventType: "allow" as const,
  payload: { model: "example", cost: 1 },
};
let privateKey: string;
describe("receipt retry evidence", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.clearAllMocks();
    privateKey = crypto
      .generateKeyPairSync("ed25519")
      .privateKey.export({ type: "pkcs8", format: "pem" })
      .toString();
    vi.stubEnv("RAKSHEX_RECEIPT_SIGNING_PRIVATE_KEY", privateKey);
    vi.stubEnv("RAKSHEX_RECEIPT_SIGNING_KEY_ID", "test-key");
  });
  it("returns the original receipt for an identical retry without another insert", async () => {
    databaseFixture();
    const first = await appendActionReceipt(event);
    const { insert, lock } = databaseFixture({ ...first, occurredAt: new Date(first.occurredAt) });
    const second = await appendActionReceipt({ ...event, payload: { cost: 1, model: "example" } });
    expect(second).toEqual(first);
    expect(insert).not.toHaveBeenCalled();
    expect(lock).toHaveBeenCalledOnce();
  });
  it("rejects changed evidence under the same event key", async () => {
    databaseFixture();
    const first = await appendActionReceipt(event);
    const { insert } = databaseFixture({ ...first, occurredAt: new Date(first.occurredAt) });
    await expect(
      appendActionReceipt({ ...event, payload: { model: "example", cost: 2 } }),
    ).rejects.toThrow(/idempotency conflict/);
    expect(insert).not.toHaveBeenCalled();
  });
  it("rejects a changed explicit event time", async () => {
    databaseFixture();
    const first = await appendActionReceipt(event);
    databaseFixture({ ...first, occurredAt: new Date(first.occurredAt) });
    await expect(
      appendActionReceipt({ ...event, occurredAt: new Date("2000-01-01") }),
    ).rejects.toThrow(/idempotency conflict/);
  });
  it("writes a settle event when the lookup has no settle receipt", async () => {
    const { insert } = databaseFixture();
    const result = await appendActionReceipt({ ...event, eventType: "settle" });
    expect(result.eventType).toBe("settle");
    expect(insert).toHaveBeenCalledOnce();
  });
  it("fails closed when the database is unavailable", async () => {
    mocks.getDb.mockResolvedValue(null);
    await expect(appendActionReceipt(event)).rejects.toThrow(/fail-closed/);
  });
});
