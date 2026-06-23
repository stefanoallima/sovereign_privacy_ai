# Tasks: Frontend E2E Tests

**Change ID:** green_frontend-e2e-tests_09  
**Effort Estimate:** L (3–4 weeks)  
**Batch 1 (Infrastructure):** T01–T06 (5–7 days)  
**Batch 2 (Workflows):** T07–T11 (7–10 days)  
**Batch 3 (CI/CD + Docs):** T12–T13 (1 day)

---

## Phase 1: Infrastructure

### T01: Playwright Installation and Config
**Description:** Install `@playwright/test` as a dev dependency and create `playwright.config.ts` with the correct Tauri-aware settings. The config targets `http://localhost:5173` via a `webServer` block, uses `workers: 1` (Tauri holds a single window; parallel execution is not viable), sets per-test `timeout: 30_000`, and enables screenshot/video capture on failure. Also adds `test:e2e` and `test:e2e:debug` scripts to `package.json`.

**Files:**
- `apps/desktop/playwright.config.ts` — create
- `apps/desktop/package.json` — add scripts

**SharedFiles:**
- `apps/desktop/package.json` — also modified by T02 (pnpm install in CI scripts)

**Dependencies:** none

**Effort:** S

**Acceptance:**
- [ ] `pnpm add -D @playwright/test playwright` succeeds; both appear in `devDependencies`
- [ ] `playwright.config.ts` exists at `apps/desktop/playwright.config.ts`
- [ ] Config sets: `testDir: "./e2e"`, `timeout: 30_000`, `retries: process.env.CI ? 1 : 0`, `workers: 1`
- [ ] Config sets: `webServer.command: "pnpm dev"`, `webServer.url: "http://localhost:5173"`, `webServer.reuseExistingServer: !process.env.CI`
- [ ] Config sets: `use.screenshot: "only-on-failure"`, `use.video: "retain-on-failure"`, `use.trace: "on-first-retry"`
- [ ] Config has a single project named `"chromium"` using `devices["Desktop Chrome"]`
- [ ] `package.json` scripts include `"test:e2e": "playwright test"` and `"test:e2e:debug": "PWDEBUG=1 playwright test"`
- [ ] `pnpm test:e2e` runs without errors (zero tests collected is acceptable at this stage)

---

### T02: Global Setup — Tauri IPC Stub
**Description:** Create `e2e/global-setup.ts` that injects a `window.__TAURI_INTERNALS__` stub into every page before tests run. The stub intercepts `invoke()` calls and returns canned fixture responses for the Rust commands used by privacy flows: `detect_pii`, `detect_pii_with_gliner`, `get_app_settings`, `save_app_settings`, `get_conversations`, `save_conversation`. This eliminates the need for a compiled Tauri binary, as required by REQ-INFRA-02. The stub responses must match the TypeScript types used by the frontend stores.

**Files:**
- `apps/desktop/e2e/global-setup.ts` — create
- `apps/desktop/playwright.config.ts` — add `globalSetup: "./e2e/global-setup.ts"` (modifies T01 file)

**SharedFiles:**
- `apps/desktop/playwright.config.ts` — also created in T01

**Dependencies:** T01

**Effort:** M

**Acceptance:**
- [ ] `e2e/global-setup.ts` exports a default async function that is wired via `playwright.config.ts globalSetup`
- [ ] Stub handles `invoke("detect_pii", { text })` — returns `{ entities: [], redacted: text }` (no-op default)
- [ ] Stub handles `invoke("detect_pii_with_gliner", { text })` — returns `{ entities: [], redacted: text }` (no-op default)
- [ ] Stub handles `invoke("get_app_settings")` — returns a valid `AppSettings` object with `alwaysReviewBeforeSend: false`, `skipCloudReview: false`, `preferredBackend: "hybrid"`
- [ ] Stub handles `invoke("get_conversations")` — returns `[]`
- [ ] Stub is injected via `page.addInitScript()` so it is present before React mounts
- [ ] Running `pnpm test:e2e` with a trivial test (`expect(true).toBe(true)`) passes without Tauri import errors in the browser console

---

