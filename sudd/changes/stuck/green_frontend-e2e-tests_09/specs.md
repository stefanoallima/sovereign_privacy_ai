# Specs: Frontend E2E Tests for Privacy Workflows

**Change ID:** green_frontend-e2e-tests_09
**Status:** Planning Complete
**Depends on:** green_incognito-mode_04, green_pii-vault-ui_05, green_always-review-mode_08

---

## 1. Functional Requirements

### 1.1 Test Infrastructure

**REQ-INFRA-01: Playwright configuration**
- `apps/desktop/playwright.config.ts` must exist and be committed
- Config targets `http://localhost:5173` (Vite dev server, matching `tauri.conf.json` `devUrl`)
- Test command `pnpm test:e2e` must be declared in `apps/desktop/package.json`
- Chromium is the primary browser (fastest for CI); Firefox optional

**REQ-INFRA-02: App launch strategy**
- Tests run against the Vite dev server (`pnpm dev`), not the compiled Tauri binary
- `webServer` block in Playwright config starts `pnpm dev` and waits for port 5173
- Tauri-specific IPC calls (`invoke`) are mocked via a global `window.__TAURI_IPC__` stub injected in `globalSetup.ts`
- No real Tauri binary required; no real cloud credentials required

**REQ-INFRA-03: Cloud API mock**
- All `fetch` calls to `api.studio.nebius.ai` must be intercepted by Playwright route handlers
- Mock returns a canned assistant response: `"I can help you with that."` (non-streaming)
- Streaming responses are simulated via chunked SSE mock
- No `NEBIUS_API_KEY` required in the test environment

**REQ-INFRA-04: Clean state between tests**
- Each test starts with a fresh `localStorage` (cleared in `beforeEach`)
- Zustand stores (piiVault, chat, settings) reinitialize from cleared storage
- `page.evaluate(() => localStorage.clear())` called before each test suite

**REQ-INFRA-05: Page Object Models (POM)**
- `tests/e2e/pages/ChatPage.ts` — message input, send, sidebar new-chat, incognito toggle
- `tests/e2e/pages/SettingsPage.ts` — open settings dialog, navigate Privacy tab, toggle controls
- `tests/e2e/pages/VaultPage.ts` — add entry, search, delete, export button
- `tests/e2e/pages/ReviewPanel.ts` — read redacted prompt text, approve, cancel
- POMs expose only the selectors and actions tests need; no raw Playwright `page` access in test files

**REQ-INFRA-06: CI integration**
- `.github/workflows/e2e.yml` runs on every push and pull_request to `main`
- Job: `ubuntu-latest`, installs Node + pnpm + Playwright browsers, runs `pnpm test:e2e`
- Artifacts: test-results HTML report uploaded on failure
- Timeout: 15 minutes for the full CI job

---

### 1.2 Privacy Workflow Tests

#### Workflow W1: Chat → Redaction → Review → Approval

**REQ-W1-01: PII is detected and replaced in PromptReviewPanel**

Input message: `"My client Acme Corp owes me €5000 — invoice 2024-INV-001"`

Assertions:
- `PromptReviewPanel` becomes visible within 2 s of send
- `processedPrompt` textarea does NOT contain the string `"Acme Corp"`
- `processedPrompt` textarea does NOT contain `"5000"`
- `processedPrompt` textarea DOES contain at least one `[` placeholder token
- Original message section shows `"Acme Corp"` (toggling "Show Original" reveals it)

#### Scenario: Happy path — user approves
1. Type PII message, press Enter
2. Wait for `PromptReviewPanel` (`[data-testid="prompt-review-panel"]`)
3. Read `processedPrompt` textarea value
4. Assert no raw PII; assert placeholder tokens present
5. Click "Approve & Send"
6. Assert panel closes, assistant reply appears in chat

#### Scenario: Network mock captures redacted content
1. Set up Playwright route interceptor on `**/v1/chat/completions`
2. Complete happy-path flow
3. Assert request body does NOT contain `"Acme Corp"` or `"5000"`
4. Assert request body contains placeholder token from step 3

**REQ-W1-02: User can reject the review**

#### Scenario: User cancels review
1. Type PII message, press Enter
2. Wait for `PromptReviewPanel`
3. Click "Cancel" button
4. Assert panel closes
5. Assert no assistant reply was added to the chat
6. Assert no network request was made to the cloud API

**REQ-W1-03: Edge case — non-PII message skips review panel (hybrid mode without PII)**

#### Scenario: Plain message with no PII
1. Type: `"What is the capital of France?"`
2. Press Enter
3. Assert `PromptReviewPanel` is NOT shown (no PII detected)
4. Assert assistant reply appears directly

---

#### Workflow W2: PII Vault Operations

**REQ-W2-01: Add vault entry manually**

#### Scenario: Add entry via Settings → Privacy → PII Vault
1. Open Settings → Privacy tab
2. Locate PII Vault section (VaultBrowser component)
3. Fill "Add entry" form: text = `"Stefano Allima"`, category = `"person_name"`
4. Submit; assert entry appears in vault list with a `[VAULT_PERSON_NAME_1]` placeholder

