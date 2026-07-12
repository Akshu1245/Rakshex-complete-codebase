/**
 * Azure API Management client.
 * Discovers APIs, subscription keys, and named values.
 */
import { getAzureCredential } from "./index";
import { logger } from "../../_core/logger";

export interface ApimSubscription {
  id: string;
  name: string;
  scope: string;
  userId?: string;
  productId?: string;
  state: string;
  createdDate?: string;
  expirationDate?: string;
  // The key value is obtained on explicit request only
}

export interface ApimNamedValue {
  id: string;
  displayName: string;
  secret: boolean;
  tags?: string[];
}

export interface ApimDiscoveryResult {
  subscriptionId: string;
  resourceGroup: string;
  serviceName: string;
  subscriptions: ApimSubscription[];
  namedValues: ApimNamedValue[];
  error?: string;
}

export class AzureApiManagementClient {
  private static armBase = "https://management.azure.com";

  /**
   * List all API Management services in a subscription.
   */
  static async listServices(
    subscriptionId: string,
    tenantId?: string,
  ): Promise<{ name: string; resourceGroup: string }[]> {
    try {
      const credential = getAzureCredential(tenantId);
      const token = await credential.getToken("https://management.azure.com/.default");
      if (!token) return [];

      const headers = { Authorization: `Bearer ${token.token}` };
      const url = `${this.armBase}/subscriptions/${subscriptionId}/providers/Microsoft.ApiManagement/service?api-version=2022-08-01`;
      const response = await fetch(url, { headers });
      if (!response.ok) return [];

      const data = (await response.json()) as { value: Array<{ name: string; id: string }> };
      return data.value.map((svc) => {
        const parts = svc.id.split("/");
        const rgIndex = parts.indexOf("resourceGroups");
        return { name: svc.name, resourceGroup: rgIndex >= 0 ? parts[rgIndex + 1] : "" };
      });
    } catch (err) {
      logger.error({ err }, "[AzureAPIM] List services failed");
      return [];
    }
  }

  /**
   * Discover subscription keys and named values in an APIM instance.
   */
  static async discover(
    subscriptionId: string,
    resourceGroup: string,
    serviceName: string,
    tenantId?: string,
  ): Promise<ApimDiscoveryResult> {
    try {
      const credential = getAzureCredential(tenantId);
      const token = await credential.getToken("https://management.azure.com/.default");
      if (!token)
        return {
          subscriptionId,
          resourceGroup,
          serviceName,
          subscriptions: [],
          namedValues: [],
          error: "No token",
        };

      const headers = {
        Authorization: `Bearer ${token.token}`,
        "Content-Type": "application/json",
      };
      const baseUrl = `${this.armBase}/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.ApiManagement/service/${serviceName}`;

      // Fetch subscriptions
      const subsResp = await fetch(`${baseUrl}/subscriptions?api-version=2022-08-01`, { headers });
      const subscriptions: ApimSubscription[] = [];
      if (subsResp.ok) {
        const subsData = (await subsResp.json()) as { value: Array<Record<string, unknown>> };
        for (const s of subsData.value as Array<Record<string, unknown>>) {
          const props = s.properties as Record<string, unknown> | undefined;
          subscriptions.push({
            id: s.name as string,
            name: (s.name as string) ?? "",
            scope: (props?.scope as string) ?? "",
            userId: props?.ownerId as string | undefined,
            state: (props?.state as string) ?? "unknown",
            createdDate: props?.createdDate as string | undefined,
            expirationDate: props?.expirationDate as string | undefined,
          });
        }
      }

      // Fetch named values (keys stored in APIM)
      const nvResp = await fetch(`${baseUrl}/namedValues?api-version=2022-08-01`, { headers });
      const namedValues: ApimNamedValue[] = [];
      if (nvResp.ok) {
        const nvData = (await nvResp.json()) as { value: Array<Record<string, unknown>> };
        for (const nv of nvData.value as Array<Record<string, unknown>>) {
          const props = nv.properties as Record<string, unknown> | undefined;
          namedValues.push({
            id: nv.name as string,
            displayName: (props?.displayName as string) ?? "",
            secret: (props?.secret as boolean) ?? false,
            tags: props?.tags as string[] | undefined,
          });
        }
      }

      logger.info(
        { serviceName, subsCount: subscriptions.length, nvCount: namedValues.length },
        "[AzureAPIM] Discovery complete",
      );
      return { subscriptionId, resourceGroup, serviceName, subscriptions, namedValues };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err, serviceName }, "[AzureAPIM] Discovery failed");
      return {
        subscriptionId,
        resourceGroup,
        serviceName,
        subscriptions: [],
        namedValues: [],
        error: msg,
      };
    }
  }
}
