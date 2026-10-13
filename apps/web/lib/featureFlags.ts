/**
 * Client-side feature flags. Unfinished product routes should be gated here.
 * Server-side flags (admin) remain on featureFlags tRPC router.
 */
export const CLIENT_FLAGS = {
  /** Research / experimental pages */
  researchLab: process.env.NEXT_PUBLIC_FLAG_RESEARCH === "true",
  /** Control plane UI */
  controlPlane: process.env.NEXT_PUBLIC_FLAG_CONTROL_PLANE !== "false",
} as const;

export function isClientFlagEnabled(flag: keyof typeof CLIENT_FLAGS): boolean {
  return Boolean(CLIENT_FLAGS[flag]);
}