### T03: App Fixture and State Helpers
**Description:** Create the shared `test` fixture in `e2e/fixtures/app.ts` that extends Playwright's base `test` with a `page` preconfigured with the IPC stub and a clean localStorage. Also create `e2e/helpers/store.ts` with functions that seed and clear Zustand-persisted stores by writing directly to `localStorage` via `page.evaluate`, plus a Dexie `clearConversations()` that calls `indexedDB.deleteDatabase("ailocalmind")`.

**Files:**
- `apps/desktop/e2e/fixtures/app.ts` — create
- `apps/desktop/e2e/helpers/store.ts` — create

**SharedFiles:** none (these are new files only this task touches)

**Dependencies:** T01, T02

**Effort:** M

**Acceptance:**
- [ ] `app.ts` exports a `test` constant that extends `@playwright/test` base `test`
- [ ] The fixture's `beforeEach` calls `localStorage.clear()` and `clearConversations()` via `page.evaluate`
- [ ] `store.ts` exports: `seedVault(page, entries[])`, `clearVault(page)`, `seedSettings(page, partial)`, `resetSettings(page)`, `clearConversations(page)`, `getStoreState(page, storeName)`
- [ ] `seedVault` writes the Zustand `pii-vault-storage` key in the format the `usePiiVaultStore` `persist` middleware expects (version field + state field)
- [ ] `resetSettings` sets `alwaysReviewBeforeSend: false`, `skipCloudReview: false`, `preferredBackend: "hybrid"` as baseline
- [ ] A smoke test using the `test` fixture passes: page loads at `http://localhost:5173`, no console errors

---

### T04: Network Mocking Helpers
**Description:** Create `e2e/helpers/network.ts` with two utilities. `stubCloudApi(page, mockReply)` intercepts all requests to `**/v1/chat/completions` and returns a valid SSE stream with the given assistant text. `captureCloudRequest(page, action)` intercepts the next such request, executes `action`, and resolves with the parsed POST body — used by privacy assertions to verify that raw PII was not sent. Include a `toSSE(text)` formatter that produces the `data: {"choices":[{"delta":{"content":"..."}}]}\n\ndata: [DONE]\n\n` format the Nebius client expects.

**Files:**
- `apps/desktop/e2e/helpers/network.ts` — create

**SharedFiles:** none

**Dependencies:** T01, T02

**Effort:** M

**Acceptance:**
- [ ] `stubCloudApi(page, "I can help.")` causes `ChatPage.sendMessage` to receive `"I can help."` as the assistant reply (verified in integration with T06)
- [ ] `captureCloudRequest` resolves with the POST body object after the action completes
- [ ] The SSE `toSSE(text)` helper produces output parseable by `EventSource`-style streaming: `data: {...}\n\n` per chunk, terminated by `data: [DONE]\n\n`
- [ ] Route handler uses `route.fulfill({ contentType: "text/event-stream", body: ... })` (not `route.abort()` or `route.continue()`)
- [ ] A unit-level Playwright test (`test("stub works", ...)`) verifies that after `stubCloudApi`, no real HTTP request leaves the test runner

---

### T05: Privacy Assertion Helpers
**Description:** Create `e2e/helpers/privacy.ts` with pure assertion functions used across all workflow tests. `assertNoPII(text, piiValues[])` throws if any raw PII string appears in `text`. `assertHasPlaceholder(text)` asserts the text contains at least one `[TOKEN]` pattern. `assertPayloadNoPII(payload, piiValues[])` stringifies the request body and calls `assertNoPII`. These helpers are synchronous and use `expect` from `@playwright/test`.

**Files:**
- `apps/desktop/e2e/helpers/privacy.ts` — create

**SharedFiles:** none

**Dependencies:** T01

**Effort:** S

**Acceptance:**
- [ ] `assertNoPII("Hello [NAME_1]", ["Acme Corp"])` passes (no raw PII)
- [ ] `assertNoPII("Hello Acme Corp", ["Acme Corp"])` throws with a descriptive message including the matched PII value
- [ ] `assertHasPlaceholder("[VAULT_PERSON_NAME_1] owes me €5000")` passes
- [ ] `assertHasPlaceholder("Hello world")` throws (no `[...]` token present)
- [ ] `assertPayloadNoPII({ messages: [{ content: "Hello [NAME_1]" }] }, ["Acme Corp"])` passes
- [ ] All three functions are exported and importable from test files

