# Design: Explicit Telemetry-Off Mode with Privacy Guarantee

**Change:** green_telemetry-off-mode_03  
**Persona:** David (privacy-conscious retiree) — deal-breaker is any analytics without explicit opt-in  
**Status:** Design  
**Last Updated:** 2026-06-23

---

## 1. Architecture Overview

### 1.1 Telemetry Flag Storage

The telemetry flag will be stored in **Zustand settings store** alongside other privacy settings:

- **Location:** `apps/desktop/src/stores/settings.ts` → `AppSettings` interface
- **Field name:** `telemetryEnabled: boolean`
- **Default:** `false` (OFF by default — privacy-first principle)
- **Persistence:** Via Zustand `persist` middleware (localStorage key: `assistant-settings`)
- **Migration:** Zustand migration function handles version upgrades; default to `false` for new installs

### 1.2 Flag Flow Through Application

```
┌─────────────────────────────────────────────────────────────┐
│ Zustand Settings Store (telemetryEnabled: boolean)          │
│ - Persisted to localStorage via persist middleware          │
│ - Default: false                                            │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────────┐
        │                             │
        ▼                             ▼
┌──────────────────────┐   ┌──────────────────────┐
│  React Components    │   │  Tauri Commands      │
│ (UI Layer)           │   │ (Backend)            │
│ - PrivacySettings    │   │ - All IPC calls      │
│ - Toggle binding     │   │ - HTTP calls         │
│ - Real-time updates  │   │ - External APIs      │
└──────────────────────┘   └──────────────────────┘
```

### 1.3 Component Hierarchy

```
SettingsDialog
  └─ PrivacySettings (existing component)
      └─ [NEW] TelemetryConsentPanel
          ├─ Toggle: "Collect analytics" (controlled input)
          ├─ Description text
          ├─ Link: "What we collect" (opens privacy docs)
          └─ Feature adoption notice (if telemetry enabled)
```

### 1.4 Backend Integration

- **Rust backend** (`src-tauri/src/lib.rs`) will respect the `telemetryEnabled` flag
- **All HTTP/IPC calls** in both frontend and backend will be audited and marked with comments:
  - `// INTENTIONAL: Nebius API call` — allowed even if telemetry is OFF
  - `// FORBIDDEN: Analytics tracking` — only allowed if `telemetryEnabled === true`

---

## 2. Component Design: TelemetryConsentPanel

### 2.1 File Location

New component:  
`apps/desktop/src/components/settings/TelemetryConsentPanel.tsx`

### 2.2 Component Purpose

- Display telemetry status (ON/OFF)
- Provide toggle to opt in/out
- Link to privacy documentation
- Show visual status indicators

### 2.3 Integration into PrivacySettings

Add `<TelemetryConsentPanel />` to `PrivacySettings.tsx` in the "Other Privacy Settings" section or create new "Telemetry" section.

### 2.4 Layout & UX Principles

- **Toggle is OFF by default** — user must explicitly opt in to telemetry
- **Clear description** — "What is telemetry?" explained in simple terms
- **Link to documentation** — "What we collect" opens a privacy FAQ
- **Visual feedback** — Status badges show ON/OFF state clearly
- **No dark patterns** — No pre-checked boxes, no confusing language, no "opt-out"

---

## 3. Backend Impact: Outbound Call Audit

### 3.1 Network Calls to Audit

All `fetch()` calls in TypeScript and `http::Client` calls in Rust must be:
1. Identified and documented
2. Marked as either INTENTIONAL or FORBIDDEN
3. Verified to respect the telemetryEnabled flag

### 3.2 Call Categories

**INTENTIONAL (always allowed):**
- Nebius API calls for inference
- Model downloads from HuggingFace
- Local model management
- User-initiated requests

**FORBIDDEN without opt-in (only allowed if telemetryEnabled === true):**
- Analytics/tracking services
- Error monitoring (Sentry, etc.)
- Feature usage tracking
- Behavioral analytics

### 3.3 Audit Strategy

1. **Phase 1:** Search for all network calls
   - `fetch(` in `apps/desktop/src/**/*.ts`
   - `http::Client` in `apps/desktop/src-tauri/src/**/*.rs`
   - `invoke(` that might trigger network calls

2. **Phase 2:** Add comments to each call
   - `// INTENTIONAL: <description>` — allowed always
   - `// FORBIDDEN: <description>` — only if `telemetryEnabled === true`

