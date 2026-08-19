# OpenAI API Platform Live Activation Runbook

## Purpose

This runbook activates the first RaksHex provider control path without overstating visibility. It separates two customer authorized connections because they do different jobs.

| Connection            | Customer supplies                                                                     | RaksHex receives                                                                                       | RaksHex can truthfully do                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenAI administration | A restricted organization Admin API key from an authorized organization administrator | Provider reported organization, project, usage, cost, and audit data that the key is permitted to read | Synchronize approved telemetry and record evidence of synchronization. It does not stop direct inference calls.                                                  |
| OpenAI gateway        | A separate restricted inference API key used only for the selected routed workload    | A server encrypted provider credential plus RaksHex mediated request metadata                          | Evaluate, reserve budget, write evidence, and block a new routed request before upstream provider execution. It cannot block a direct call made outside RaksHex. |

## Customer preparation

An OpenAI organization owner or administrator should create the two keys in separate steps. The administration key must be limited to the approval scope needed by the OpenAI Administration API. The inference key should be dedicated to the specific application or environment being routed through RaksHex. Do not reuse an engineer’s personal development key.

The customer should also identify the workspace, application environment, desired hard monthly routed budget, and the owners permitted to activate or clear the workspace stop. This prevents a successful connection from silently becoming a broad organization wide control.

## RaksHex activation sequence

1. Create or select the customer workspace in the RaksHex Control Plane.
2. In **Connect OpenAI administration**, enter the administration credential. RaksHex validates it against the provider before storage, then encrypts it and records an authorization event. It must not display the submitted value.
3. Select **Sync OpenAI now**. Confirm that the Operator evidence timeline records the synchronization and that the UI labels its status only after a completed provider response.
4. In **Connect OpenAI to the RaksHex gateway**, enter the separate inference credential. RaksHex encrypts it and returns the OpenAI compatible gateway path, not the provider secret.
5. Change the selected application’s OpenAI base URL to the RaksHex gateway and use its RaksHex workspace credential. This routing change is the enforcement boundary.
6. Set a conservative hard routed budget. RaksHex reserves the next routed request before proxying it upstream and rejects a request that would exceed the configured limit.
7. Exercise the scoped **Stop routed traffic now** control in a non production workspace. Confirm that a new routed request is rejected before upstream execution, then clear the stop and confirm the evidence event.

## Required acceptance evidence

The activation is not complete until all of the following are recorded: a successful administration validation, at least one completed synchronization, a successful gateway connection, a routed request that is allowed, a routed request that is blocked by a configured budget or stop, and matching entries in the workspace evidence timeline.

> **Boundary:** OpenAI dashboard activity and direct calls do not automatically become visible or stoppable. RaksHex gains provider reported visibility through the approved administration credential and immediate control only on traffic that the customer deliberately routes through its gateway.

## Rotation and incident response

Rotate the administration credential if the authorized administrator changes, its provider scope changes, or it is exposed. Rotate the inference credential whenever the routed application key is rotated. RaksHex stores encrypted records and fingerprints, not returned plaintext secrets. During an incident, activate the workspace routed stop first to halt new mediated requests, then revoke or rotate the provider credential in the provider console if direct traffic must also be cut off.
