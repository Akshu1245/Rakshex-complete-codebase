/**
 * Standalone Keep-Alive Pinger for Render Free Tier Web Services.
 * Pings the backend health check endpoint every 5 minutes to prevent sleep.
 * 
 * Usage:
 *   node scripts/keep-alive-pinger.mjs
 */

import https from "node:https";

const BACKEND_URL = process.env.BACKEND_URL || "https://rakshex-backend.onrender.com/api/health/live";
const INTERVAL_MS = (parseInt(process.env.PING_INTERVAL_MINUTES || "5", 10)) * 60 * 1000;

function ping() {
  const time = new Date().toISOString();
  console.log(`[${time}] Sending keep-alive ping to: ${BACKEND_URL}`);

  https
    .get(BACKEND_URL, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        console.log(`[${time}] Response Status: ${res.statusCode} — ${data.trim()}`);
      });
    })
    .on("error", (err) => {
      console.error(`[${time}] Ping failed: ${err.message}`);
    });
}

// Initial ping
ping();

// Recurring ping interval
setInterval(ping, INTERVAL_MS);
console.log(`Keep-Alive Pinger running every ${INTERVAL_MS / 60000} minutes.`);
