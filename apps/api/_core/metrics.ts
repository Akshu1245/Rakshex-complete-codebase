import { Counter, Gauge, Histogram, Registry } from "prom-client";

export const register = new Registry();

register.setDefaultLabels({
  app: "rakshex",
});

export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status"],
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status"],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10],
  registers: [register],
});

export const scanExecutionsTotal = new Counter({
  name: "scan_executions_total",
  help: "Total number of scan executions",
  labelNames: ["scanType", "status"],
  registers: [register],
});

export const activeUsersGauge = new Gauge({
  name: "active_users",
  help: "Number of currently active users",
  registers: [register],
});

export const tokenUsageCounter = new Counter({
  name: "token_usage_total",
  help: "Total token usage",
  // No userId label — high-cardinality identity labels explode series count
  // and risk leaking tenant identifiers via Prometheus.
  labelNames: ["model"],
  registers: [register],
});

export const findingsCounter = new Counter({
  name: "findings_total",
  help: "Total number of security findings",
  labelNames: ["severity"],
  registers: [register],
});

export function incrementHttpRequest(method: string, route: string, status: number) {
  httpRequestsTotal.inc({ method, route, status: status.toString() });
}

export function observeHttpRequestDuration(
  method: string,
  route: string,
  status: number,
  duration: number,
) {
  httpRequestDuration.observe({ method, route, status: status.toString() }, duration);
}

export function incrementScanExecution(scanType: string, status: string) {
  scanExecutionsTotal.inc({ scanType, status });
}

export function setActiveUsers(count: number) {
  activeUsersGauge.set(count);
}

export function incrementTokenUsage(model: string, _userId?: number) {
  tokenUsageCounter.inc({ model });
}

export function incrementFindings(severity: string, _collectionId?: string) {
  findingsCounter.inc({ severity });
}
