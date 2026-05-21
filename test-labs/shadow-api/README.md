# Shadow API Test Lab

> Contains undocumented endpoints that should be discovered by Rakshex
> shadow API detection but don't appear in the official collection.

---

## Scenario

The main API collection only documents 5 endpoints.
But the backend actually has 12 endpoints — 7 are undocumented "shadow APIs".

### Documented Endpoints (in collection)

1. GET /users
2. GET /users/:id
3. POST /users
4. GET /products
5. GET /products/:id

### Shadow APIs (NOT in collection)

6. GET /admin/users — Admin endpoint, no auth
7. POST /internal/reset-password — Internal endpoint exposed
8. GET /debug/env — Debug endpoint leaks env vars
9. POST /webhooks/raw — Webhook endpoint accepts raw payloads
10. GET /api/v1/backup — Backup endpoint exposed
11. POST /graphql — GraphQL endpoint (different from REST)
12. GET /swagger.json — API spec exposed

## Expected Rakshex Detection

- **Discovery method:** Code analysis + traffic analysis
- **Findings:** 7 undocumented endpoints
- **Risk:** Some shadow APIs have no auth (admin, debug)
- **Severity:** Critical for admin/debug, Medium for others

## Files

- `documented-collection.json` — Only 5 endpoints
- `full-openapi-spec.yaml` — All 12 endpoints (ground truth)
- `backend-routes.ts` — Source code with all routes

---

_Used for shadow API detection accuracy testing._
