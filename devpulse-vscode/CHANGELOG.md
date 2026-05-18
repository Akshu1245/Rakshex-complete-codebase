# Change Log

All notable changes to the DevPulse VS Code extension.

## 0.2.0-rc.2 — Release Candidate 2

### Fixed

- **Uninstall feedback collection now operational** — `UninstallSurvey` was
  built but never wired into the extension lifecycle in rc.1. It is now
  instantiated in `activate()` and exposed as the `DevPulse: Share Feedback
Before Uninstalling` command, matching the controlled-rollout playbook in
  `docs/rollout/uninstall-survey.md`. A one-time guard prevents repeat
  submissions from the same install.
- **Release artifact / tag consistency** — the rc.1 tag pointed at the
  pre-fix commit while the uploaded VSIX bundled post-fix code. rc.2 tag,
  release notes, bundled code, and uploaded VSIX all correspond to the same
  commit.

### Polished

- **Marketplace screenshot URLs pinned to the release tag** — `vsce package`
  now rewrites relative image paths to
  `raw/v0.2.0-rc.2/devpulse-vscode/...` instead of `raw/HEAD/...`, so the
  marketplace listing remains stable even if the default branch is renamed.
- **Removed `MARKETPLACE_README.md` from the published VSIX** — the
  marketplace renders `readme.md` only; the duplicate file inside the VSIX
  was wasted bytes.

## 0.2.0 — Beta Ready

### Added

- **Premium welcome view** with animated logo, trust badges, and onboarding progress tracker
- **Dopamine counters** showing money saved, tokens tracked, and risks blocked
- **Quick actions** for instant scan, import collection, and open docs
- **Demo mode** with 3 scripted scenarios (security scan, cost revelation, kill switch)
- **AgentGuard kill switch** — auto-stops infinite loops and cost anomalies
- **Hidden cost detection** — reveals reasoning tokens providers hide
- **Confidence scoring** on all findings (0-100) with explainable evidence
- **Finding deduplication** — merges duplicate findings automatically
- **False positive learning** — adjusts confidence based on user feedback
- **Weekly protection summary** webview showing money saved and threats blocked
- **Performance optimizations** — lazy loading, debounced refresh, memory monitoring
- **Telemetry batching** — privacy-safe analytics with opt-out
- **Value moment tracking** — "saved me" notifications for retention

### Improved

- **Onboarding flow** — reduced from 5 steps to 3, 60-second time-to-value
- **Extension startup** — < 2s activation, < 150MB memory target
- **Scan performance** — non-blocking background scans with progress notifications
- **Error handling** — graceful degradation with clear next-step messages
- **Marketplace discoverability** — 15 optimized keywords, conversion-focused README

### Security

- AES-256-GCM encryption for all stored data
- Local-first scanning — collections parsed client-side before upload
- Permission transparency — only accesses files you explicitly import
- Circuit breaker for API resilience
- Request deduplication prevents duplicate scans

## 0.1.0 — Initial Release

- Sign in with a DevPulse API key (stored in VS Code SecretStorage)
- Status bar item showing open findings and weekly LLM spend
- Findings tree view grouped by severity with inline "Mark resolved" / "Mark in-progress" actions
- `DevPulse: Run scan` command that queues a scan for a chosen collection
- Periodic activity heartbeat (opt-out via settings)
- Configurable backend URL for self-hosted deployments
