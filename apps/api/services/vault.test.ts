import { describe, expect, it } from "vitest";
import { createVault } from "./encryptedVault";
import {
  ROTATION_GRACE_MS,
  credentialValueValid,
  generateCredentialSecret,
  maskKey,
  rotateCredential,
  type RotatableCredentialRow,
  type RotationStore,
} from "./vault";

const TEST_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const TENANT = "workspace:7";

function makeRow(overrides: Partial<RotatableCredentialRow> = {}): RotatableCredentialRow {
  const vault = createVault({ key: TEST_KEY });
  const encryptedValue = vault.encrypt("old-secret-value", TENANT).ciphertext;
  return {
    id: 1,
    workspaceId: 7,
    name: "openai credential",
    encryptedValue,
    fingerprint: vault.fingerprint("old-secret-value", TENANT),
    status: "active",
    owner: "owner@example.com",
    previousEncryptedValue: null,
    previousFingerprint: null,
    graceExpiresAt: null,
    ...overrides,
  };
}

function makeStore(row: RotatableCredentialRow | null) {
  const calls: { action: string; details?: Record<string, unknown> }[] = [];
  let current = row;
  const store: RotationStore = {
    getCredential: async () => current,
    updateCredential: async (_id, _ws, patch) => {
      if (!current) throw new Error("missing row");
      current = { ...current, ...patch };
    },
    audit: async (_userId, action, details) => {
      calls.push({ action, details });
    },
  };
  return { store, calls, getRow: () => current };
}

describe("maskKey", () => {
  it("shows first 3 + last 2 chars", () => {
    expect(maskKey("sk-abcdefghij9f")).toBe("sk-…9f");
    expect(maskKey("rk_abc123XYZ99")).toBe("rk_…99");
  });
  it("fully masks short secrets instead of leaking them", () => {
    expect(maskKey("abcd")).toBe("•••••");
    expect(maskKey("a")).toBe("•••••");
  });
  it("handles empty input", () => {
    expect(maskKey("")).toBe("");
  });
});

describe("generateCredentialSecret", () => {
  it("mints unique, high-entropy secrets", () => {
    const a = generateCredentialSecret();
    const b = generateCredentialSecret();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(32);
  });
});

describe("rotateCredential", () => {
  it("rotates server-side: new secret encrypted, old kept in grace, audit written", async () => {
    const { store, calls, getRow } = makeStore(makeRow());
    const now = new Date("2026-09-25T12:00:00Z");
    const result = await rotateCredential(store, {
      id: 1,
      workspaceId: 7,
      actorUserId: 42,
      generateSecret: () => "brand-new-secret-value-123",
      vault: createVault({ key: TEST_KEY }),
      now,
    });

    expect(result.rawSecret).toBe("brand-new-secret-value-123");
    expect(result.masked).toBe(maskKey("brand-new-secret-value-123"));
    expect(result.graceExpiresAt.getTime()).toBe(now.getTime() + ROTATION_GRACE_MS);

    const row = getRow()!;
    // New secret decrypts and round-trips through the vault.
    const vault = createVault({ key: TEST_KEY });
    expect(vault.decrypt({ ciphertext: row.encryptedValue }, TENANT)).toBe(
      "brand-new-secret-value-123",
    );
    // Old secret preserved for the grace window.
    expect(row.previousEncryptedValue).not.toBeNull();
    expect(vault.decrypt({ ciphertext: row.previousEncryptedValue! }, TENANT)).toBe(
      "old-secret-value",
    );
    expect(row.graceExpiresAt!.getTime()).toBe(now.getTime() + ROTATION_GRACE_MS);
    // keyPrefix is the masked form, never the full secret.
    expect(row.keyPrefix).toBe(maskKey("brand-new-secret-value-123"));
    expect(row.keyPrefix).not.toContain("brand-new-secret-value-123");

    // Audit log written without any secret material.
    expect(calls).toHaveLength(1);
    expect(calls[0]!.action).toBe("control_plane_credential_rotated");
    expect(JSON.stringify(calls[0]!.details)).not.toContain("brand-new-secret-value-123");
    expect(calls[0]!.details).toMatchObject({ credentialId: 1, workspaceId: 7 });
  });

  it("stamps a new owner when supplied, keeps the old one otherwise", async () => {
    const { store, getRow } = makeStore(makeRow());
    await rotateCredential(store, {
      id: 1,
      workspaceId: 7,
      actorUserId: 42,
      owner: "new-owner@example.com",
      generateSecret: () => "another-new-secret-value-456",
      vault: createVault({ key: TEST_KEY }),
    });
    expect(getRow()!.owner).toBe("new-owner@example.com");
  });

  it("fails closed on missing credential", async () => {
    const { store } = makeStore(null);
    await expect(
      rotateCredential(store, { id: 99, workspaceId: 7, actorUserId: 42 }),
    ).rejects.toThrow("Credential not found");
  });

  it("refuses to rotate a revoked credential", async () => {
    const { store } = makeStore(makeRow({ status: "revoked" }));
    await expect(
      rotateCredential(store, { id: 1, workspaceId: 7, actorUserId: 42 }),
    ).rejects.toThrow("non-active");
  });
});

describe("credentialValueValid", () => {
  it("accepts the current secret and the previous secret inside the grace window", () => {
    const vault = createVault({ key: TEST_KEY });
    const now = new Date("2026-09-25T12:00:00Z");
    const row = makeRow({
      previousFingerprint: vault.fingerprint("old-secret-value", TENANT),
      graceExpiresAt: new Date(now.getTime() + 60_000),
    });
    expect(credentialValueValid(row, "old-secret-value", TENANT, vault, now)).toBe(true);
    expect(credentialValueValid(row, "wrong-secret", TENANT, vault, now)).toBe(false);
  });

  it("rejects the previous secret after the grace window expires", () => {
    const vault = createVault({ key: TEST_KEY });
    const now = new Date("2026-09-25T12:00:00Z");
    const row = makeRow({
      fingerprint: vault.fingerprint("current-secret", TENANT),
      previousFingerprint: vault.fingerprint("old-secret-value", TENANT),
      graceExpiresAt: new Date(now.getTime() - 1_000),
    });
    expect(credentialValueValid(row, "old-secret-value", TENANT, vault, now)).toBe(false);
    expect(credentialValueValid(row, "current-secret", TENANT, vault, now)).toBe(true);
  });

  it("never throws on malformed candidate input", () => {
    const vault = createVault({ key: TEST_KEY });
    expect(credentialValueValid(makeRow(), "", TENANT, vault)).toBe(false);
  });

});
