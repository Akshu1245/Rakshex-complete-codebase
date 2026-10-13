/**
 * Optional oasdiff adapter for broader offline OpenAPI compatibility checks.
 * Requires a separately installed, trusted oasdiff executable on PATH.
 *
 * Important: never pass URLs, shell commands, or default external-ref loading
 * to this subprocess. The caller validates both inputs as local documents.
 */
import { spawnSync } from "node:child_process";

export interface OasdiffChange {
  id: string;
  level: number;
  operation?: string;
  path?: string;
  text?: string;
}

export interface OasdiffReport {
  engine: "oasdiff";
  breaking: boolean;
  changes: OasdiffChange[];
  scope: string;
}

function normalizeChanges(value: unknown): OasdiffChange[] {
  const candidate = Array.isArray(value)
    ? value
    : value === null
      ? []
      : value &&
          typeof value === "object" &&
          Array.isArray((value as { breaking?: unknown }).breaking)
        ? (value as { breaking: unknown[] }).breaking
        : null;
  if (!candidate)
    throw new Error("Unexpected oasdiff JSON output; no compatibility verdict issued.");
  return candidate.map((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      typeof (item as OasdiffChange).id !== "string" ||
      typeof (item as OasdiffChange).level !== "number"
    ) {
      throw new Error("Unexpected oasdiff change format; no compatibility verdict issued.");
    }
    const change = item as OasdiffChange;
    return {
      id: change.id,
      level: change.level,
      ...(typeof change.operation === "string" ? { operation: change.operation } : {}),
      ...(typeof change.path === "string" ? { path: change.path } : {}),
      ...(typeof change.text === "string" ? { text: change.text } : {}),
    };
  });
}

export function runOasdiff(beforeFile: string, afterFile: string): OasdiffReport {
  const processResult = spawnSync(
    "oasdiff",
    [
      "breaking",
      "--format",
      "json",
      "--fail-on",
      "WARN",
      "--allow-external-refs=false",
      "--",
      beforeFile,
      afterFile,
    ],
    {
      encoding: "utf8",
      timeout: 30_000,
      maxBuffer: 5 * 1024 * 1024,
      shell: false,
      windowsHide: true,
    },
  );

  if (processResult.error) {
    const code = (processResult.error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error("oasdiff executable not found. Install oasdiff and place it on PATH.");
    }
    throw new Error("oasdiff failed to execute (timeout, resource limit, or process error).");
  }
  if (processResult.status !== 0 && processResult.status !== 1) {
    // Do not expose stderr: parsers can echo potentially confidential specification text.
    throw new Error("oasdiff comparison failed; check local documents and installed version.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(processResult.stdout.trim() || "null");
  } catch {
    throw new Error("oasdiff returned invalid JSON; no compatibility verdict issued.");
  }

  const changes = normalizeChanges(parsed);
  const breaking = changes.length > 0;
  if (breaking !== (processResult.status === 1)) {
    throw new Error("oasdiff output and exit status disagree; no compatibility verdict issued.");
  }

  return {
    engine: "oasdiff",
    breaking,
    changes,
    scope:
      "oasdiff ERR/WARN contract checks; offline local input with external references disabled. A clean result does NOT prove runtime compatibility or cover undocumented behavior.",
  };
}