---

### T06: Page Object Models + data-testid Audit
**Description:** Create four Page Object Model classes: `ChatPage`, `ReviewPanel`, `VaultPage`, and `SettingsPage`. Each POM wraps Playwright locators using `data-testid` selectors exclusively (per REQ-NFR-03). Before writing POMs, audit the React components to identify which `data-testid` attributes are missing and add them to the source. Required `data-testid` additions: `prompt-review-panel` (PromptReviewPanel root), `approve-send-button`, `cancel-review-button`, `vault-entry-row`, `incognito-chat-button`, `always-review-toggle`, `pii-redaction-count`, `processed-prompt-textarea`, `privacy-info-region`.

**Files:**
- `apps/desktop/e2e/pages/ChatPage.ts` — create
- `apps/desktop/e2e/pages/ReviewPanel.ts` — create
- `apps/desktop/e2e/pages/VaultPage.ts` — create
- `apps/desktop/e2e/pages/SettingsPage.ts` — create
- `apps/desktop/src/components/PromptReviewPanel.tsx` — add `data-testid` attributes
- `apps/desktop/src/components/PiiVaultBrowser.tsx` (or equivalent vault component) — add `data-testid` attributes
- `apps/desktop/src/components/Sidebar.tsx` — add `data-testid="incognito-chat-button"`
- `apps/desktop/src/components/SettingsDialog.tsx` (or equivalent) — add `data-testid="always-review-toggle"`

**SharedFiles:** none (React component changes are isolated to T06)

**Dependencies:** T01, T02, T03, T04, T05

**Effort:** L

**Acceptance:**
- [ ] `ChatPage.sendMessage(text)` fills the chat input and presses Enter; returns after the input clears
- [ ] `ChatPage.waitForReviewPanel()` returns a `ReviewPanel` instance after `[data-testid="prompt-review-panel"]` becomes visible
- [ ] `ReviewPanel.getProcessedPrompt()` returns the text content of the processed prompt area
- [ ] `ReviewPanel.approve()` clicks `[data-testid="approve-send-button"]` and waits for panel to disappear
- [ ] `ReviewPanel.cancel()` clicks `[data-testid="cancel-review-button"]` and waits for panel to disappear
- [ ] `VaultPage.addEntry(text, category)` opens the vault add-entry form, fills it, and submits
- [ ] `VaultPage.deleteEntry(text)` hovers the matching row (`page.hover`), then clicks the delete button
- [ ] `VaultPage.exportVault()` clicks the export button and returns the Playwright `Download` object
- [ ] `SettingsPage.setAlwaysReview(enabled)` toggles `[data-testid="always-review-toggle"]` to the desired state
- [ ] All `data-testid` attributes listed above are present in the React source and verifiable via browser devtools

---

## Phase 2: Workflow Tests

### T07: W1 — Chat Redaction Review Spec
**Description:** Implement `e2e/tests/01-chat-redaction-review.spec.ts`. Verifies the end-to-end privacy guarantee that raw PII never reaches the cloud. Covers the happy-path approval flow, the cancellation flow, non-PII message bypass, and keyboard shortcuts. Each test uses `captureCloudRequest` to inspect the actual POST body sent to the mocked Nebius endpoint.

**Files:**
- `apps/desktop/e2e/tests/01-chat-redaction-review.spec.ts` — create

**SharedFiles:** none

**Dependencies:** T06

**Effort:** M

