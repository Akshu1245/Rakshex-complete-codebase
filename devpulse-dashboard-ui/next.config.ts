import type { NextConfig } from "next";

// Local development uses the Python server on loopback. Cloudflare Workers
// cannot reach the developer's 127.0.0.1 and do not support this Next.js
// rewrite as a secure, authenticated WebSocket bridge.
// Do not install /ws proxy rewrites in production until a reviewed, dedicated
// Worker proxy or verified upstream backend has been implemented.
const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    if (process.env.NODE_ENV === "production") return [];
    const devBackend = (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
    const target = new URL(devBackend);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
        !["http:", "https:"].includes(target.protocol) ||
        target.username || target.password || target.search || target.hash ||
        target.pathname !== "/") {
      // Fail closed rather than forwarding WebSocket credentials to arbitrary hosts.
      return [];
    }
    return [{ source: "/ws/:path*", destination: `${target.origin}/ws/:path*` }];
  },
};
export default nextConfig;