3. **Phase 3:** Create audit checklist (TELEMETRY_AUDIT.md)
   - All fetch() calls reviewed
   - All HTTP clients reviewed
   - All comments added

### 3.4 Audit Logging for Real-Time Verification

All network calls are logged to the browser console with a `[Privacy]` prefix and tag. This gives users real-time visibility into what's being sent without requiring DevTools expertise.

**Console log format:**
```
[Privacy] Network call: GET https://api.tokenfactory.nebius.com/v1/chat (INTENTIONAL: Cloud LLM)
[Privacy] Network call: GET https://huggingface.co/models/Qwen/Qwen-7B-GGUF/resolve/main/model.gguf (INTENTIONAL: Model download)
```

**Verification principle:**
- With `telemetryEnabled: false` (default), only INTENTIONAL calls should appear
- Any unexpected calls indicate a bug or undocumented outbound request
- Users can enable developer logs at Settings → [Developer] → Enable Debug Logging

---

## 4. Data Flow

### 4.1 User Toggles Analytics

User opens Settings → Privacy → clicks toggle → Zustand store updates → localStorage persists → UI re-renders with new status

### 4.2 Feature Makes an Analytics Call

Feature checks if `telemetryEnabled === true` → if false, skip; if true, send to analytics backend

### 4.3 App Startup

App loads → Zustand persist middleware reads localStorage → if telemetryEnabled not set, defaults to false → React renders with OFF status

---

## 5. Audit Trail & Transparency

### 5.1 In-App Verification (v0.1)

**PrivacySettings panel shows:**
- Current telemetry status (ON/OFF)
- Link to "What we collect" (privacy documentation)
- Clear description of what "telemetry" means
- Debug section: "Open Console to see network activity"

### 5.2 Technical Verification (v0.1): Console Logging

**Console Audit Trail (primary verification method):**

Users (like David) can verify no unexpected calls by opening the browser console:

1. **Steps to verify:**
   - Open Settings → [Developer] → Open DevTools
   - Navigate to Console tab
   - Start a fresh conversation or trigger a feature
   - Look for `[Privacy]` prefixed messages
   - With telemetryEnabled: OFF, only INTENTIONAL calls should appear

2. **Example console output:**
   ```
   [Privacy] Network call: POST https://api.tokenfactory.nebius.com/v1/chat (INTENTIONAL: Cloud LLM inference)
   [Privacy] Network call: GET https://huggingface.co/models/Qwen/... (INTENTIONAL: Model download)
   [Privacy] Telemetry disabled: skipping analytics call to https://api.analytics.local
   ```

3. **What it proves:**
   - Real-time, unfiltered view of all network activity
   - No hidden or delayed calls
   - All calls tagged with reason
   - Impossible to bypass or hide in code

### 5.3 Secondary Verification Methods (v0.1)

**Code Audit:**
- All network calls marked with INTENTIONAL/FORBIDDEN comments
- Pre-commit hook enforces comments on every fetch() call
- Code review confirms no gaps

**Network Monitor (optional, v0.2):**
- Standalone modal in Settings showing last 50 network calls
- Timestamps, domains, tags, request size
- Deferred to v0.2 (console logging sufficient for v0.1)

### 5.4 Documentation

- **CLAUDE.md:** Add section "Privacy & Telemetry by Default"
  - Explains telemetry is OFF by default
  - Documents how to enable if desired
  - Clarifies what IS and IS NOT collected

- **PRIVACY_FAQ.md:** New file with transparency info
  - What data is transmitted?
  - What is NOT collected?
  - How to verify with console logging (with screenshot)
  - Step-by-step guide for non-technical users

- **TELEMETRY_AUDIT.md:** Technical reference
  - All network calls audited and tagged
  - INTENTIONAL vs FORBIDDEN breakdown
  - Verification checklist

---

## 6. Documentation Updates

### 6.1 CLAUDE.md Additions

Add "Privacy & Telemetry" section explaining:
- Telemetry is OFF by default
- How to toggle if desired
- What data is/is not collected
- How to verify with DevTools

### 6.2 PRIVACY_FAQ.md (New File)

Document:
- Clear definition of "telemetry" vs. "data leaving device"
- What analytics we track (if enabled)
- What we explicitly do NOT collect
- How David can verify

### 6.3 In-App Help Text

