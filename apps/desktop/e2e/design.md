# AILocalMind — Playwright E2E Test Suite Design

## Overview

This document describes the architecture and implementation plan for an end-to-end test suite covering the five privacy-critical workflows in AILocalMind. The app is built with Tauri 2 + React 19 and has no existing frontend integration tests; the only prior art is a Vitest unit suite for `VaultBrowser` (component-level, no Tauri invocations). The E2E layer must cross the Tauri IPC boundary and exercise real Rust modules — anonymization, redaction, GLiNER, backend routing — without hitting production cloud APIs.

---

## 1. Playwright Setup for Tauri

### Dependencies

```
pnpm add -D @playwright/test playwright
pnpm add -D @tauri-apps/cli   # already present
```

Playwright 1.44+ supports Tauri via `electronApp`-style binary launch. The recommended pattern wraps the compiled `.exe` or uses `pnpm tauri dev` as the server process.

### playwright.config.ts

```ts
// apps/desktop/playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  workers: 1,              // Tauri holds a single window; parallelism = sequential suites
  reporter: [
    ["html", { outputFolder: "e2e/reports/html" }],
    ["junit", { outputFile: "e2e/reports/results.xml" }],
  ],
  use: {
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "windows",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
```

### App Launch Strategy

Build a `global-setup.ts` that compiles a test binary once per CI run and stores the path:

```ts
// e2e/global-setup.ts
import { execSync } from "child_process";
import * as path from "path";

export default async function globalSetup() {
  // Set E2E_TEST_MODE so Rust skips Ollama model downloads
  process.env.AILOCALMIND_TEST_MODE = "1";
  process.env.AILOCALMIND_MOCK_CLOUD = "1";
  // Build is skipped locally when SKIP_TAURI_BUILD=1 is set
  if (!process.env.SKIP_TAURI_BUILD) {
    execSync("pnpm tauri build --debug", {
      cwd: path.resolve(__dirname, ".."),
      stdio: "inherit",
      env: { ...process.env, CARGO_TARGET_DIR: "C:\\tmp\\tb" },
    });
  }
  process.env.TAURI_BIN = "C:\\tmp\\tb\\debug\\ailocalmind.exe";
}
```

Each test file spawns the binary via a shared fixture. The app opens in its default window; Playwright connects to the embedded WebView2 (Windows) by capturing the DevTools port exposed with `--remote-debugging-port`:

```ts
// e2e/fixtures/app.ts
import { test as base, _electron as electron } from "@playwright/test";
import { spawn } from "child_process";

export const test = base.extend<{ app: Awaited<ReturnType<typeof electron.launch>> }>({
  app: async ({}, use) => {
    const app = await electron.launch({
      executablePath: process.env.TAURI_BIN!,
      args: ["--e2e"],           // custom flag — Tauri reads AILOCALMIND_TEST_MODE
    });
    const page = await app.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    await use(app);
    await app.close();
  },
});
```

> Note for Windows: WebView2 uses Chromium internals, so `electron.launch` connects correctly. On macOS (stretch goal), replace with the `.app` bundle path; the WebKit DevTools port requires `WEBKIT_INSPECTOR_SERVER` env var and a Playwright WebKit project entry.

### Network Mocking

Cloud calls go to `https://api.tokenfactory.nebius.com/v1/chat/completions` (Nebius OpenAI-compatible endpoint). Two mocking layers:

1. **Route interception** (preferred): inside each test, `page.route("**/v1/chat/completions", ...)` returns a canned SSE response. This works even for streamed responses.
2. **Environment stub**: set `AILOCALMIND_MOCK_CLOUD=1` and add a compile-time Tauri feature `mock-cloud` that replaces the HTTP client with an in-process stub returning deterministic JSON. This is the fallback when TLS/QUIC prevents browser-level interception.

---

## 2. Test Architecture

### Page Object Model

