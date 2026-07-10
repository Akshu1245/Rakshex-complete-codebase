import { router } from "../../_core/trpc";
import { enterpriseAzureRouter } from "./azureConnections";
import { enterpriseDiscoveryRouter } from "./discovery";
import {
  enterpriseOverprivilegedRouter,
  enterpriseShadowKeysRouter,
  enterpriseAgentGuardRouter,
  enterpriseKeyRotationRouter,
} from "./security";
import { enterpriseCopilotRouter } from "./copilot";
import { enterpriseComplianceRouter } from "./compliance";

export const enterpriseRouter = router({
  azure: enterpriseAzureRouter,
  discovery: enterpriseDiscoveryRouter,
  overprivileged: enterpriseOverprivilegedRouter,
  shadowKeys: enterpriseShadowKeysRouter,
  agentGuard: enterpriseAgentGuardRouter,
  keyRotation: enterpriseKeyRotationRouter,
  copilot: enterpriseCopilotRouter,
  compliance: enterpriseComplianceRouter,
});
