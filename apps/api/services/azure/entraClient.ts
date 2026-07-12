/**
 * Azure Entra ID (Microsoft Graph) client.
 * Discovers service principals, managed identities, app registrations, and group memberships.
 */
import { getAzureCredential } from "./index";
import { logger } from "../../_core/logger";

export interface ServicePrincipal {
  id: string;
  appId: string;
  displayName: string;
  type: "application" | "managedIdentity" | "legacy";
  enabled: boolean;
  roles: string[];
  scopes: string[];
  keyCredentials: { id: string; startDate?: string; endDate?: string; type: string }[];
  passwordCredentials: { id: string; startDate?: string; endDate?: string; displayName?: string }[];
}

export interface EntraGroup {
  id: string;
  displayName: string;
  description?: string;
  memberCount: number;
}

export class AzureEntraClient {
  private static graphBase = "https://graph.microsoft.com/v1.0";

  /**
   * Fetch all service principals and managed identities.
   * Uses Microsoft Graph API directly (no dedicated SDK needed).
   */
  static async discoverServicePrincipals(
    tenantId: string,
  ): Promise<{ principals: ServicePrincipal[]; error?: string }> {
    try {
      const credential = getAzureCredential(tenantId);
      const token = await credential.getToken("https://graph.microsoft.com/.default");
      if (!token) return { principals: [], error: "Failed to acquire Graph token" };

      const headers = {
        Authorization: `Bearer ${token.token}`,
        "Content-Type": "application/json",
      };

      // Fetch service principals with their app roles and credentials
      const response = await fetch(
        `${this.graphBase}/servicePrincipals?$top=999&$select=id,appId,displayName,appRoles,keyCredentials,passwordCredentials,accountEnabled`,
        { headers },
      );
      if (!response.ok) return { principals: [], error: `Graph API error: ${response.status}` };

      const data = (await response.json()) as { value: unknown[] };
      const principals: ServicePrincipal[] = data.value.map((sp: Record<string, unknown>) => ({
        id: sp.id as string,
        appId: sp.appId as string,
        displayName: sp.displayName as string,
        type: "application",
        enabled: (sp.accountEnabled as boolean) ?? true,
        roles: (sp.appRoles as Array<{ value: string }> | undefined)?.map((r) => r.value) ?? [],
        scopes: [],
        keyCredentials:
          (sp.keyCredentials as Array<{
            id: string;
            startDate?: string;
            endDate?: string;
            type: string;
          }>) ?? [],
        passwordCredentials:
          (sp.passwordCredentials as Array<{
            id: string;
            startDate?: string;
            endDate?: string;
            displayName?: string;
          }>) ?? [],
      }));

      logger.info({ count: principals.length }, "[AzureEntra] SP discovery complete");
      return { principals };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err }, "[AzureEntra] SP discovery failed");
      return { principals: [], error: msg };
    }
  }

  /**
   * Fetch Azure AD groups.
   */
  static async discoverGroups(tenantId: string): Promise<{ groups: EntraGroup[]; error?: string }> {
    try {
      const credential = getAzureCredential(tenantId);
      const token = await credential.getToken("https://graph.microsoft.com/.default");
      if (!token) return { groups: [], error: "Failed to acquire Graph token" };

      const headers = { Authorization: `Bearer ${token.token}` };
      const response = await fetch(
        `${this.graphBase}/groups?$top=999&$select=id,displayName,description`,
        { headers },
      );
      if (!response.ok) return { groups: [], error: `Graph API error: ${response.status}` };

      const data = (await response.json()) as { value: unknown[] };
      const groups: EntraGroup[] = [];

      // For each group, get member count
      for (const g of data.value as Array<Record<string, unknown>>) {
        const memResp = await fetch(`${this.graphBase}/groups/${g.id}/members/$count`, {
          headers,
          method: "GET",
        });
        const memberCount = memResp.ok ? parseInt(await memResp.text(), 10) : 0;
        groups.push({
          id: g.id as string,
          displayName: g.displayName as string,
          description: g.description as string | undefined,
          memberCount,
        });
      }

      return { groups };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { groups: [], error: msg };
    }
  }
}
