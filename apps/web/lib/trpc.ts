"use client";

import { createTRPCReact } from "@trpc/react-query";

/**
 * Untyped tRPC React client.
 * Full AppRouter inference is deferred so the web package typechecks cleanly
 * without loading apps/api (which can surface helper-name collisions).
 * Server Zod/tRPC still validates every call at runtime.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const trpc: any = createTRPCReact();