**Acceptance:**
- [ ] Test: `[hybrid] name + amount PII — review panel shows placeholders, raw PII absent from panel` — passes
- [ ] Test: `[hybrid] cloud POST body does not contain raw PII after approve` — uses `captureCloudRequest`, asserts payload contains no `"Acme Corp"` or `"5000"`
- [ ] Test: `[hybrid] user cancels review — no cloud request made, no assistant reply` — asserts `waitForResponse` never fires
- [ ] Test: `[hybrid] plain message (no PII) — review panel NOT shown, reply appears directly` — asserts `prompt-review-panel` is never visible within 2 s
- [ ] Test: `[hybrid] Ctrl+Enter keyboard shortcut approves and sends` — uses `page.keyboard.press("Control+Enter")`
- [ ] Test: `[hybrid] Esc keyboard shortcut cancels review` — uses `page.keyboard.press("Escape")`, asserts panel closed and no cloud request
- [ ] All tests use the `test` fixture from `fixtures/app.ts`, call `stubCloudApi` before send, and call `resetSettings` in `beforeEach`
- [ ] All tests pass in under 30 s each

---

### T08: W2 — Vault Operations Spec
**Description:** Implement `e2e/tests/02-vault-operations.spec.ts`. Vault is the most stateful workflow: tests must pre-seed and post-verify vault state across add, edit, delete, export, and deduplication scenarios. Use `seedVault` from `helpers/store.ts` to pre-populate entries for substitution tests rather than navigating the UI for every test (UI flow is tested in the "add entry" test only).

**Files:**
- `apps/desktop/e2e/tests/02-vault-operations.spec.ts` — create

**SharedFiles:** none

**Dependencies:** T06

**Effort:** L

**Acceptance:**
- [x] Test: `add entry manually — appears in vault list with generated placeholder` — navigates Settings → Privacy, fills add-entry form, asserts row visible with `[VAULT_PERSON_NAME_1]`
- [x] Test: `vault entry substituted in processed prompt` — seeds vault with `"Jan de Vries"`, sends matching message, asserts `ReviewPanel.getProcessedPrompt()` contains `[VAULT_PERSON_NAME_1]` and not `"Jan de Vries"`
- [x] Test: `delete entry — removed from list, no longer substituted in next chat` — deletes entry, sends same message, asserts review panel now contains raw name
- [x] Test: `export vault — downloaded JSON has required fields` — uses `page.waitForEvent("download")`, parses JSON, asserts `id`, `text`, `category`, `placeholder`, `useCount`, `confirmedAt` fields present for each entry
- [x] Test: `duplicate entry not added twice` — adds same text twice, asserts vault count is 1
- [x] Test: `useCount increments after vault entry substituted and approved` — seeds entry, sends+approves, re-reads vault store, asserts `useCount` is 1
- [x] `beforeEach` calls `clearVault(page)` to guarantee isolation
- [x] All tests pass in under 30 s each
  - Completed: 2026-06-23
  - Validated: micro-persona PASS
  - Files: apps/desktop/e2e/tests/02-vault-operations.spec.ts

---

### T09: W3 — Incognito Mode Spec
**Description:** Implement `e2e/tests/03-incognito-mode.spec.ts`. Incognito tests verify localStorage/IndexedDB non-persistence. Because the Vite dev server approach does not allow a true app restart, "restart" is simulated via `page.reload()` — which re-initializes Zustand from storage, faithfully reproducing the persistence behavior. A comment in the test file documents this simulation.

**Files:**
- `apps/desktop/e2e/tests/03-incognito-mode.spec.ts` — create

**SharedFiles:** none

**Dependencies:** T06

**Effort:** S

**Acceptance:**
- [ ] Test: `incognito conversation not persisted after page reload` — creates incognito chat, sends message, calls `page.reload()`, asserts conversation absent from sidebar
- [ ] Test: `regular conversation persists across reload` — creates regular chat, sends message, reloads, asserts conversation still in sidebar
- [ ] Test: `incognito visual indicator visible in chat header` — asserts incognito badge/banner visible in header when incognito chat is active
- [ ] Test: `regular and incognito coexist — only regular survives reload` — creates both, sends messages to each, reloads, asserts correct state
- [ ] `beforeEach` calls `clearConversations(page)` to start from empty history
- [ ] All tests pass in under 30 s each

---

### T10: W4 — Always Review Mode Spec
**Description:** Implement `e2e/tests/04-always-review-mode.spec.ts`. The key invariant: with `alwaysReviewBeforeSend: true`, the review panel must appear even for messages with no PII. The regression guard test (`skipCloudReview` must not suppress always-review) requires `seedSettings` to set `skipCloudReview: true` alongside `alwaysReviewBeforeSend: true` and assert the panel still appears.