```
e2e/
  fixtures/
    app.ts          — electron.launch wrapper (shared fixture)
    state.ts        — Zustand store seeding helpers (via page.evaluate)
  pages/
    ChatPage.ts     — sendMessage, waitForReview, getLastBubble
    VaultPage.ts    — openSettings, addEntry, searchEntry, deleteEntry, export
    SettingsPage.ts — openDialog, setPrivacyMode, toggleAlwaysReview, toggleGliner
    ReviewPanel.ts  — waitForPanel, getProcessedPrompt, approve, cancel, toggleHistory
  helpers/
    privacy.ts      — verifyRedaction, verifyNoPII, verifyPlaceholder
    network.ts      — stubCloudApi, captureCloudRequest
    store.ts        — seedVault, clearVault, seedConversation, getStoreState
  tests/
    01-chat-redaction-review.spec.ts
    02-vault-operations.spec.ts
    03-incognito-mode.spec.ts
    04-always-review-mode.spec.ts
    05-prompt-transparency.spec.ts
```

### Key Page Objects (signatures)

```ts
// ChatPage
sendMessage(text: string): Promise<void>
waitForReviewPanel(): Promise<ReviewPanel>
getLastAssistantMessage(): Promise<string>
selectPersona(name: string): Promise<void>
selectModel(id: string): Promise<void>

// ReviewPanel
getProcessedPrompt(): Promise<string>
getOriginalMessage(): Promise<string>
getPiiRedactionCount(): Promise<number>
getAttributeBadges(): Promise<string[]>
approve(editOverride?: string): Promise<void>
cancel(): Promise<void>
toggleHistoryInclude(): Promise<void>

// VaultPage (via SettingsPage → Privacy tab)
addEntry(text: string, category: string): Promise<void>
getEntries(): Promise<{ text: string; category: string; placeholder: string }[]>
deleteEntry(text: string): Promise<void>
exportVault(): Promise<string>   // returns downloaded file path
clearAll(): Promise<void>

// SettingsPage
setPrivacyMode(mode: "local" | "hybrid" | "cloud"): Promise<void>
setAlwaysReview(enabled: boolean): Promise<void>
```

### Assertion Helpers

```ts
// helpers/privacy.ts
async function verifyRedaction(prompt: string, rawPii: string): Promise<void>
  // assert: prompt does not contain rawPii

async function verifyPlaceholder(prompt: string, pattern: RegExp): Promise<void>
  // assert: prompt contains a [VAULT_*] or [ATTR_*] token matching pattern

async function verifyNoPII(cloudPayload: object, piis: string[]): Promise<void>
  // assert: JSON.stringify(cloudPayload) does not contain any pii value

async function captureAndVerifyCloudPayload(
  page: Page,
  action: () => Promise<void>,
  checks: (payload: object) => void
): Promise<void>
  // wraps page.route, runs action, then calls checks on intercepted body
```

### Fixture Strategy

State isolation is achieved by seeding Zustand stores via `page.evaluate` before each test, which writes directly to `localStorage` (the persist middleware uses it). A `beforeEach` hook calls `clearVault()` and resets `settings` to a known baseline. Dexie (IndexedDB) conversations are cleared by evaluating `await db.conversations.clear()` inside the webview context. No file-system state is shared between tests since each binary launch gets a fresh Tauri data directory (set via `TAURI_DATA_DIR` env var pointing to a temp folder).

---

## 3. Test Structure by Workflow

### 3.1 Chat → Redaction → Review → Approval

**File:** `01-chat-redaction-review.spec.ts`

Matrix covers: names, monetary amounts, dates, email addresses; hybrid mode and cloud mode; with and without GLiNER enabled.

Key tests:
- `[hybrid] name PII appears as placeholder in review panel, not in cloud payload`
- `[hybrid] financial amount "[VAULT_INCOME_AMOUNT_1]" substituted before send`
- `[cloud] GLiNER off: term-matching redaction still fires on known vault entries`
- `[cloud] GLiNER on: novel email detected, confirmation panel shown, entry added to vault`
- `[hybrid] user edits sanitized prompt in review panel, edited version sent to cloud`
- `[hybrid] Ctrl+Enter keyboard shortcut approves and sends`
- `[hybrid] Esc keyboard shortcut cancels review and returns to input`

Assertions per test:
1. `ReviewPanel.getProcessedPrompt()` does not contain raw PII string
2. `captureAndVerifyCloudPayload` confirms no raw PII in messages array
3. `ReviewPanel.getPiiRedactionCount()` >= 1
4. After approval, assistant message appears in chat window

### 3.2 PII Vault Operations

**File:** `02-vault-operations.spec.ts`

