import { beforeEach, describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { runOasdiff } from "./oasdiffAdapter.js";

vi.mock("node:child_process", () => ({ spawnSync: vi.fn() }));
const mockedSpawn = vi.mocked(spawnSync);

function result(status: number, stdout: string, error?: NodeJS.ErrnoException) {
  return {
    status,
    stdout,
    stderr: "sensitive API token might appear in an upstream error",
    signal: null,
    pid: 1,
    output: [],
    error,
  } as unknown as ReturnType<typeof spawnSync>;
}

describe("offline oasdiff adapter", () => {
  beforeEach(() => mockedSpawn.mockReset());

  it("uses a fixed argument list, disables external references, and avoids shell execution", () => {
    mockedSpawn.mockReturnValue(
      result(
        1,
        JSON.stringify([
          {
            id: "response-property-removed",
            level: 3,
            operation: "GET",
            path: "/orders",
            text: "field removed",
          },
        ]),
      ),
    );
    const report = runOasdiff("/tmp/old.yaml", "/tmp/new.yaml");
    expect(report).toMatchObject({
      engine: "oasdiff",
      breaking: true,
      changes: [{ id: "response-property-removed", level: 3 }],
    });
    expect(mockedSpawn).toHaveBeenCalledWith(
      "oasdiff",
      [
        "breaking",
        "--format",
        "json",
        "--fail-on",
        "WARN",
        "--allow-external-refs=false",
        "--",
        "/tmp/old.yaml",
        "/tmp/new.yaml",
      ],
      expect.objectContaining({ shell: false, timeout: 30_000, windowsHide: true }),
    );
  });

  it("accepts the object-wrapper JSON format and returns a clean partial signal", () => {
    mockedSpawn.mockReturnValue(result(0, '{"breaking":[]}'));
    const report = runOasdiff("/old", "/new");
    expect(report.breaking).toBe(false);
    expect(report.scope).toContain("does NOT prove");
  });

  it("fails closed when the binary is missing", () => {
    mockedSpawn.mockReturnValue(
      result(-1, "", Object.assign(new Error("spawn oasdiff ENOENT"), { code: "ENOENT" })),
    );
    expect(() => runOasdiff("/old", "/new")).toThrow(/executable not found/);
  });

  it("refuses invalid output or a contradictory exit status", () => {
    mockedSpawn.mockReturnValue(result(0, '[{"id":"operation-removed","level":3}]'));
    expect(() => runOasdiff("/old", "/new")).toThrow(/disagree/);
    mockedSpawn.mockReturnValue(result(1, "not-json"));
    expect(() => runOasdiff("/old", "/new")).toThrow(/invalid JSON/);
    mockedSpawn.mockReturnValue(result(0, "{}"));
    expect(() => runOasdiff("/old", "/new")).toThrow(/Unexpected oasdiff JSON/);
  });

  it("never copies upstream error stderr into CLI errors", () => {
    mockedSpawn.mockReturnValue(result(2, "[]"));
    expect(() => runOasdiff("/old", "/new")).toThrow(/comparison failed/);
    try {
      runOasdiff("/old", "/new");
    } catch (error) {
      expect(String(error)).not.toContain("sensitive API token");
    }
  });
});

describe("oasdiff adapter regression guards", () => {
  beforeEach(() => mockedSpawn.mockReset());

  it("keeps before-to-after and after-to-before verdicts distinct", () => {
    mockedSpawn
      .mockReturnValueOnce(result(1, '[{"id":"api-path-removed","level":3,"operation":"GET","path":"/orders"}]'))
      .mockReturnValueOnce(result(0, "[]"));
    expect(runOasdiff("/before", "/after").breaking).toBe(true);
    expect(runOasdiff("/after", "/before").breaking).toBe(false);
    expect(mockedSpawn).toHaveBeenCalledTimes(2);
  });

  it("fails closed for unsupported severities or malformed field types", () => {
    for (const payload of [
      '[{"id":"x","level":1}]',
      '[{"id":"x","level":2.5}]',
      '[{"id":"","level":3}]',
      '[{"id":"x","level":3,"path":{"unexpected":true}}]',
    ]) {
      mockedSpawn.mockReturnValue(result(1, payload));
      expect(() => runOasdiff("/before", "/after")).toThrow(/Unexpected oasdiff change format/);
    }
  });

  it("rejects invalid resource limits before executing a subprocess", () => {
    for (const n of [0, -1, Infinity, NaN, 1.5]) {
      expect(() => runOasdiff("/before", "/after", { timeoutMs: n })).toThrow(/positive, finite integer/);
      expect(() => runOasdiff("/before", "/after", { maxOutputMib: n })).toThrow(/positive, finite integer/);
    }
    expect(mockedSpawn).not.toHaveBeenCalled();
  });
});