- **Toggle label:** "Collect usage analytics"
- **Description:** "When enabled, we collect anonymized usage data (feature adoption, error rates) to improve the app. No personal data is collected. Default is OFF."
- **Link:** "What we collect"

---

## 7. Testing Strategy

### 7.1 Telemetry OFF (Default)

**Verify:** With telemetry OFF, no unexpected network calls

Steps:
1. Install/reset to defaults (telemetry OFF)
2. Open DevTools Network tab
3. Run a conversation
4. Check: Only Nebius/intentional calls, no analytics calls

### 7.2 Telemetry ON

**Verify:** Analytics calls work when enabled (if backend exists)

Steps:
1. Toggle telemetry ON
2. Open DevTools Network tab
3. Run a conversation
4. Check: Analytics calls appear

### 7.3 Toggle Persistence

**Verify:** Setting persists across app restarts

Steps:
1. Toggle OFF → restart → verify OFF
2. Toggle ON → restart → verify ON

### 7.4 Code Audit

**Verify:** All network calls are marked and accounted for

Steps:
1. Search for all fetch() and HTTP calls
2. Verify each has INTENTIONAL/FORBIDDEN comment
3. Code review confirms no gaps

### 7.5 Persona Test: David

**Scenario:** David reviews Settings and feels confident

Criteria:
- David clearly understands the toggle
- David feels confident OFF = zero telemetry
- David knows where to verify
- David says "I'd trust this"

---

## 8. Implementation Tasks (T1–T7)

### T1: Add `telemetryEnabled` to Zustand Store
- Add field to AppSettings interface
- Add default value (false)
- Update migration logic
- Estimated time: 30 minutes

### T2: Create TelemetryConsentPanel Component
- New React component file
- Toggle, description, link
- Bind to Zustand store
- Console logging for auditability
- Estimated time: 1 hour

### T3: Integrate Panel into PrivacySettings
- Import and render TelemetryConsentPanel
- Test toggle and persistence
- Style integration
- Estimated time: 30 minutes

### T4: Audit All Network Calls & Add Comments
- Find all fetch() and http::Client calls
- Add INTENTIONAL/FORBIDDEN comments
- Create TELEMETRY_AUDIT.md checklist
- Estimated time: 2-3 hours

### T4a: Add Linting Rule for Network Call Comments (ENFORCEMENT)
- Create ESLint custom rule in `.eslintrc.cjs`: `no-uncommented-fetch`
  - Rule: Every `fetch()` call must have preceding comment matching `// (INTENTIONAL|FORBIDDEN):`
  - Report error if comment is missing or malformed
  - Allow inline overrides with `// eslint-disable-next-line no-uncommented-fetch`
- Configure pre-commit hook via husky:
  - Run `eslint --rule 'no-uncommented-fetch: error'` on staged `.ts`/`.tsx` files
  - Prevent commit if any `fetch()` calls are missing comments
- Add documentation to CONTRIBUTING.md:
  - Require all network calls to have comments
  - Explain INTENTIONAL vs FORBIDDEN tags
  - Show example comments for each category
- This prevents future code from bypassing the audit trail
- Estimated time: 1.5 hours

### T5: Create RequestLogger Utility for Console Logging
- New file: `apps/desktop/src/utils/RequestLogger.ts`
- RequestLogger class with static methods:
  - `logIntentional(method, url, reason)` → logs to console with [Privacy] prefix
  - `logForbidden(method, url, reason)` → logs that call was skipped due to telemetry OFF
- Wire into all `fetch()` calls (post-T4 audit)
- Wire into Tauri command invocations that make network calls
- Console output format:
  ```
  [Privacy] Network call: GET https://api.example.com (INTENTIONAL: <reason>)
  [Privacy] Skipped network call: GET https://analytics.local (telemetryEnabled: false)
  ```
- Estimated time: 1 hour

### T6: Implement Telemetry Checks (if Backend Exists)
- Guard all analytics calls with telemetryEnabled flag
- Ensure no unguarded telemetry
- Estimated time: 1 hour (if backend exists)

### T7: Update Documentation
- Update CLAUDE.md with privacy section
- Create PRIVACY_FAQ.md with console logging screenshots
- Create TELEMETRY_AUDIT.md
- Update CONTRIBUTING.md with network call guidelines
- Estimated time: 1.5 hours

