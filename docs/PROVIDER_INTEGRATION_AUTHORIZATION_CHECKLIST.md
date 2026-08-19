# RaksHex Provider Integration Authorization Checklist

## The operating rule

RaksHex never bypasses a provider. It operates in one of three explicit modes:

| Mode                               | What RaksHex receives                                                                                              | What it can truthfully do                                                                                                                  | What it cannot do                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inventory or import                | A manual record, CSV, invoice, or approved export                                                                  | Track declared seats, plans, and imported usage with the `imported` confidence label                                                       | Claim live provider usage, revoke provider credentials, or stop direct traffic                                                                      |
| Authorized provider administration | A customer administrator’s scoped provider key, OAuth grant, or cloud role                                         | Synchronize only the provider data granted by that permission, and expose provider native controls only when actually implemented          | Inspect local application traffic or block the next request unless traffic is routed through RaksHex                                                |
| RaksHex routed gateway             | A provider inference credential held encrypted by RaksHex plus applications configured to use the RaksHex endpoint | Evaluate, reserve budget, audit, and reject a new routed request before it reaches the provider; activate a scoped stop for routed traffic | Stop applications that call the provider directly, discover keys not supplied or scanned in authorized sources, or replace provider billing records |

## Customer setup: first supported live provider

### OpenAI API Platform

An OpenAI organization administrator performs two distinct actions. They are deliberately separate because an administration key is not an inference key.

| Step                        | Customer action                                                                                                                                                                         | RaksHex action                                                                                                                                                                                                 | Result                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1. Authorize administration | Create a restricted OpenAI Admin API key from the organization administration area and paste it in **OpenAI administration**.                                                           | Validate it against OpenAI before storing; encrypt and fingerprint it; retain no plaintext; ingest organization users, daily project usage, and daily USD cost only after the operator starts sync.            | Verified administrative telemetry readiness.                   |
| 2. Route inference          | Create a dedicated OpenAI inference key for the workloads RaksHex should control. Configure the application to call RaksHex’s OpenAI compatible gateway with its RaksHex workspace key. | Encrypt and rotate the inference credential; evaluate policy and budget before the upstream call; add action and request evidence; reject the next routed request when a hard budget or scoped stop is active. | Immediate RaksHex enforcement for the routed application path. |
| 3. Configure response       | Set the hard routed budget and test the workspace stop in a non production path before rollout.                                                                                         | Reserve budget before upstream execution and reject future RaksHex routed calls if the projected spend crosses the configured limit.                                                                           | A proven emergency control, not a dashboard only alert.        |

> An OpenAI API Platform Admin API connection is not the same thing as a ChatGPT Team or Business subscription. Where a team product does not provide an authorized administration integration, RaksHex starts with an export or inventory record and labels it as such.

### OpenRouter and other OpenAI compatible APIs

OpenRouter is now the second supported routed path. The customer supplies a dedicated OpenRouter key in **Connect OpenRouter to the gateway**. RaksHex validates the key against OpenRouter before encrypting it, stores no returned plaintext, and configures the account with the fixed public OpenRouter API base URL. The customer then points the selected application to the RaksHex OpenAI compatible gateway and supplies its RaksHex workspace key. This gives RaksHex immediate pre request budget and scoped stop enforcement because it is in the request path.

OpenRouter reported remaining credit is provider data returned during authorized key validation. It is useful operating context, but it is not RaksHex calculated spend and it does not replace the RaksHex routed hard budget. Direct OpenRouter calls made outside RaksHex remain outside RaksHex control.

### Azure OpenAI

The operator first records the customer selected Azure subscription or resource group in **Record the authorized Azure control scope**. This is a readiness record, not an Azure connection. The customer Azure administrator then registers or approves a dedicated RaksHex service principal and assigns only the needed scoped roles, including **Cognitive Services OpenAI User** for authorized resource access and **Cost Management Reader** for reported cost visibility. If the customer chooses Azure API Management as the control point, they also grant the narrowly scoped API Management access required for that implementation.

Telemetry can use Azure Cost Management and API Management data only after those customer approved scopes are connected. Enforcement requires Azure API Management or the RaksHex gateway in front of the actual inference endpoint. Direct Azure calls remain outside RaksHex control.

### Anthropic API and Claude Enterprise

For an API organization, a customer organization administrator must grant the documented Admin API key or an `org:admin` OAuth authorization. RaksHex can then add a provider specific administration adapter. For a Claude Team or Enterprise subscription without an enabled administration integration, the truthful initial route is an approved export or SCIM and audit feed if the customer’s plan provides it. Subscription membership itself is not an API key and cannot be silently monitored.

### Other team developer products

GitHub Copilot and Cursor already illustrate the correct model: a team or organization administrator grants the product’s official admin credential, and RaksHex reads only provider reported seats and usage. Cursor can support provider native user spending limits through its own documented Admin API. RaksHex never claims prompt or traffic visibility that a provider does not expose.

## What remains after the product is deployed

The only customer specific prerequisites are the customer’s own administrator consent, scoped credentials or cloud role grants, and application routing configuration. RaksHex cannot create customer provider accounts, manufacture Admin API keys, accept billing terms, or alter a customer’s DNS or network path without the customer’s approval.

## Release checklist for RaksHex operators

- Confirm every provider card displays its actual authorization state: `inventory`, `authorization needed`, `validated`, `sync healthy`, `sync degraded`, or `routed enforcement active`.
- Do not present imported, estimated, or provider reported cost as RaksHex calculated spend.
- Do not enable a hard control label until the workload uses the RaksHex gateway or an implemented provider native control API.
- Test credential rotation, an over budget request, and the scoped emergency stop through the routed path before production activation.
- Keep provider administration and provider inference credentials distinct and encrypted. Never return either secret from an API response or show it in the UI.
- For OpenRouter, verify a customer authorized key validation, a RaksHex gateway connection, one allowed routed call, and one blocked routed call before declaring the path active.
- For Azure OpenAI, keep the UI state as readiness or authorization needed until the customer has granted the scoped Azure roles and selected the actual traffic control point.
