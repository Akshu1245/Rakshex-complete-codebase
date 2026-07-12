/**
 * Client-side feature flags. Unfinished product routes should be gated here.
 * Server-side flags (admin) remain on featureFlags tRPC router.
 */
export const CLIENT_FLAGS = {
  /** GitHub dashboard sandbox demo mode — never on in production builds */
  githubSandbox: process.env.NEXT_PUBLIC_SANDBOX_MODE === "true",
  /** Research / experimental pages */
  researchLab: process.env.NEXT_PUBLIC_FLAG_RESEARCH === "true",
  /** Control plane UI */
  controlPlane: process.env.NEXT_PUBLIC_FLAG_CONTROL_PLANE !== "false",
} as const;

export function isClientFlagEnabled(flag: keyof typeof CLIENT_FLAGS): boolean {
  return Boolean(CLIENT_FLAGS[flag]);
}
