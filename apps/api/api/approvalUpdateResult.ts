/** Drizzle/pg may return either rows directly or a QueryResult with rows/rowCount. */
export function affectedApprovalCount(result: unknown): number {
  if (Array.isArray(result)) return result.length;
  if (result && typeof result === "object") {
    const r = result as { rows?: unknown; rowCount?: unknown };
    if (Array.isArray(r.rows)) return r.rows.length;
    if (typeof r.rowCount === "number" && Number.isInteger(r.rowCount)) return r.rowCount;
  }
  return 0;
}
