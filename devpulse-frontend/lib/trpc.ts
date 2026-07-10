"use client";

import { createTRPCReact } from "@trpc/react-query";

// The hosted Next.js app is built independently from the Node API. Keep this
// client boundary structural so Vercel does not need to compile server-only
// router types (which also prevents tRPC hook-name collisions across versions).
export const trpc = createTRPCReact<any>();