**REQ-W2-02: Vault entry is substituted in outgoing message**

#### Scenario: Send message containing a vaulted name
1. Pre-populate vault with entry: `{ text: "Stefano Allima", category: "person_name" }`
2. Type message: `"Tell Stefano Allima about the contract terms"`
3. Press Enter
4. In `PromptReviewPanel`, assert `processedPrompt` contains `[VAULT_PERSON_NAME_1]`
5. Assert `processedPrompt` does NOT contain `"Stefano Allima"`

**REQ-W2-03: Delete vault entry**

#### Scenario: Delete single entry
1. Add entry `"TestCorp"` to vault
2. In VaultBrowser, hover over entry row to reveal action buttons
3. Click delete (trash icon button with `title="Delete entry"`)
4. Assert entry no longer appears in the list
5. Assert vault badge count decremented (or "No entries yet" shown if last entry)

**REQ-W2-04: Export vault as JSON**

#### Scenario: Export and verify format
1. Add two entries: `"Alice Smith"` (person_name), `"alice@example.com"` (email)
2. Click "Export Vault" button
3. Capture the download via Playwright's `page.waitForEvent('download')`
4. Read downloaded file content
5. Assert it is valid JSON; assert it contains both entries with fields: `id`, `text`, `category`, `placeholder`, `confirmedAt`, `useCount`

**REQ-W2-05: Edge case — duplicate vault entry is not added twice**

#### Scenario: Adding same text twice
1. Add entry: `"Alice Smith"`, category `"person_name"`
2. Attempt to add the same text again
3. Assert vault count remains 1 (the `addEntry` function returns the existing entry)

---

#### Workflow W3: Incognito Mode

**REQ-W3-01: New incognito chat is not persisted after reload**

#### Scenario: Incognito chat disappears on reload
1. Click "New incognito chat" button in sidebar (`[title="New incognito chat"]`)
2. Verify chat title area shows incognito indicator
3. Send a message: `"This is a secret"`
4. Assert assistant reply appears
5. Reload the page (`page.reload()`)
6. Assert the incognito conversation is NOT listed in the sidebar
7. Assert the message `"This is a secret"` is not visible anywhere

**REQ-W3-02: Incognito chat is visually distinct**

#### Scenario: Incognito badge visible
1. Create a new incognito chat
2. Assert sidebar shows the incognito section header
3. Assert the chat entry has the dashed border CSS class indicating incognito state
4. Assert the chat header shows the incognito privacy notice (`conversation?.isIncognito` banner)

**REQ-W3-03: Edge case — switching between incognito and regular chats**

#### Scenario: Regular chat persists when incognito chat does not
1. Create a regular chat; send one message `"Regular message"`
2. Create an incognito chat; send one message `"Incognito message"`
3. Reload the page
4. Assert regular chat and `"Regular message"` are present
5. Assert `"Incognito message"` is absent

---

#### Workflow W4: Always Review Enforcement

**REQ-W4-01: Sending with Always Review enabled always shows PromptReviewPanel**

#### Scenario: Every cloud send requires approval
1. Open Settings → Privacy
2. Enable "Always Review Before Send" toggle (`localStorage` key: `alwaysReviewBeforeSend`)
3. Type any message (no PII): `"Hello"`
4. Press Enter
5. Assert `PromptReviewPanel` appears (even though there is no PII to redact)
6. Click "Approve & Send"
7. Assert assistant reply appears

**REQ-W4-02: Review panel is non-dismissible under Always Review mode**

#### Scenario: Escape key does not close panel
1. Enable Always Review mode
2. Send a message; wait for `PromptReviewPanel`
3. Press Escape key
4. Assert panel is still visible (not dismissed)

**REQ-W4-03: Disabling Always Review returns to normal flow**

#### Scenario: Toggle off resumes direct send
1. Enable Always Review, then disable it
2. Send a message with no PII
3. Assert `PromptReviewPanel` does NOT appear
4. Assert assistant reply appears directly

---

#### Workflow W5: Prompt Transparency — Categorical Attributes Visible

**REQ-W5-01: PromptReviewPanel shows attribute count, not raw values**

#### Scenario: Hybrid mode with PII message shows attributes info
1. Set persona backend to `hybrid` (via settings or store direct manipulation)
2. Send message: `"I earn €75,000 per year and my IBAN is NL91ABNA0417164300"`
3. Wait for `PromptReviewPanel`
4. Assert the panel shows `attributesCount > 0` (numeric badge)
5. Assert the panel's `privacyInfo` region is visible
6. Assert processed prompt does NOT contain `"75,000"` or `"NL91ABNA0417164300"`

**REQ-W5-02: Network request contains only redacted prompt**