Tests:
- `add entry via PiiConfirmationPanel: entity saved, placeholder shown in entry row`
- `add entry manually via Settings > Privacy > Vault: appears with generated placeholder`
- `search filters by text, category, placeholder`
- `edit entry: text updated, placeholder regenerated when category changes`
- `delete entry: removed from list, no longer substituted in next chat message`
- `export vault: downloaded JSON contains expected fields (id, text, category, placeholder, useCount, confirmedAt)`
- `clear all: confirmation dialog, then vault empty, chat sends raw text again`
- `vault substitution in chat: seed vault with "Jan de Vries"/"person name", send message containing that name, review panel shows [VAULT_PERSON_NAME_1] not the raw name`
- `useCount increments after vault entry substituted in approved message`

### 3.3 Incognito Mode

**File:** `03-incognito-mode.spec.ts`

Tests:
- `incognito conversation not persisted after app restart`
  1. Enable incognito flag when creating conversation
  2. Send a message, receive response
  3. Close app (`app.close()`), re-launch with same data dir
  4. Assert conversation absent from sidebar
- `non-incognito conversation survives restart`
- `incognito indicator visible in chat header`
- `incognito conversation absent from project explorer`

### 3.4 Always Review Mode

**File:** `04-always-review-mode.spec.ts`

Tests:
- `review panel shown even when no PII detected (plain message)`
- `send blocked until user explicitly clicks "Approve & Send"`
- `cancel from review panel returns message to input field unchanged`
- `disabling always-review mode: plain messages skip review panel`
- `always-review + GLiNER: both redaction and review fire correctly`
- `skipCloudReview=true bypasses panel even in always-review mode` (regression guard: `settings.skipCloudReview` must not override always-review)

The `skipCloudReview` field in `AppSettings` defaults to `false`. The always-review flag is a separate concern; this test guards against accidental suppression.

### 3.5 Prompt Transparency

**File:** `05-prompt-transparency.spec.ts`

Tests:
- `attribute badges visible in review panel (e.g., "3 attributes extracted")`
- `"No PII in prompt" badge shown when contentMode === attributes_only`
- `"X% reduced" badge correct relative to original word count`
- `original message collapsible section shows raw PII; processed prompt does not`
- `categorical attribute tokens in processed prompt match [ATTR_*] pattern`
- `history preview in review panel: AI messages not PII-redacted, user turns are`

---

## 4. Test Data and Mocking

### Test PII Values

Use synthetic but structurally valid data:

| Category        | Value                    | Expected Placeholder               |
|-----------------|--------------------------|-------------------------------------|
| person name     | Jan de Vries             | `[VAULT_PERSON_NAME_1]`            |
| email           | jan.devries@example.com  | `[VAULT_EMAIL_ADDRESS_1]`          |
| phone           | +31 6 12345678           | `[VAULT_PHONE_NUMBER_1]`           |
| income amount   | EUR 72.000               | `[VAULT_INCOME_AMOUNT_1]`          |
| date of birth   | 15-03-1985               | `[VAULT_DATE_OF_BIRTH_1]`          |
| tax ID          | 123.456.789              | `[VAULT_TAX_IDENTIFICATION_NUMBER_1]` |

