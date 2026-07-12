// Preconfigured storage helpers for Manus WebDev templates
// Uses the Biz-provided storage proxy (Authorization: Bearer <token>)

import { ENV } from "./_core/env";
import { ExternalServiceError, InternalError } from "./_core/errors";
import { fetchWithTimeout } from "./utils/fetchWithTimeout";

const STORAGE_TIMEOUT_MS = 15_000;

type StorageConfig = { baseUrl: string; apiKey: string };

function getStorageConfig(): StorageConfig {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!baseUrl || !apiKey) {
    throw new InternalError(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY",
      {
        safeMessage: "File storage is temporarily unavailable. Please try again shortly.",
      },
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

async function buildDownloadUrl(baseUrl: string, relKey: string, apiKey: string): Promise<string> {
  const downloadApiUrl = new URL("v1/storage/downloadUrl", ensureTrailingSlash(baseUrl));
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetchWithTimeout(downloadApiUrl, {
    method: "GET",
    timeoutMs: STORAGE_TIMEOUT_MS,
    headers: buildAuthHeaders(apiKey),
  });
  return (await response.json()).url;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const segmentStart = relKey.lastIndexOf("/");
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1 || lastDot <= segmentStart) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string,
): FormData {
  // Blob accepts BufferSource at runtime, but DOM lib types are stricter
  // about Buffer (which extends Uint8Array<ArrayBufferLike>) vs the
  // BlobPart union (Uint8Array<ArrayBuffer>). Copy the bytes into a
  // fresh ArrayBuffer so the type is concrete instead of using `as any`.
  let blob: Blob;
  if (typeof data === "string") {
    blob = new Blob([data], { type: contentType });
  } else {
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    blob = new Blob([copy], { type: contentType });
  }
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = appendHashSuffix(normalizeKey(relKey));
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetchWithTimeout(uploadUrl, {
    method: "POST",
    timeoutMs: STORAGE_TIMEOUT_MS,
    headers: buildAuthHeaders(apiKey),
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new ExternalServiceError(
      `Storage upload failed (${response.status} ${response.statusText})`,
      {
        safeMessage: "File upload failed. Please try again.",
        context: {
          provider: "storage-proxy",
          status: response.status,
          message,
        },
      },
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  return {
    key,
    url: await buildDownloadUrl(baseUrl, key, apiKey),
  };
}
