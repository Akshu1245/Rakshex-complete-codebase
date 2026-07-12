/**
 * Lightweight AppRouter typing for the web client when full API project
 * references are unavailable. Prefer importing from @server/routers when
 * path mapping resolves.
 */
declare module "@server/routers" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type AppRouter = any;
}