All values are structurally realistic for Dutch locale (the app's tax domain) but do not correspond to any real person.

### Cloud API Mock

```ts
// helpers/network.ts
export function stubCloudApi(page: Page, response: object) {
  page.route("**/v1/chat/completions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: toSSE(response),
    });
  });
}

export function captureCloudRequest(page: Page): Promise<object> {
  return new Promise((resolve) => {
    page.route("**/v1/chat/completions", async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}");
      resolve(body);
      await route.continue();
    });
  });
}
```

The `toSSE` helper serializes a completion object into the `data: {...}\n\ndata: [DONE]\n\n` format that the Nebius client expects.

### Profile and Persona Fixtures

Each test file seeds a minimal persona via `store.ts`:

```ts
seedPersona({ id: "tax-navigator", name: "Tax Navigator", preferred_backend: "local" })
seedPersona({ id: "financial-advisor", name: "Financial Advisor", preferred_backend: "hybrid" })
```

Privacy mode is set via `SettingsPage.setPrivacyMode()` at the start of each describe block.

---

## 5. CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/e2e.yml
name: E2E Tests
on:
  push:
    branches: [main]
  pull_request:

jobs:
  e2e-windows:
    runs-on: windows-latest
    timeout-minutes: 45
    env:
      CARGO_TARGET_DIR: D:\ct
      CMAKE: "C:\\Program Files\\CMake\\bin\\cmake.exe"
      AILOCALMIND_TEST_MODE: "1"
      AILOCALMIND_MOCK_CLOUD: "1"
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 10 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
      - name: Cache Rust build
        uses: Swatinem/rust-cache@v2
        with: { workspaces: apps/desktop/src-tauri }
      - name: Install dependencies
        run: pnpm install
        working-directory: apps/desktop
      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps chromium
        working-directory: apps/desktop
      - name: Build Tauri (debug)
        run: pnpm tauri build --debug
        working-directory: apps/desktop
      - name: Run E2E tests
        run: pnpm test:e2e
        working-directory: apps/desktop
        env:
          SKIP_TAURI_BUILD: "1"   # binary already built above
          TAURI_BIN: D:\ct\debug\ailocalmind.exe
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-results
          path: |
            apps/desktop/e2e/reports/
            apps/desktop/test-results/
```

### Sequential Execution

`workers: 1` in `playwright.config.ts` ensures tests run sequentially. Tauri cannot open multiple windows in the same binary instance, and a single WebView2 process cannot be shared across parallel Playwright workers. Suites within the same worker run in the order defined by the glob; privacy-critical suites (01–05) run first.

Estimated CI time on `windows-latest`: build ~12 min, tests ~8 min = ~20 min total.

---

## 6. Debugging and Maintenance

### Running Locally

```bash
# Full run (builds debug binary first)
cd apps/desktop
pnpm test:e2e

# Skip rebuild (binary already at C:\tmp\tb\debug\ailocalmind.exe)
SKIP_TAURI_BUILD=1 TAURI_BIN=C:/tmp/tb/debug/ailocalmind.exe pnpm test:e2e

# Run a single suite with Playwright inspector (headed + slow-mo)
PWDEBUG=1 pnpm test:e2e --project=windows e2e/tests/02-vault-operations.spec.ts

# Show HTML report after run
pnpm exec playwright show-report e2e/reports/html
```

Add to `package.json`:
```json
"test:e2e": "playwright test",
"test:e2e:debug": "PWDEBUG=1 playwright test"
```

### Adding New Tests

1. Create `e2e/tests/NN-description.spec.ts`.
2. Import the `test` fixture from `../fixtures/app` (not from `@playwright/test` directly).
3. Use a `beforeEach` that calls `clearVault()` and `resetSettings()` from `helpers/store.ts`.
4. Seed only the minimum state needed (persona, privacy mode).
5. Mock the cloud API with `stubCloudApi` before any `ChatPage.sendMessage` call.
6. Keep each `test()` independent — never rely on state left by a previous test.

### Known Issues and Workarounds

**Async race: review panel appears before Tauri IPC resolves GLiNER**
The GLiNER ONNX inference runs on a thread pool and may complete after the React state update that opens the panel. Workaround: `await page.waitForSelector('[data-testid="pii-redaction-count"]', { state: "visible" })` instead of asserting immediately after `sendMessage`.

**Vault delete button opacity-0 until hover**
`VaultBrowser` shows delete/edit buttons only on `group-hover`. Use `page.hover(entrySelector)` before clicking the delete button, or override the CSS opacity in test mode via a `data-testid-force-visible` attribute added to the group div.

**LocalStorage vs. IndexedDB reset**
Zustand-persisted stores use `localStorage`; conversation history uses Dexie (IndexedDB). Both must be cleared between tests. The `clearAll` helper in `helpers/store.ts` calls `localStorage.clear()` and `indexedDB.deleteDatabase("ailocalmind")` via `page.evaluate`. Run this in `beforeEach`, not `afterEach`, so failures leave state intact for debugging.

**Windows MAX_PATH on artifact upload**
Test traces and screenshots land in `test-results/` with long nested paths. Add `LongPathsEnabled` to the CI runner or shorten paths by setting `PLAYWRIGHT_ARTIFACTS_DIR=D:\pw-art` in the workflow env.

**GLiNER model absent in CI**
GLiNER requires a downloaded ONNX model. In `AILOCALMIND_TEST_MODE=1`, the Rust `detect_pii_with_gliner` command returns a hardcoded fixture response instead of invoking the model. This gate must be present in `gliner_commands.rs` before the E2E suite is wired to CI.
