# AI Account Governance Research

## Product decision

DevPulse models AI access as four separate layers:

1. **Identity and seat**: a human or service identity is assigned access to a team product.
2. **Provider account**: the organization, tenant, cloud account, project, or team that owns the service.
3. **Credential or connection**: a key, OAuth grant, service principal, IAM role, managed identity, SCIM connection, or provider admin token.
4. **Usage and evidence**: gateway telemetry, provider usage APIs, billing exports, invoices, audit logs, or estimates.

A team subscription does not imply an API key. DevPulse must show the access mechanism and evidence source on every account card.

## Verified provider patterns

| Provider               | Admin surface                                                                         | What DevPulse can inventory                                                        | Important limitation                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Azure / Azure OpenAI   | Microsoft Entra OAuth/service principal/managed identity, Azure RBAC, Cost Management | Tenant, subscription, resource, role scope, model resource, usage and cost exports | Billing visibility depends on scope; Cost Details is asynchronous and exports are preferred at scale                  |
| AWS Bedrock            | IAM role, STS, Organizations, CUR 2.0, cost allocation tags                           | Account, region, Bedrock usage, principal/session attribution, cost                | Per-user attribution requires role session names or principal tags; do not treat an AWS account as a key              |
| Google Vertex AI       | Cloud project, service account/workload identity, IAM, Cloud Billing export           | Organization, folder, project, model endpoint, usage and cost                      | Project and billing permissions are separate from model invocation permissions                                        |
| OpenAI API             | Organization, project, service account, project keys, usage/billing admin             | Organization, project, service account, key metadata, usage                        | API usage is project-scoped; data-retention and residency controls have endpoint/provider limitations                 |
| GitHub Copilot         | Organization/enterprise owner, seat APIs, audit log, SCIM/SSO                         | Plan, seats, assignments, policies, last activity where available, billing         | GitHub audit logs do not contain local IDE prompts; that requires a customer-owned telemetry path                     |
| Claude Team/Enterprise | Team organization, member/seat admin, SSO, SCIM, audit exports, invoices              | Plan, seats, members, roles, renewal, billing, policy state                        | Chat access is subscription membership, not an Anthropic API credential; usage varies by plan and export availability |
| Cursor                 | Team dashboard, Admin API, SSO/SCIM, invoices                                         | Members, daily usage, spend, usage events, plan, active seats                      | Admin API credentials are organization-level integration credentials and must be vaulted separately                   |
| Windsurf               | Customer admin export, invoice, SSO/SCIM where contracted                             | Imported subscription, seats, renewal, policy evidence                             | Only verified provider/admin APIs are connected; unsupported values remain imported or estimated                      |

## Connector contract

Every connection records:

- authentication method: OAuth, admin API, SCIM, cloud role, managed identity, invoice, or manual import;
- requested scopes and least-privilege explanation;
- last sync status, timestamp, error, and next retry;
- evidence confidence: verified, imported, estimated, or inferred;
- revocation and deletion behavior;
- data residency and prompt-retention behavior.

The implementation uses `provider_accounts`, `control_plane_credentials`, `ai_subscriptions`, `ai_subscription_seats`, and `control_plane_resources`. `adminCredentialId` is an integration credential, not a developer runtime key.

## Implementation sequence

### Now implemented

- Workspace-scoped provider accounts and encrypted credentials.
- Separate subscription and seat inventory APIs.
- Cloud resource hierarchy inventory.
- Provider capability catalog with explicit limitations.
- Metadata-only local discovery and masked finding ingestion.
- Gateway policy preview with kill switch, provider/model allow lists, budget checks, tool blocking, PII redaction, prompt-injection detection, and no raw prompt persistence.
- Audit events for credential, provider-account, subscription, and seat changes.

### Next production connectors

1. Azure Entra OAuth plus subscription/resource discovery and Cost Management export ingestion.
2. AWS cross-account role assumption plus CUR 2.0 and Bedrock principal-tag attribution.
3. Google Cloud OAuth/workload identity plus project and billing-export ingestion.
4. GitHub App installation for Copilot seat/admin/audit data and SCIM lifecycle events.
5. Anthropic Enterprise/Team admin and audit import workflows.
6. Cursor Admin API connector with admin-key rotation and 90-day usage pagination.
7. Generic invoice/CSV/SCIM import with schema mapping and evidence provenance.

## Sources

- [Azure Cost Management automation](https://learn.microsoft.com/en-us/azure/cost-management-billing/automate/automation-overview)
- [Azure role assignments](https://learn.microsoft.com/en-us/azure/role-based-access-control/role-assignments)
- [AWS Bedrock cost and usage attribution](https://docs.aws.amazon.com/bedrock/latest/userguide/cost-mgmt-iam-principal-tracking.html)
- [OpenAI project service accounts](https://platform.openai.com/docs/api-reference/project-service-accounts)
- [GitHub Copilot seat management](https://docs.github.com/en/rest/copilot/copilot-user-management)
- [GitHub Copilot audit logs](https://docs.github.com/en/copilot/how-tos/administer-copilot/manage-for-enterprise/review-audit-logs)
- [Cursor Admin API](https://docs.cursor.com/en/account/teams/admin-api)
- [Anthropic Team plan administration](https://support.anthropic.com/en/articles/9266767-what-is-the-claude-team-plan)