**Files:**
- `apps/desktop/e2e/tests/04-always-review-mode.spec.ts` — create

**SharedFiles:** none

**Dependencies:** T06

**Effort:** M

**Acceptance:**
- [ ] Test: `plain message — review panel shown even with no PII` — seeds `alwaysReviewBeforeSend: true`, sends `"Hello"`, asserts `prompt-review-panel` visible
- [ ] Test: `send blocked until approve clicked` — asserts no cloud request fires before approve; fires after
- [ ] Test: `cancel returns message to input unchanged` — clicks cancel, asserts input field contains original message text
- [ ] Test: `disabling always-review — plain messages skip panel` — sets `alwaysReviewBeforeSend: false`, sends plain message, asserts panel never visible
- [ ] Test: `skipCloudReview=true does NOT bypass always-review panel` — seeds both flags true, sends message, asserts panel still appears (regression guard)
- [ ] Test: `Escape key does not dismiss panel in always-review mode` — presses Escape, asserts panel still visible
- [ ] `beforeEach` calls `resetSettings(page)` and re-seeds `alwaysReviewBeforeSend` per test
- [ ] All tests pass in under 30 s each

---

### T11: W5 — Prompt Transparency Spec
**Description:** Implement `e2e/tests/05-prompt-transparency.spec.ts`. These tests verify the informational elements of the review panel: attribute count badge, percentage-reduced badge, the collapsible original-message section, and the `[ATTR_*]` pattern in the processed prompt. Backend must be set to `hybrid` for attribute extraction to activate.

**Files:**
- `apps/desktop/e2e/tests/05-prompt-transparency.spec.ts` — create

**SharedFiles:** none

**Dependencies:** T06

**Effort:** M

**Acceptance:**
- [ ] Test: `attribute count badge visible (> 0) after PII message in hybrid mode` — seeds `preferredBackend: "hybrid"`, sends IBAN + income message, asserts `pii-redaction-count` element shows a number > 0
- [ ] Test: `privacy info region visible in review panel` — asserts `privacy-info-region` is visible and contains text about extracted attributes
- [ ] Test: `processed prompt does not contain raw financial PII` — asserts `"75,000"` and IBAN number absent from `getProcessedPrompt()`
- [ ] Test: `cloud POST body does not contain raw PII` — uses `captureCloudRequest`, asserts no raw PII in request messages array
- [ ] Test: `original message section shows raw PII (show-original toggle)` — clicks "Show original" expander, asserts raw PII visible in that section only
- [ ] `beforeEach` calls `resetSettings(page)` then `seedSettings(page, { preferredBackend: "hybrid" })`
- [ ] All tests pass in under 30 s each

---

## Phase 3: CI/CD and Documentation

### T12: GitHub Actions E2E Workflow
**Description:** Create `.github/workflows/e2e.yml`. The job runs on `ubuntu-latest` against the Vite dev server (no Tauri binary needed, per REQ-INFRA-02). It installs Node 22, pnpm 10, Playwright Chromium, and runs `pnpm test:e2e`. Artifacts (HTML report + test-results) are uploaded on failure. Timeout is 15 minutes. The workflow does NOT install Rust or build the Tauri binary — that separation is intentional and saves ~12 minutes of CI time compared to the design.md approach.

**Files:**
- `.github/workflows/e2e.yml` — create

**SharedFiles:**
- `.github/workflows/` — currently contains `release.yml` and `claude.yml`; this adds a third file with no conflicts

**Dependencies:** T07, T08, T09, T10, T11

**Effort:** S

