# Tasks: Telemetry-Off Mode & Privacy Guarantee

**Change:** green_telemetry-off-mode_03  
**Status:** Ready for Decomposition  
**Total Effort:** S (Small) — 2–3 days of implementation + testing

---

## Task Decomposition (T1–T7)

### T1: Add telemetryEnabled to Zustand Settings Store

**Goal:** Add `telemetryEnabled` field to settings, default to false, persist with migrations

**Subtasks:**
- T1.1: Update `AppSettings` interface in `apps/desktop/src/types/index.ts`
  - Add `telemetryEnabled: boolean` field
- T1.2: Update `DEFAULT_SETTINGS` in `apps/desktop/src/stores/settings.ts`
  - Set `telemetryEnabled: false`
- T1.3: Update Zustand migration logic
  - Version bump: v16 → v17
  - Handle upgrades: preserve existing settings, default new installs to `false`
- T1.4: Test persistence
  - Toggle OFF → restart → verify OFF
  - Toggle ON → restart → verify ON

**Dependencies:** None (independent)  
**Effort:** 30 minutes  
**Acceptance Criteria:**
- [ ] `telemetryEnabled` field exists in AppSettings
- [ ] Zustand store persists setting to localStorage
- [ ] Default is false
- [ ] Migration handles version upgrades
- [ ] Manual test confirms persistence across app restart

---

### T2: Create TelemetryConsentPanel React Component

**Goal:** Build new Settings panel component for telemetry toggle with UI and bindings

**Subtasks:**
- T2.1: Create `TelemetryConsentPanel.tsx` component
  - Import Zustand store
  - Create controlled toggle input
  - Add description text
  - Add "What we collect" link (opens external docs)
  - Add visual status indicators (ON/OFF badges)
- T2.2: Add toggle event handler
  - Bind toggle to `updateSettings({ telemetryEnabled: value })`
  - Console log for auditability: `[Privacy] Telemetry enabled/disabled`
- T2.3: Style component
  - Match existing PrivacySettings panels (border, padding, colors)
  - Use HSL color variables from app theme
  - Icons: TelemetryIcon (new) or reuse ShieldIcon
- T2.4: Test component in isolation
  - Toggle shows correct initial state
  - Toggle updates Zustand store
  - Status badges display correctly (ON/OFF)

**Dependencies:** T1 (telemetryEnabled field must exist in store)  
**Effort:** 1 hour  
**Acceptance Criteria:**
- [ ] Component file created at correct path
- [ ] Toggle is functional and updates store
- [ ] Description text is clear
- [ ] "What we collect" link exists
- [ ] Status badges show ON/OFF state
- [ ] Console logs toggle events
- [ ] Component matches design mockup

---

### T3: Integrate TelemetryConsentPanel into PrivacySettings

**Goal:** Wire the new panel into the existing PrivacySettings component

**Subtasks:**
- T3.1: Import TelemetryConsentPanel in PrivacySettings.tsx
- T3.2: Choose integration point
  - Option A: Add to "Other Privacy Settings" section (after Encrypt Local Data)
  - Option B: Create new "Telemetry & Analytics" section
  - (Recommend: Option A for v0.1 simplicity)
- T3.3: Render component in PrivacySettings
  - Add `<TelemetryConsentPanel />` to JSX
- T3.4: Test integration
  - Open Settings → Privacy tab
  - Verify panel appears
  - Toggle works
  - Persists after app restart

**Dependencies:** T2 (TelemetryConsentPanel component must exist)  
**Effort:** 30 minutes  
**Acceptance Criteria:**
- [ ] Component imported and rendered in PrivacySettings
- [ ] Panel displays in Settings → Privacy tab
- [ ] Toggle is functional
- [ ] Setting persists across app restart
- [ ] No console errors

---

### T4: Audit All Network Calls & Add INTENTIONAL/FORBIDDEN Comments

**Goal:** Search entire codebase for network calls, mark each as INTENTIONAL or FORBIDDEN, create audit report

**Subtasks:**
- T4.1: Audit frontend TypeScript files
  - Search `apps/desktop/src` for `fetch(`, `openUrl(`, `openPath()`
  - For each call, determine: INTENTIONAL or FORBIDDEN?
  - Add comment above call: `// INTENTIONAL: <description>` or `// FORBIDDEN: <description>`
  - Examples:
    - Nebius API: INTENTIONAL
    - HuggingFace model downloads: INTENTIONAL
    - Mem0 API (if enabled): INTENTIONAL
    - Analytics tracking: FORBIDDEN
    - Error monitoring: FORBIDDEN
