# GitHub App security review (archive `apps/api`, @9ca85cf)

Reviewed on 2026-10-15 (IST) by reading the source. Nothing was deployed, installed or called. The files reviewed were:
- `apps/api/services/githubApp.ts`
- `apps/api/api/github.ts`
- `apps/api/github.ts`
- `apps/api/_core/index.ts` (webhook routes)
- `apps/api/queues/workers/prScanWorker.ts` (call sites only)

## Target permissions (least privilege)
- See `engine/github-app/app-manifest.json`: `contents: write`, `pull_requests: write`, and the mandatory `metadata: read`.
- No `administration`, `workflows`, `checks`, `issues`, `members` or org permissions.
- The only event is `pull_request`.
- Install on **selected repositories only**.
- The archive has **no manifest or permission declaration at all**, so its current permissions are NOT VERIFIED.
- Notes on the archive's behaviour against this target:
  - The archive posts PR comments through `issues.createComment` (prScanWorker). That needs `issues: write` or `pull_requests: write`. PR comments work with `pull_requests: write`, so that is fine.
  - Push protection and `workflows` stay off. The pipeline must refuse to edit `.github/workflows/**`. Today `planPatch` only edits files that hold impacted call sites, plus package.json.

## Findings

| # | Severity | Finding | Where | Fix |
|---|---|---|---|---|
| 1 | **Critical** | `connectInstallation` lets **any logged-in user** link **any** `installationId` to their own first workspace. `accountLogin`, `accountType` and `permissions` come from the client. After that, `listRepos` / `scanPullRequest` run with the App's installation token, so this is cross-tenant repo access. | api/github.ts:50-74 | Verify ownership server-side: use the setup_url `installation_id` together with a user-to-server OAuth call to `GET /user/installations`, then read `GET /app/installations/{id}` for account and permissions. Require workspace role owner/admin. Choose the workspace explicitly, not `[0]`. |
| 2 | High | Webhook HMAC is computed over `JSON.stringify(req.body)` after `express.json` has parsed it, **not over the raw bytes GitHub signed**. Valid deliveries can fail (whitespace and escaping differ). Security relies on re-serialisation matching, which is wrong by construction. | _core/index.ts:586-591 (and the global `express.json` at :387) | Use `express.raw({type:"application/json"})` on that route, compute HMAC-SHA256 over the raw Buffer, `timingSafeEqual`, then parse. The legacy `/api/webhooks/github` route already does this. |
| 3 | High | `getScan` has no authorization (IDOR): any user can read any scan by id. | api/github.ts:114-120 | Check that the scan's collection or workspace belongs to `ctx.user`. |
| 4 | Medium | `scanPullRequest` does not check that `repoFullName` is one of the installation's selected repos. | api/github.ts:125-152 | Check against `listReposAccessibleToInstallation`. Request an installation token **scoped** with `repositories:[name]` and `permissions:{contents:"read"/"write", pull_requests:"write"}`. |
| 5 | Medium | A webhook for an **unlinked** installation still enqueues a job with `workspaceId:"unknown"`. | api/github.ts:290-305 | Drop the event (200 + `skipped`) when it is not linked. |
| 6 | Medium | Replay protection is skipped when Redis is down (`catch {}`). | api/github.ts:239-251 | Fail closed (503) or use durable D1/Postgres dedupe on `X-GitHub-Delivery`. |
| 7 | Medium | `apps/api/github.ts#createPullRequest` uses `config.privateKey` **as the bearer token** ("pre-generated token" fallback). It creates **non-draft** PRs. | apps/api/github.ts:295-340 | Remove it. Always mint a short-lived installation token (via `@octokit/app`, as `githubApp.ts` already does) and send `draft: true`. |
| 8 | Low | The in-memory `installations` cache never expires and is populated with `workspaceId:"unknown"` by `listReposForInstallation`. | services/githubApp.ts | Give it a TTL and never cache under an unknown workspace. |

## What is already right
- `verifyWebhookSignature` fails closed when the secret is missing, uses sha256 with `timingSafeEqual`, and checks length first.
- Installation tokens are minted by `@octokit/app`, which gives short-lived tokens (about 1 h). The private key is read from env. No token logging was seen in these files.
- `requireInstallationAccess` checks workspace membership for `listRepos` and `scanPullRequest`. The weakness is how the link is created (#1).

## Status
- PARTIAL. This is review only. None of the 8 findings has been fixed: that code lives on the archive branch and was not carried into main.
- The live sandbox demo PR used the personal token (GH_TOKEN), clearly labelled, because the App is not installed. Least-privilege App permissions remain **NOT VERIFIED** on GitHub.
