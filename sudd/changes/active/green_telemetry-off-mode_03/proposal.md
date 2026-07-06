# Proposal: Add Explicit "Telemetry Off" Mode & Privacy Guarantee

**ID:** green_telemetry-off-mode_03  
**Title:** Implement telemetry-off mode with Settings panel and verifiable privacy guarantee  
**Size:** S (small)  
**Persona:** David (primary), Margot (secondary)  
**Priority:** 1  

## Why

The alignment report identifies **GAP002 + GAP007**: David (privacy-conscious retiree) has a deal-breaker — "If the app collects any analytics or telemetry about his searches — David views this as a betrayal of trust." Currently:
- No explicit "no telemetry" mode documented or enforced
- No Settings → Privacy panel offering "disable all telemetry" toggle
- One telemetry reference found in code (unclear if active)
- No privacy audit capability or "what gets collected" documentation

This creates a **trust gap**: The README claims "Your data is yours" and "zero analytics," but David has no way to verify this. If he inspects network traffic and finds *any* unexpected outbound call, he'll uninstall immediately.

**Success metric:** David can run a privacy audit and confidently state "zero data leaves my machine."

## Current State

- **Telemetry status:** Undocumented; 1 reference in PrivacyProfileStep.tsx (state unknown)
- **Privacy settings panel:** Does not exist
- **Documentation:** CLAUDE.md and AGENTS.md don't document what is/isn't collected
- **Default behavior:** Unclear if telemetry is on or off

## Desired State

1. **Settings → Privacy panel** with:
   - Toggle: "Collect analytics" (default: OFF)
   - Description: "When enabled, we collect usage data (feature adoption, error rates) to improve the app. No personal data is collected. Default is OFF."
   - Link: "What we collect" (documentation page)

2. **Code-level guarantee:**
   - Remove or disable all telemetry by default (no Sentry, no Plausible, no custom tracking)
   - Add code comments marking all outbound HTTP/IPC calls (intentional: Nebius API, model downloads; forbidden: analytics, version checks)

3. **Documentation updates:**
   - CLAUDE.md: "Privacy by default — no telemetry collected unless explicitly enabled in Settings"
   - Privacy FAQ: "What data is transmitted? Only prompts redacted with PII detection and sent to cloud. No metadata, no session IDs, no feature usage."

4. **Privacy audit capability:**
   - Optional: Add network monitor UI (shows all outbound calls in real-time) for users like David who want to verify
   - Or: Add "Privacy Audit" button → opens guide for running tcpdump/Wireshark locally

## Acceptance Criteria

1. **Settings → Privacy panel exists** — User can navigate to it and see "Collect analytics" toggle (default OFF)
2. **Telemetry is disabled by default** — No analytics calls made on startup or during normal use unless toggle is enabled
3. **Code is auditable** — All HTTP/IPC calls marked with comments: `// INTENTIONAL: Nebius API` or `// FORBIDDEN: No analytics`
4. **Documentation is updated** — CLAUDE.md, README, and in-app help clearly state "no telemetry by default"
5. **David can verify with confidence** — Running a privacy audit (e.g., network monitor) shows zero unexpected outbound calls in local mode

## Dependencies

- Depends on: None (independent)
- Unblocks: GAP006 (Prompt Transparency) builds on this foundation of "full transparency and auditability"

## Effort Justification

**S (Small) — 2–3 days**

- **Settings panel:** Add React component + state management (~2 hours)
- **Backend integration:** Wire telemetry flag to all outbound calls (~2 hours)
- **Code audit:** Search codebase for all HTTP/IPC calls, add comments (~2 hours)
- **Documentation:** Update CLAUDE.md, README, add FAQ (~2 hours)
- **Testing:** Verify toggle works, no unexpected calls with toggle OFF (~1 hour)

**Why it's S and not M:**
- Assumes telemetry is already minimal or non-existent (high confidence based on codebase review)
- Settings panel is straightforward (no complex state machine)
- Documentation is mostly clarification, not new content creation
- No new infrastructure needed (no external analytics provider integration)

**Risk if wrong:** If telemetry is deeply integrated (e.g., Sentry error tracking, third-party analytics SDK), this could be M or L. Initial assessment: low risk.

## Alignment Gap

**Reference:** GAP002 (No Explicit "No Telemetry" Mode) + GAP007 (No Documented Analytics-Off Guarantee)

**Report excerpt:**
> "David (a real target user) views telemetry as a deal-breaker. The product claims privacy-first but offers no proof that analytics are disabled. If David inspects the code or network traffic and finds any outbound call (even benign), he'll uninstall."

This proposal directly addresses David's deal-breaker by:
1. Making telemetry-off the default
2. Providing visible Settings control
3. Documenting privacy guarantees clearly
4. Enabling David to audit and verify

## Testing Approach

- Manual test: Disable analytics toggle, run app, inspect network traffic (zero unexpected calls)
- Manual test: Enable toggle, verify analytics calls are sent (if backend exists)
- Code review: Audit all `fetch()`, `http::Client`, `IPC` calls for intentional markers
- David persona test: Retiree reviews Settings → Privacy panel and documentation, confirms he'd trust the app

## Privacy Principle

This proposal reinforces the **privacy invariant**: "PII never leaves the machine in raw form." By making telemetry opt-in (not opt-out) and documenting exactly what is sent, we extend this principle to *behavior* — "Usage data is yours to control."
