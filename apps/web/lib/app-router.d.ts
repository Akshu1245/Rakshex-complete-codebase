/**
 * Lightweight AppRouter typing for the web client when full API project
 * references are unavailable. Prefer importing from @server/routers when
 * path mapping resolves.
 */
declare module "@server/routers" {
  export type AppRouter = any;
}
