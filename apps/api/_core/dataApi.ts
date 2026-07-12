/**
 * Quick example (matches curl usage):
 *   await callDataApi("Youtube/search", {
 *     query: { gl: "US", hl: "en", q: "manus" },
 *   })
 */
import { ENV } from "./env";
import { ExternalServiceError, InternalError } from "./errors";
import { fetchWithTimeout } from "../utils/fetchWithTimeout";

const DATA_API_TIMEOUT_MS = 10_000;

export type DataApiCallOptions = {
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  pathParams?: Record<string, unknown>;
  formData?: Record<string, unknown>;
};

export async function callDataApi(
  apiId: string,
  options: DataApiCallOptions = {},
): Promise<unknown> {
  if (!ENV.forgeApiUrl) {
    throw new InternalError("BUILT_IN_FORGE_API_URL is not configured", {
      safeMessage: "This data source is temporarily unavailable.",
    });
  }
  if (!ENV.forgeApiKey) {
    throw new InternalError("BUILT_IN_FORGE_API_KEY is not configured", {
      safeMessage: "This data source is temporarily unavailable.",
    });
  }

  // Build the full URL by appending the service path to the base URL
  const baseUrl = ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;
  const fullUrl = new URL("webdevtoken.v1.WebDevService/CallApi", baseUrl).toString();

  const response = await fetchWithTimeout(fullUrl, {
    method: "POST",
    timeoutMs: DATA_API_TIMEOUT_MS,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "connect-protocol-version": "1",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify({
      apiId,
      query: options.query,
      body: options.body,
      path_params: options.pathParams,
      multipart_form_data: options.formData,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new ExternalServiceError(
      `Data API request failed (${response.status} ${response.statusText})`,
      {
        safeMessage: "Upstream data source request failed. Please try again.",
        context: {
          provider: "data-api",
          apiId,
          status: response.status,
          statusText: response.statusText,
          detail,
        },
      },
    );
  }

  const payload = await response.json().catch(() => ({}));
  if (payload && typeof payload === "object" && "jsonData" in payload) {
    try {
      return JSON.parse((payload as Record<string, string>).jsonData ?? "{}");
    } catch {
      return (payload as Record<string, unknown>).jsonData;
    }
  }
  return payload;
}
