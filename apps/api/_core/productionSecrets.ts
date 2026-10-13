/** Reject repository-public examples as production JWT/vault credentials. */
const TEMPLATE_SECRET = "replace-with-32-plus-char-random-secret";
const DEV_SECRET = "dev-only-jwt-secret-min-32-chars-rakshex";

export function isSafeProductionSecret(value: string): boolean {
  const secret = value.trim();
  return (
    secret.length >= 32 &&
    secret !== TEMPLATE_SECRET &&
    secret !== DEV_SECRET &&
    !/^(?:replace[-_]|change[-_]?me|placeholder[-_]|your[-_]|dummy[-_])/i.test(secret)
  );
}
