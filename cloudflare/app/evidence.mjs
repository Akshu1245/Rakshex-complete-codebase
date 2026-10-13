export function canonical(value) {
  if (Array.isArray(value)) return JSON.stringify(value.map((item) => JSON.parse(canonical(item))));
  if (value && typeof value === "object")
    return JSON.stringify(
      Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, JSON.parse(canonical(value[key]))]),
      ),
    );
  return JSON.stringify(value);
}
export async function sha256(value) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((n) => n.toString(16).padStart(2, "0")).join("");
}
export async function signReceipt(material, env) {
  if (!env.RECEIPT_PRIVATE_KEY || !env.RECEIPT_PUBLIC_PEM || !env.RECEIPT_KEY_ID)
    throw new Error("Signing unavailable");
  const key = await crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(atob(env.RECEIPT_PRIVATE_KEY), (c) => c.charCodeAt(0)),
    { name: "Ed25519" },
    false,
    ["sign"],
  );
  const entryHash = await sha256(canonical(material));
  const hashBytes = Uint8Array.from(entryHash.match(/../g), (s) => parseInt(s, 16));
  const signature = await crypto.subtle.sign("Ed25519", key, hashBytes);
  return {
    ...material,
    entryHash,
    signingKeyId: env.RECEIPT_KEY_ID,
    signingAlgorithm: "ed25519",
    signature: btoa(String.fromCharCode(...new Uint8Array(signature))),
    publicKeyPem: env.RECEIPT_PUBLIC_PEM,
  };
}
