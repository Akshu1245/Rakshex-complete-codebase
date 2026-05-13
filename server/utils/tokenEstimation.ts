/**
 * Content-aware token-count estimation.
 *
 * Inspired by Claude Code's `services/tokenEstimation.ts::bytesPerTokenForFileType`.
 * The rationale, copied over from their comments: dense JSON has a lot of
 * single-character structural tokens (`{`, `}`, `:`, `,`, `"`) so the real
 * bytes-per-token ratio is closer to 2, not the usual 4 for prose/code.
 *
 * For DevPulse specifically: API-scan payloads are mostly JSON, and token
 * analytics previously applied a flat 4:1 ratio that systematically
 * underestimated cost for heavy-JSON users. Using this helper in
 * `tokenAnalytics.estimateCost` tightens the estimate by ~40% on JSON bodies.
 */

/**
 * Returns an estimated bytes-per-token ratio for a given file extension /
 * content kind. Callers should pass the extension without the leading dot
 * (e.g. "json", "md", "ts"), lowercased — but we accept a few synonyms.
 */
export function bytesPerTokenForFileType(
  fileExtensionOrMime: string
): number {
  const ext = fileExtensionOrMime
    .toLowerCase()
    .replace(/^\./, "")
    .replace(/^application\//, "")
    .replace(/^text\//, "");

  switch (ext) {
    // Dense, structural content — lots of punctuation, short keys, no prose.
    case "json":
    case "jsonl":
    case "jsonc":
    case "ndjson":
    case "yaml":
    case "yml":
    case "toml":
    case "xml":
    case "html":
    case "csv":
      return 2;

    // Source code: moderate density, short identifiers but longer than JSON
    // and with prose comments. 3 is a good middle-ground.
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
    case "py":
    case "go":
    case "rs":
    case "java":
    case "rb":
    case "php":
    case "c":
    case "cpp":
    case "cs":
      return 3;

    // Prose / markdown / plain text — Anthropic's rule of thumb of ~4 bytes
    // per token holds.
    default:
      return 4;
  }
}

/**
 * Rough token-count estimate for a string, using a content-type-aware
 * bytes-per-token ratio when we know the kind of content we're counting.
 * Cheap, synchronous, no API round-trip.
 */
export function roughTokenCountEstimation(
  content: string,
  fileExtensionOrMime?: string
): number {
  const bytesPerToken = fileExtensionOrMime
    ? bytesPerTokenForFileType(fileExtensionOrMime)
    : 4;
  return Math.round(content.length / bytesPerToken);
}

/**
 * Estimate cost for a content string given a per-1M-token price. Returns
 * `{ tokens, costUSD }`. Cost is always returned as a number (not formatted)
 * so callers can aggregate across many estimates.
 */
export function estimateCostForContent(
  content: string,
  pricePer1MTokens: number,
  fileExtensionOrMime?: string
): { tokens: number; costUSD: number } {
  const tokens = roughTokenCountEstimation(content, fileExtensionOrMime);
  const costUSD = (tokens / 1_000_000) * pricePer1MTokens;
  return { tokens, costUSD };
}