**Acceptance:**
- [ ] `e2e.yml` triggers on `push` to `main` and `pull_request`
- [ ] Job: `ubuntu-latest`, `timeout-minutes: 15`
- [ ] Steps: `actions/checkout@v4`, `pnpm/action-setup@v4` (version 10), `actions/setup-node@v4` (version 22, pnpm cache), `pnpm install --frozen-lockfile`, `pnpm exec playwright install --with-deps chromium`, `pnpm test:e2e` (working-directory: `apps/desktop`)
- [ ] Artifact upload step uses `if: always()`, uploads `apps/desktop/e2e/reports/` and `apps/desktop/test-results/`
- [ ] Workflow does NOT install Rust, does NOT run `pnpm tauri build`
- [ ] `AILOCALMIND_TEST_MODE: "1"` and `AILOCALMIND_MOCK_CLOUD: "1"` set as job-level env vars
- [ ] On a clean push to main, the workflow runs green (all 5 workflow suites pass)

---

### T13: E2E README
**Description:** Create `apps/desktop/e2e/README.md` documenting: how to run the suite locally (with and without `pnpm dev` already running), how to run a single spec file, how to open the HTML report, how to add a new test (step-by-step), what each workflow covers (one-sentence summary per workflow), and the known issues and workarounds from design.md.

**Files:**
- `apps/desktop/e2e/README.md` — create

**SharedFiles:** none

**Dependencies:** T12 (written after the full suite exists so commands in the README are verified)

**Effort:** S

**Acceptance:**
- [ ] README covers: local run (`pnpm test:e2e`), single spec run (`pnpm test:e2e e2e/tests/02-vault-operations.spec.ts`), debug mode (`pnpm test:e2e:debug`), HTML report (`pnpm exec playwright show-report e2e/reports/html`)
- [ ] README lists all 5 workflows with coverage summary (scenario count + what privacy guarantee each verifies)
- [ ] README documents the 4 known issues from design.md: async GLiNER race, hover-to-reveal vault buttons, localStorage vs IndexedDB reset, Windows MAX_PATH on artifacts
- [ ] README includes a "How to add a new test" section covering the 6-step process from design.md section 6
- [ ] README does not exceed 400 lines; prioritizes operational commands over architecture prose

---

## Dependency Graph

```
T01 ──────────────────┐
T02 (needs T01) ──────┤
T03 (needs T01+T02) ──┼──▶ T06 (needs T01–T05) ──▶ T07 ──┐
T04 (needs T01+T02) ──┤                            T08 ──┤
T05 (needs T01) ──────┘                            T09 ──┼──▶ T12 ──▶ T13
                                                   T10 ──┤
                                                   T11 ──┘
```

T07–T11 can be parallelized across developers once T06 is complete. T13 is a single-developer task that can be drafted concurrently with T07–T11 and finalized after T12.

---

## Implementation Notes

**Spec vs. design discrepancy (resolved):** Specs (REQ-INFRA-02) require tests to run against the Vite dev server, not the compiled Tauri binary. Design.md describes an `electron.launch` binary strategy. Specs win. The Vite dev server approach (T01–T06) is CI-friendly on `ubuntu-latest`, requires no Rust toolchain in the E2E job, and reduces CI time from ~20 minutes to ~5 minutes. The `global-setup.ts` IPC stub (T02) is the key enabler.

**GLiNER test-mode gate:** The design requires `gliner_commands.rs` to return hardcoded fixture responses when `AILOCALMIND_TEST_MODE=1`. This gate is absent from the Rust source. T02's IPC stub mocks this at the JavaScript boundary (Tauri `invoke` is intercepted before it reaches Rust), so the Rust-side gate is not a blocker for the E2E suite — but it would be needed for any future test variant that launches the actual binary.

**data-testid audit:** Zero `data-testid` attributes currently exist in `apps/desktop/src/`. T06 must add them to all privacy-critical components listed in REQ-NFR-03. Expect 0.5–1 day of component review before writing POMs.

**Vault placeholder format:** Specs reference `[VAULT_PERSON_NAME_1]` style tokens. Confirm the actual placeholder format generated by `usePiiVaultStore.addEntry` before writing T08 assertions — a format mismatch will cause false negatives rather than surfacing real privacy bugs.

**SharedFiles summary:**
- `apps/desktop/package.json` — T01 (scripts + devDep), T02 (implicit via `playwright install` in CI)
- `apps/desktop/playwright.config.ts` — T01 (create), T02 (add `globalSetup` field)
- `.github/workflows/` — T12 only (new file, no conflict with existing workflows)
