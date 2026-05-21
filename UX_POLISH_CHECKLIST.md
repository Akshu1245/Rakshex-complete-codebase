# Rakshex UX Polish Checklist

> Obsess over product feel. Benchmark against the best.
> Date: 2026-05-17

---

## ONBOARDING FRICTION ELIMINATION

| Step                           | Current Time | Target Time | Status |
| ------------------------------ | ------------ | ----------- | ------ |
| Install from marketplace       | \_\_\_       | < 2 min     |        |
| First open → Sign in visible   | \_\_\_       | < 5s        |        |
| Sign in → Connected            | \_\_\_       | < 30s       |        |
| Connected → First scan started | \_\_\_       | < 60s       |        |
| Scan → First finding visible   | \_\_\_       | < 3s        |        |
| **Total time-to-value**        | **\_\_\_**   | **< 90s**   |        |

### Onboarding Fixes

- [ ] Welcome view auto-opens on first install
- [ ] "Create Free Account" is primary CTA (not "Sign In")
- [ ] API key input has inline validation (green checkmark)
- [ ] After connect: auto-show demo or auto-scan sample
- [ ] First finding: animated highlight + celebration
- [ ] Empty state: "No issues found! 🎉" not just "No findings"

---

## SPEED BENCHMARKS

| Action              | Rakshex | Target  | Linear  | Raycast |
| ------------------- | ------- | ------- | ------- | ------- |
| Extension activate  | \_\_\_  | < 2s    | < 1s    | < 1s    |
| Sidebar open        | \_\_\_  | < 300ms | < 200ms | < 100ms |
| Scan start feedback | \_\_\_  | < 100ms | < 50ms  | < 50ms  |
| Finding render      | \_\_\_  | < 200ms | < 100ms | < 100ms |
| Dashboard load      | \_\_\_  | < 1s    | < 500ms | < 300ms |
| Auto-fix apply      | \_\_\_  | < 500ms | < 300ms | < 200ms |

### Speed Fixes

- [ ] Lazy-load webview content
- [ ] Debounce all refresh calls (300ms)
- [ ] Virtualize long finding lists
- [ ] Cache API responses (30s TTL)
- [ ] Preload dashboard data on hover
- [ ] Background scan without blocking UI

---

## VISUAL POLISH

### Sidebar

- [ ] Consistent icon sizing (16px)
- [ ] Proper indentation for nested items
- [ ] Severity colors match VS Code problems panel
- [ ] Hover states on all interactive elements
- [ ] Loading skeletons (not spinners)
- [ ] Empty state illustrations

### Notifications

- [ ] Max 1 toast at a time (queue others)
- [ ] Distinguish info / warning / error with color + icon
- [ ] Action buttons in every toast
- [ ] Auto-dismiss after 10s (unless critical)

### Status Bar

- [ ] Minimal text: "DP: 3 🔴 2 🟡" not "Rakshex: 3 Critical, 2 High"
- [ ] Click opens sidebar (not dashboard)
- [ ] Color changes with severity (green → yellow → red)
- [ ] Tooltip shows full breakdown

### Webviews

- [ ] Match VS Code theme (dark/light/high-contrast)
- [ ] Use CSS variables for all colors
- [ ] Responsive layout (min 300px width)
- [ ] Smooth transitions (200ms)
- [ ] No horizontal scrollbars

---

## INTERACTION POLISH

### Click Feedback

- [ ] Buttons: scale 0.98 on press
- [ ] Links: underline on hover
- [ ] Tree items: highlight on hover
- [ ] All clicks: immediate visual response (< 50ms)

### Loading States

- [ ] Button loading: spinner replaces text
- [ ] List loading: skeleton rows
- [ ] Dashboard: progress bar for multi-step
- [ ] Never show blank screen during load

### Error States

- [ ] Friendly error messages (no stack traces)
- [ ] Action suggestion with every error
- [ ] "Retry" button on network errors
- [ ] Offline mode: cache last known state

---

## MICROCOPY AUDIT

| Location       | Current              | Better                                                      | Status |
| -------------- | -------------------- | ----------------------------------------------------------- | ------ |
| Welcome title  | "Rakshex"            | "Stop AI Agents from Burning Your Budget"                   |        |
| Empty findings | "No recent findings" | "No issues found! Your APIs look secure."                   |        |
| Scan button    | "Run scan"           | "Scan for Issues"                                           |        |
| Connecting     | "Validating..."      | "Checking your API key..."                                  |        |
| Error          | "Request failed"     | "Can't reach Rakshex. Check your connection and try again." |        |
| Success        | "Scan complete"      | "Found 3 issues in 2.1s"                                    |        |

---

## RESPONSIVENESS

| Scenario                  | Target Behavior                        |
| ------------------------- | -------------------------------------- |
| VS Code window 400px wide | Sidebar usable, no truncation          |
| VS Code window 800px wide | Full experience                        |
| Multi-monitor             | Status bar shows on active window only |
| Workspace switch          | Rakshex state persists                 |
| VS Code reload            | Re-authenticates silently              |

---

## A11Y (Accessibility)

- [ ] All icons have aria-labels
- [ ] Color not the only indicator (icons + text)
- [ ] Keyboard navigable (Tab order logical)
- [ ] Screen reader tested (NVDA/VoiceOver)
- [ ] Focus states visible (2px outline)
- [ ] Minimum contrast 4.5:1

---

## POLISH PRINCIPLES

1. **Every pixel matters.** If it looks off, fix it.
2. **Every millisecond counts.** If it feels slow, optimize.
3. **Every word should earn its place.** If it's unclear, rewrite.
4. **Every error is an opportunity.** If something breaks, delight.
5. **Every state needs design.** Empty, loading, error, success — all designed.

---

_Checklist maintained by product + design team._
_Reviewed before every release._
