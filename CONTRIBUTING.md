# Contributing to Rakshex

Thank you for your interest in making Rakshex better. This document covers how to report issues, propose features, and submit code.

## Code of Conduct

Be respectful, constructive, and inclusive. Disagreement is fine; hostility is not.

## Reporting Issues

Before opening a new issue, please search existing issues to avoid duplicates.

When reporting a bug, include:

- What you expected to happen
- What actually happened
- Steps to reproduce
- Environment (Node version, OS, browser if frontend-related)
- Relevant logs or error messages

## Development Setup

```bash
# 1. Clone
git clone https://github.com/Akshu1245/rakshex-complete-codebase.git
cd rakshex-complete-codebase

# 2. Install dependencies
pnpm install

# 3. Copy environment file
cp .env.example .env
# Edit .env with your local database, Redis, and API keys

# 4. Run database migrations
pnpm run db:migrate

# 5. Start dev server
pnpm run dev
```

## Project Structure

- `server/` — Express + tRPC backend
  - `_core/` — Env, errors, logger, trpc, cache
  - `api/` — tRPC routers
  - `services/` — Business logic
  - `engines/` — Scanning engines
  - `queues/` — BullMQ workers
- `rakshex-frontend/` — Next.js 14 dashboard
- `rakshex-vscode/` — VS Code extension
- `drizzle/` — Database schema and migrations
- `github-action/` — GitHub Actions marketplace action

## Coding Standards

- TypeScript everywhere; no `any` without a comment explaining why
- Use the existing `AppError` hierarchy for domain errors
- All env vars go through `server/_core/env.ts` Zod schema
- Add tests for new features; maintain coverage
- Run `pnpm run check` and `pnpm run lint` before committing

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new shadow API detection heuristic
fix: correct token cost calculation for Gemini
refactor: simplify policy engine condition evaluation
docs: update self-hosting guide
test: add coverage for webhook SSRF guard
```

## Pull Request Process

1. Fork the repository and create a feature branch
2. Make your changes with clear, focused commits
3. Add or update tests
4. Ensure `pnpm run check` passes (TypeScript + lint)
5. Open a PR with a description of what changed and why
6. Address review feedback promptly

## Areas We Need Help

- Additional LLM provider integrations (Ollama, Azure OpenAI, Together AI)
- More compliance framework mappings (HIPAA, NIST, ISO 27001)
- Frontend performance optimization
- Additional language support for the VS Code extension
- Documentation translations

## Security

If you discover a security vulnerability, please email `security@rakshex.in` instead of opening a public issue. We will respond within 48 hours.

## License

By contributing, you agree that your contributions will be licensed under the project's license.