- T4.2: Audit backend Rust files
  - Search `apps/desktop/src-tauri/src` for `http::Client`, `reqwest`, `fetch-like` calls
  - Add comments same as T4.1
  - Check all modules: ollama.rs, gliner.rs, etc.
- T4.3: Create TELEMETRY_AUDIT.md checklist
  - List all network calls found
  - Mark each as INTENTIONAL or FORBIDDEN
  - Note any suspicious calls for review
- T4.4: Code review
  - Verify all comments are correct
  - Confirm no unmarked calls remain
  - Look for hidden telemetry (Sentry, Plausible, etc.)

**Dependencies:** None (can run in parallel with T1–T3)  
**Effort:** 2–3 hours  
**Acceptance Criteria:**
- [ ] All fetch() calls in TS audited and commented
- [ ] All HTTP clients in Rust audited and commented
- [ ] TELEMETRY_AUDIT.md created with full checklist
- [ ] No unmarked network calls found
- [ ] Code review confirms accuracy
- [ ] Any unexpected calls documented with risk assessment

---

### T5: Implement Telemetry Checks (Guard Analytics Calls)

**Goal:** Wrap any telemetry/analytics calls with `if (telemetryEnabled)` guards

**Subtasks:**
- T5.1: Identify analytics backend
  - Does AILocalMind currently have an analytics backend? (Sentry, Plausible, custom?)
  - If NO: Skip to T5.4 (nothing to guard, move to next task)
  - If YES: Continue to T5.2
- T5.2: Create telemetry service (if needed)
  - File: `apps/desktop/src/services/telemetry.ts`
  - Export function: `trackEvent(eventName: string, data?: Record<string, any>)`
  - Inside function: Check `useSettingsStore.getState().settings.telemetryEnabled`
  - If false: return early (FORBIDDEN: Skip)
  - If true: Send to analytics backend (INTENTIONAL: Send)
- T5.3: Replace all analytics calls
  - Find unguarded analytics calls
  - Replace with `trackEvent()` wrapper
  - Verify calls respect telemetryEnabled flag
- T5.4: Document findings
  - If no analytics backend exists: Note in commit message
  - If guards added: Document which calls are now guarded

**Dependencies:** T4 (must know all analytics calls first)  
**Effort:** 1 hour (if backend exists) / 15 min (if no backend)  
**Acceptance Criteria:**
- [ ] All analytics calls (if any) are guarded by telemetryEnabled
- [ ] No unguarded analytics calls remain
- [ ] Tests verify guards work (telemetryEnabled OFF → no call, ON → call sent)
- [ ] Code comments mark guarded calls: `// FORBIDDEN: guarded by telemetryEnabled`

---

### T6: Update Documentation

**Goal:** Update CLAUDE.md, create PRIVACY_FAQ.md, document privacy stance

**Subtasks:**
- T6.1: Update CLAUDE.md
  - Add new section: "## Privacy & Telemetry (v0.1)"
  - Explain telemetry is OFF by default
  - Document how to enable (Settings → Privacy)
  - List what is/is not collected
  - Include DevTools verification instructions
- T6.2: Create PRIVACY_FAQ.md
  - New file in project root: `/PRIVACY_FAQ.md`
  - Sections:
    - "What is telemetry?" (clear definition)
    - "What data is collected?" (list of metrics if enabled)
    - "What is NOT collected?" (explicit list of PII, prompts, etc.)
    - "How do I verify?" (DevTools, network inspector, audit checklist)
    - "Can I trust this?" (point to code comments, audit trail)
- T6.3: Create TELEMETRY_AUDIT.md
  - Reference file for developers
  - Full list of all network calls
  - INTENTIONAL vs. FORBIDDEN classification
  - Verification checklist
- T6.4: In-app help text
  - Toggle label: "Collect usage analytics"
  - Description: "When enabled, we collect anonymized usage data (feature adoption, error rates) to improve the app. No personal data is collected. Default is OFF."
  - Link text: "What we collect" (should open PRIVACY_FAQ.md)

**Dependencies:** T4 (must know audit results to document)  
**Effort:** 1 hour  
**Acceptance Criteria:**
- [ ] CLAUDE.md has "Privacy & Telemetry" section
- [ ] PRIVACY_FAQ.md created with clear explanations
- [ ] TELEMETRY_AUDIT.md created with complete checklist
- [ ] In-app text is clear and honest
- [ ] All documentation is verified for accuracy

