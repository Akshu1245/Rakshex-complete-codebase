# API overview

## Base

- Default local: `http://localhost:3000`
- Health: `GET /api/health`, `GET /api/health/ready`
- tRPC: mounted under the API router (`apps/api/routers.ts`)

## Auth

- Session cookie after login
- Workspace API keys for automation (`Authorization: Bearer <key>`)

## Primary domains (tRPC routers)

| Area                   | Router module         |
| ---------------------- | --------------------- |
| Auth / team            | auth + team           |
| Collections / scanning | collections, scanning |
| Findings               | findings              |
| Kill switch            | killSwitch            |
| Control plane          | controlPlane          |
| Telemetry ingest       | telemetry             |
| Payments               | payments              |
| MCP governance         | mcpGovernance         |
| Compliance             | compliance            |

Exact procedure names live in `apps/api/api/*.ts`. Prefer TypeScript client generation from the AppRouter types where available.

## Telemetry ingest (AgentGuard)

SDK posts batched events to the telemetry ingest path (see SDK README). Failures are fail-open on the client when configured.
