/**
 * API documentation router (Sprint 6 / Domain 4).
 *
 * Surfaces the live OpenAPI 3.0 spec for the running tRPC `appRouter`.
 * The frontend `/api-docs` page calls `apiDocs.spec` to render the
 * full surface in a Swagger-style explorer; `apiDocs.summary` powers
 * the home-page widget that shows "X procedures across Y domains."
 *
 * Why a registration callback instead of `import("../routers")`:
 *  - The appRouter's type closes over every router in the app, including
 *    this one. A direct import — even a dynamic one — pulls the
 *    appRouter type into apiDocs.ts, which then makes the appRouter
 *    type recursive and breaks tRPC's react-query type inference.
 *  - Instead, `routers.ts` calls `setAppRouterForDocs(appRouter)` after
 *    constructing it. No type cycle, no runtime cycle.
 */

import type { AnyTRPCRouter } from "@trpc/server";
import { z } from "zod";

import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { buildOpenApiSpec, type OpenApiSpec } from "../services/openapiGenerator";

let registeredRouter: AnyTRPCRouter | null = null;
let cachedSpec: { origin: string; spec: OpenApiSpec; expiresAt: number } | null = null;
const SPEC_TTL_MS = 60_000;

/** Called once from routers.ts after the appRouter is built. */
export function setAppRouterForDocs(r: AnyTRPCRouter): void {
  registeredRouter = r;
  cachedSpec = null;
}

/**
 * Public root procedures that don't require auth even though their
 * `protectedProcedure` ancestors are flagged as protected. Keep this
 * list short — anything not here is documented as auth-required.
 */
const PUBLIC_PATHS = new Set<string>([
  "auth.me",
  "auth.logout",
  "auth.signup",
  "auth.login",
  "auth.requestPasswordReset",
  "auth.resetPassword",
  "system.health",
  "apiDocs.spec",
  "apiDocs.summary",
]);

function specForOrigin(origin: string): OpenApiSpec {
  if (!registeredRouter) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "apiDocs router has not been registered with the appRouter",
    });
  }
  const now = Date.now();
  if (cachedSpec && cachedSpec.origin === origin && now < cachedSpec.expiresAt) {
    return cachedSpec.spec;
  }
  const spec = buildOpenApiSpec(registeredRouter, {
    title: "Ojas Security API",
    version: "1.0.0",
    description:
      "Live OpenAPI 3.0 spec generated from the running tRPC router. " +
      "Every procedure is JSON-over-HTTP. Queries (GET) take input as " +
      "a URL-encoded JSON parameter; mutations (POST) take JSON " +
      "request bodies. Auth is via session cookie issued by /auth/login.",
    serverUrl: origin,
    publicPaths: PUBLIC_PATHS,
  });
  cachedSpec = { origin, spec, expiresAt: now + SPEC_TTL_MS };
  return spec;
}

export const apiDocsRouter = router({
  /** Full OpenAPI 3.0 spec, cached per-origin for 60 s. */
  spec: publicProcedure
    .input(z.object({ serverUrl: z.string().url().optional() }).optional())
    .query(({ input, ctx }) => {
      const origin = input?.serverUrl ?? `${ctx.req.protocol}://${ctx.req.get("host")}`;
      return specForOrigin(origin);
    }),

  /** Lightweight summary for the dashboard home-page widget. */
  summary: publicProcedure.query(({ ctx }) => {
    const origin = `${ctx.req.protocol}://${ctx.req.get("host")}`;
    const spec = specForOrigin(origin);
    const byTag = new Map<string, { queries: number; mutations: number }>();
    for (const ops of Object.values(spec.paths)) {
      for (const [method, op] of Object.entries(ops)) {
        const tag = op.tags[0] ?? "general";
        const slot = byTag.get(tag) ?? { queries: 0, mutations: 0 };
        if (method === "get") slot.queries++;
        else slot.mutations++;
        byTag.set(tag, slot);
      }
    }
    const totalProcedures = Array.from(byTag.values()).reduce(
      (sum, s) => sum + s.queries + s.mutations,
      0,
    );
    return {
      totalProcedures,
      domains: Array.from(byTag.entries())
        .map(([tag, counts]) => ({ tag, ...counts }))
        .sort((a, b) => b.queries + b.mutations - (a.queries + a.mutations)),
    };
  }),
});
