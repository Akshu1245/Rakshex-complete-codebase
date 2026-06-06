# Rakshex — MVP (Ship Now)

Zero-to-value in < 60 seconds for API security + LLM cost control.

## Quick Start (MVP)
1. Deploy backend (see PRODUCTION_DEPLOY.md or render.yaml + Dockerfile.prod)
2. Deploy frontend to Vercel (devpulse-frontend/)
3. Visit /demo — drop Postman JSON → instant findings + exposed credentials (zero auth)
4. Sign up, import real collection, run scans
5. Install VS Code extension (build .vsix or marketplace) + add GitHub Action for PRs

## Launch Checklist
- [x] Prune bloat (aggressive, only production folders + 3 docs)
- [x] Security audit (secrets removed, .env.example clean)
- [x] Bulletproof /demo (client-side instant scanner + clear findings)
- [x] GitHub Action ready (docker, entrypoint, PR comments)
- [x] VS Code extension source + package ready ("oh crap" findings)
- [x] Vercel + Render configs (Stripe/Razorpay supported in dist)
- [x] Health checks, launch assets

See PRODUCTION_DEPLOY.md for exact deploy steps.
See MARKETING_LAUNCH.md for launch thread.

**Remaining manual (you):**
- Login to Vercel + Render, set secrets (DB, JWT, Stripe/Razorpay keys, REDIS)
- Run migrations on prod DB
- Build .vsix locally and publish extension
- Publish GitHub Action (separate repo or release)
- Push this tree, trigger deploys
- Post the X thread

Built for first users and revenue.
" | Set-Content README.md -Encoding UTF8; echo "README updated."; echo "Creating simple launch script (launch-mvp.ps1 at root)..."; @"
# Rakshex MVP Launch Helper (PowerShell)
Write-Host "Rakshex MVP Launch"
if (-not (Test-Path node_modules)) { pnpm install }
Write-Host "To run backend (after build): node dist/server/_core/index.js"
Write-Host "Frontend: cd devpulse-frontend; pnpm dev"
Write-Host "For prod deploys see PRODUCTION_DEPLOY.md and render.yaml"
