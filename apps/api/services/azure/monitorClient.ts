/**
 * Azure Monitor client.
 * Queries activity logs, cost data, and usage metrics.
 */
import { getAzureCredential } from "./index";
import { logger } from "../../_core/logger";

export interface MonitorCostData {
  subscriptionId: string;
  date: string;
  costUsd: number;
  currency: string;
  serviceName?: string;
  resourceType?: string;
}

export class AzureMonitorClient {
  private static armBase = "https://management.azure.com";
  private static costBase = "https://management.azure.com/subscriptions";

  /**
   * Query Azure Monitor for cost data in a date range.
   */
  static async queryCosts(
    subscriptionId: string,
    fromDate: string,
    toDate: string,
    tenantId?: string,
  ): Promise<{ costs: MonitorCostData[]; error?: string }> {
    try {
      const credential = getAzureCredential(tenantId);
      const token = await credential.getToken("https://management.azure.com/.default");
      if (!token) return { costs: [], error: "No token" };

      const headers = {
        Authorization: `Bearer ${token.token}`,
        "Content-Type": "application/json",
      };
      const url = `${this.costBase}/${subscriptionId}/providers/Microsoft.CostManagement/query?api-version=2023-03-01`;

      const body = {
        type: "ActualCost",
        timeframe: "Custom",
        timePeriod: { from: fromDate, to: toDate },
        dataset: {
          granularity: "Daily",
          aggregation: { totalCost: { name: "Cost", function: "Sum" } },
          grouping: [{ type: "Dimension", name: "ServiceName" }],
        },
      };

      const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
      if (!response.ok) return { costs: [], error: `Cost API error: ${response.status}` };

      const data = (await response.json()) as { properties?: { rows?: unknown[][] } };
      const rows = data.properties?.rows ?? [];
      const costs: MonitorCostData[] = rows.map((r: unknown[]) => ({
        subscriptionId,
        date: String(r[0] ?? ""),
        costUsd: Number(r[1] ?? 0),
        currency: "USD",
        serviceName: String(r[2] ?? ""),
      }));

      return { costs };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err, subscriptionId }, "[AzureMonitor] Cost query failed");
      return { costs: [], error: msg };
    }
  }

  /**
   * Query Azure Monitor for API Management gateway usage.
   */
  static async queryApiUsage(
    subscriptionId: string,
    resourceGroup: string,
    serviceName: string,
    tenantId?: string,
  ): Promise<{ requestCount: number; error?: string }> {
    try {
      const credential = getAzureCredential(tenantId);
      const token = await credential.getToken("https://management.azure.com/.default");
      if (!token) return { requestCount: 0, error: "No token" };

      const headers = { Authorization: `Bearer ${token.token}` };
      const timespan = encodeURIComponent("PT24H");
      const metricNames = encodeURIComponent("Requests,TotalRequests");
      const url = `${this.armBase}/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.ApiManagement/service/${serviceName}/providers/Microsoft.Insights/metrics?api-version=2021-05-01&timespan=${timespan}&metricnames=${metricNames}`;

      const response = await fetch(url, { headers });
      if (!response.ok) return { requestCount: 0, error: `Metrics error: ${response.status}` };

      const data = (await response.json()) as {
        value?: Array<{ timeseries?: Array<{ data?: Array<{ total?: number }> }> }>;
      };
      let total = 0;
      for (const metric of data.value ?? []) {
        for (const ts of metric.timeseries ?? []) {
          for (const dp of ts.data ?? []) {
            total += dp.total ?? 0;
          }
        }
      }

      return { requestCount: total };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { requestCount: 0, error: msg };
    }
  }
}
