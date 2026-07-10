"use client";

import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@server/routers";

// Keep the client API type-safe: control-plane access must stay workspace
// scoped, and tRPC catches accidental procedure and payload mismatches here.
export const trpc = createTRPCReact<AppRouter>();