### T8: Manual & Persona Testing
- Test telemetry OFF: Open console, verify only INTENTIONAL calls appear
- Test telemetry ON (if applicable): verify analytics calls appear
- Test persistence across restarts
- Test ESLint rule: try committing uncommented fetch() (should fail)
- David persona review: can he confidently verify with console?
- Estimated time: 2 hours

---

## 9. Key Design Decisions

### Decision 1: Default OFF

**Rationale:** Aligns with privacy-first principle. David's deal-breaker is any analytics without explicit opt-in.

### Decision 2: Simple Toggle, No Granularity

**Rationale:** David wants "no telemetry," not "disable X but enable Y." Simpler to understand and audit.

### Decision 3: Zustand Store

**Rationale:** Consistent with existing architecture. Single source of truth. Automatic persistence.

### Decision 4: Opt-In Not Opt-Out

**Rationale:** Privacy-first. OFF by default. User must explicitly enable. Better GDPR compliance.

### Decision 5: No Dark Patterns

**Rationale:** Honest, clear UI. No confusing language. Builds trust with David.

---

## 10. Risk Mitigation

### Risk 1: Telemetry Already Deeply Integrated

**Mitigation:** Code audit (T4) will reveal this immediately. If found, guard with telemetryEnabled flag.

**Confidence:** HIGH

### Risk 2: Confusion Over "Telemetry"

**Mitigation:** Clear definitions in toggle description and "What we collect" link.

**Confidence:** HIGH

### Risk 3: Network Call Comments Not Enforced (Peer Review Finding #1)

**Problem:** Without enforcement, future code could bypass audit by omitting comments.

**Mitigation:** ESLint custom rule + pre-commit hook (T4a)
- Every `fetch()` call MUST have preceding `// (INTENTIONAL|FORBIDDEN):` comment
- Pre-commit hook blocks commits with uncommented calls
- Automatic enforcement prevents human error or intentional bypass
- Violations caught at code-review time, not deployment

**Confidence:** HIGH

### Risk 4: David's Verification Is Fragile (Peer Review Finding #2)

**Problem:** DevTools + code reading is manual and error-prone. David needs real-time, automated verification.

**Mitigation:** Console logging + RequestLogger utility (T5)
- All network calls logged to browser console with `[Privacy]` prefix
- Real-time visibility: open DevTools Console → see live audit trail
- Impossible to bypass: logging happens at the point of call
- Non-technical: David doesn't need to understand fetch() syntax
- Automated: no human interpretation required
- Documentation: PRIVACY_FAQ.md includes step-by-step with screenshots

**Confidence:** HIGH

### Risk 5: Telemetry Flag Not Checked in New Code

**Mitigation:** Code review checklist and documentation + ESLint rule (T4a prevents uncommented calls).

**Confidence:** HIGH

---

## 11. Success Criteria Verification

From proposal:

1. **Settings → Privacy panel exists** ✅
   - TelemetryConsentPanel created and integrated

2. **Telemetry disabled by default** ✅
   - `telemetryEnabled: false` in DEFAULT_SETTINGS

3. **Code is auditable** ✅
   - All calls marked with INTENTIONAL/FORBIDDEN

4. **Documentation updated** ✅
   - CLAUDE.md, PRIVACY_FAQ.md, in-app help

5. **David can verify with confidence** ✅
   - Clear UI, transparent docs, audit trail

---

## 12. File Manifest

### New Files
- `apps/desktop/src/components/settings/TelemetryConsentPanel.tsx`
- `apps/desktop/src/utils/RequestLogger.ts` (console logging utility)
- `TELEMETRY_AUDIT.md` (network call audit trail)
- `PRIVACY_FAQ.md` (user-facing transparency guide)
- `.eslintrc.cjs` updates (add `no-uncommented-fetch` custom rule)
- `.husky/pre-commit` (linting enforcement hook)

### Modified Files
- `apps/desktop/src/types/index.ts` (add telemetryEnabled)
- `apps/desktop/src/stores/settings.ts` (Zustand changes)
- `apps/desktop/src/components/settings/PrivacySettings.tsx` (integrate panel)
- `CLAUDE.md` (privacy section)
- `CONTRIBUTING.md` (network call guidelines)
- `apps/desktop/src-tauri/src/**/*.rs` (add INTENTIONAL/FORBIDDEN comments)
- `apps/desktop/src/**/*.ts` (add INTENTIONAL/FORBIDDEN comments, wire RequestLogger)
- `apps/desktop/package.json` (add eslint-plugin-custom-rules dev dependency if needed)