#### Scenario: Cloud request body contains placeholders, not raw PII
1. Intercept `**/v1/chat/completions` route
2. Send PII message and approve in review panel
3. Parse intercepted request body
4. Assert `messages[last].content` does NOT contain `"75,000"`
5. Assert `messages[last].content` does NOT contain the IBAN number
6. Assert `messages[last].content` contains at least one `[` placeholder

---

## 2. Non-Functional Requirements

**REQ-NFR-01: Performance**
- Full local suite (25+ tests, sequential): completes in under 10 minutes
- CI suite (25+ tests, 2 workers): completes in under 15 minutes
- Individual test timeout: 30 seconds; no test exceeds this without an explicit override

**REQ-NFR-02: Reliability**
- No test may rely on `page.waitForTimeout` with arbitrary delays
- All async waits must use Playwright's `waitForSelector`, `waitForResponse`, or `waitForEvent`
- Retry flakiness budget: `retries: 1` in CI, `retries: 0` locally
- A test that fails on every run must be fixed before merging

**REQ-NFR-03: Maintainability**
- All element selectors go through POMs; no raw CSS selector strings in test files
- Selector strategy priority: `data-testid` attributes > accessible role > text content > CSS class
- `data-testid` attributes required on: `PromptReviewPanel` root, approve button, cancel button, vault entry rows, incognito chat button, always-review toggle
- Test file names follow `workflow-name.spec.ts` convention
- Each test has a single-sentence description that explains the privacy guarantee being verified

**REQ-NFR-04: Documentation**
- `tests/e2e/README.md` documents: how to run locally, how to add a test, what each workflow covers
- Inline comments on any non-obvious async pattern or mock setup
- Test names must be self-documenting: `"vault entry substituted in processed prompt when PII matches"`

---

## 3. Test Coverage Matrix

| Workflow | File | Scenarios | Priority |
|---|---|---|---|
| W1: Chat → Redaction → Review → Approval | `chat-redaction-review.spec.ts` | 3 (happy, rejection, no-PII skip) | Critical |
| W2: PII Vault Operations | `vault.spec.ts` | 5 (add, substitute, delete, export, dedup) | Critical |
| W3: Incognito Mode | `incognito.spec.ts` | 3 (persistence, visual, mixed-mode) | Critical |
| W4: Always Review Enforcement | `always-review.spec.ts` | 3 (enforced, escape, toggle-off) | Critical |
| W5: Prompt Transparency | `transparency.spec.ts` | 2 (attribute count, network assertion) | Critical |

**Estimated test count:** 16 scenarios minimum; 20–25 with additional edge cases
**Estimated LOC:** 2,500–3,500 (test files + POMs + fixtures + globalSetup)

---

## 4. Platform and Environment

**Primary platform:** Windows 11 (developer machines and CI via `ubuntu-latest` Chromium)
**App launch:** Vite dev server at `http://localhost:5173` (no Tauri binary required for E2E)
**State isolation:** `localStorage.clear()` in `beforeEach`; no shared state between tests
**Cloud API:** All `fetch` to Nebius endpoints intercepted by Playwright `page.route()`; no real credentials needed
**Tauri IPC:** `window.__TAURI__` and `window.__TAURI_INTERNALS__` stubbed in `globalSetup.ts` to satisfy Tauri SDK initialization; Rust commands (`invoke`) return canned values

---

## 5. Acceptance Criteria Checklist

- [ ] `playwright.config.ts` exists; `pnpm test:e2e` passes locally with zero failures
- [ ] `.github/workflows/e2e.yml` runs on every push; green badge on `main`
- [ ] All 5 critical workflows have at least one passing test each
- [ ] Network assertion in W1/W5 confirms raw PII never reaches mock cloud endpoint
- [ ] `data-testid` attributes added to all selector-critical components
- [ ] Edge cases covered: rejection, vault dedup, incognito mixed-mode, escape-key non-dismiss
- [ ] `tests/e2e/README.md` documents local execution and workflow coverage

---

## 6. Dependencies and Constraints

**Hard dependencies (must be shipped before implementation begins):**
- `green_incognito-mode_04` — `isIncognito` on conversations, incognito button in Sidebar
- `green_pii-vault-ui_05` — VaultBrowser component, `usePiiVaultStore` with add/delete/export
- `green_always-review-mode_08` — `alwaysReviewBeforeSend` setting, non-dismissible PromptReviewPanel enforcement

**Constraints:**
- Tests MUST NOT require a compiled Tauri binary (build time too long for CI; use Vite dev server)
- Tests MUST NOT call real cloud APIs; all external HTTP must be intercepted
- `data-testid` attributes are the preferred selector anchor; implementation must add them to privacy-critical components if absent

---

## 7. Success Metrics

1. **Coverage:** 5/5 critical privacy workflows tested and passing in CI
2. **Regression safety:** A change that removes redaction or breaks vault substitution causes at least one test to fail before merge
3. **Developer experience:** `pnpm test:e2e` produces a readable pass/fail summary in under 10 minutes; failures include a screenshot and the intercepted network payload
