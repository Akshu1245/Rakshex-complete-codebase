// OpenNext Cloudflare adapter config — keep minimal on purpose.
// No R2 incremental cache: marketing pages are SSG (served as static assets),
// dashboard pages are client-rendered shells fed by the API worker. If ISR or
// fetch-cache persistence is ever needed, add r2IncrementalCache here and the
// matching bucket binding in wrangler.toml.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
