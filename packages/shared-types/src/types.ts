/**
 * Shared app-level types.
 * Database table types: import from `@rakshex/database` directly.
 * TODO(foundation): re-export DB types once packages use composite project references.
 */

export type JsonObject = Record<string, unknown>;

export type Severity = "Critical" | "High" | "Medium" | "Low";