---

### T7: Manual & Persona Testing

**Goal:** Verify toggle works, code is auditable, and David persona trusts the solution

**Subtasks:**
- T7.1: Manual Test — Telemetry OFF (Default)
  - Install app fresh (or reset settings)
  - Verify: Settings → Privacy → "Collect usage analytics" is OFF
  - Open DevTools → Network tab
  - Start new conversation, send message
  - Check network calls: Only Nebius API (if cloud mode), no analytics domains
  - Expected result: PASS (zero unexpected calls)
- T7.2: Manual Test — Telemetry ON
  - Toggle "Collect usage analytics" to ON
  - Verify toggle shows "ON" status
  - Open DevTools → Network tab
  - Repeat conversation test
  - Check: Analytics calls appear (if backend exists)
  - Expected result: PASS (analytics calls sent)
- T7.3: Manual Test — Persistence
  - Toggle OFF → Close app → Reopen → Verify OFF
  - Toggle ON → Close app → Reopen → Verify ON
  - Check localStorage directly (DevTools → Application → localStorage → assistant-settings)
  - Expected result: PASS (setting persists)
- T7.4: Code Audit Verification
  - Run grep to find all fetch(), http::Client, invoke() calls
  - Cross-check against TELEMETRY_AUDIT.md
  - Confirm all have INTENTIONAL/FORBIDDEN comments
  - Expected result: PASS (no unmarked calls)
- T7.5: Persona Test — David's Review
  - Show David the Settings → Privacy panel
  - Ask: "What does this toggle do?"
  - Ask: "Would you trust this to control telemetry?"
  - Ask: "How would you verify zero data leaves your machine?"
  - Show him PRIVACY_FAQ.md and DevTools verification steps
  - Ask: "Would you feel confident using this app?"
  - Expected result: PASS (David says "yes, I'd trust this")

**Dependencies:** T1–T6 complete  
**Effort:** 2 hours  
**Acceptance Criteria:**
- [ ] Telemetry OFF: No unexpected network calls (DevTools verified)
- [ ] Telemetry ON: Analytics calls sent (if backend exists)
- [ ] Persistence: Setting survives app restart
- [ ] Code audit: All calls marked and documented
- [ ] David persona: Confirms trust in solution
- [ ] All tests documented in commit/PR

---

## Task Dependencies & Order

```
T1 (Add to Store)
  ├─ T2 (Create Component) → T3 (Integrate)
  └─ T6 (Update Docs)

T4 (Code Audit) [PARALLEL]
  └─ T5 (Implement Guards)

T7 (Testing) [FINAL]
  └─ (All above)
```

**Recommended sequence:**
1. T1 + T4 in parallel (independent)
2. T2 (depends on T1)
3. T3 (depends on T2)
4. T5 (depends on T4)
5. T6 (depends on T4)
6. T7 (final validation)

---

## Notes for Decomposer

1. **No Architecture Changes:** This is purely additive (new component, new field, new comments). No refactoring needed.

2. **Low Risk:** Telemetry is OFF by default; worst case is a forgotten comment (caught in code review).

3. **High Confidence:** Based on codebase review, telemetry integration is minimal or non-existent. No deep refactoring expected.

4. **David is the Judge:** Persona test (T7.5) is critical. If David doesn't feel confident, consider v0.2 enhancements (network monitor UI, granular toggles).

5. **Audit Trail is Key:** All code comments (INTENTIONAL/FORBIDDEN) are what David will inspect. Be thorough and honest in T4.

---

## Effort Breakdown

| Task | Subtasks | Effort | Parallelizable |
|------|----------|--------|-----------------|
| T1 | 4 | 30 min | No (depends on T1) |
| T2 | 4 | 1 hr | No (depends on T1) |
| T3 | 4 | 30 min | No (depends on T2) |
| T4 | 4 | 2–3 hr | YES (parallel) |
| T5 | 4 | 1 hr | No (depends on T4) |
| T6 | 4 | 1 hr | No (depends on T4) |
| T7 | 5 | 2 hr | No (final) |
| **TOTAL** | **29** | **~8–9 hr** | Sequential |

**Total: S (Small) — 2–3 days of implementation + testing (8–9 hours of actual work, spread over 2–3 days with testing, review, fixes)**
