"use client";

import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@server/routers";

// Typed against the real backend AppRouter. The frontend tsconfig has
// `@server/*` and `@shared/*` path aliases pointing at the sibling
// server/shared trees so this `import type` can resolve. With
// `skipLibCheck: true` and `import type`, this stays type-only and does
// not pull server runtime code into the Next bundle.
export const trpc = createTRPCReact<AppRouter>();
