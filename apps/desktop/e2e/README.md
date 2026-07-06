# AILocalMind E2E Test Suite

Playwright end-to-end tests for the five privacy-critical workflows in AILocalMind (Tauri 2 + React 19).

## Table of Contents

- [Running Tests Locally](#running-tests-locally)
- [Test Structure](#test-structure)
- [Adding New Tests](#adding-new-tests)
- [Known Issues and Workarounds](#known-issues-and-workarounds)
- [Test Coverage](#test-coverage)

---

## Running Tests Locally

### Prerequisites

The app must be built at least once before running tests. The test suite connects to the Vite dev server at `http://localhost:5173` — start it separately or let the full run handle it.

```bash
cd apps/desktop
pnpm install
```

### Full run (builds debug binary first)

```bash
cd apps/desktop
pnpm test:e2e
```

`global-setup.ts` sets `AILOCALMIND_TEST_MODE=1` and `AILOCALMIND_MOCK_CLOUD=1` before any test runs. When `SKIP_TAURI_BUILD` is not set, the setup also compiles a debug binary via `pnpm tauri build --debug` with `CARGO_TARGET_DIR=C:\tmp\tb` to avoid Windows MAX_PATH issues.

### Skip rebuild (reuse existing binary)

If you have already built the binary and only changed TypeScript:

```bash
# PowerShell
$env:SKIP_TAURI_BUILD = "1"
$env:TAURI_BIN = "C:/tmp/tb/debug/ailocalmind.exe"
pnpm test:e2e

# Git Bash / POSIX
SKIP_TAURI_BUILD=1 TAURI_BIN=C:/tmp/tb/debug/ailocalmind.exe pnpm test:e2e
```

### Single test file with debug flag

Run one spec file with the Playwright Inspector open (headed browser, step-through):

```bash
# PowerShell
$env:PWDEBUG = "1"
pnpm test:e2e --project=windows e2e/tests/02-vault-operations.spec.ts

# Git Bash
PWDEBUG=1 pnpm test:e2e --project=windows e2e/tests/02-vault-operations.spec.ts
```

`PWDEBUG=1` enables the inspector and slows execution so you can step through locator calls. Remove it for normal runs.

### Show HTML report

After any test run, open the HTML report at:

```bash
pnpm exec playwright show-report e2e/reports/html
```

Reports are written to `e2e/reports/html/` (HTML) and `e2e/reports/results.xml` (JUnit). Screenshots and traces for failed tests land in `test-results/` (Playwright default).

---

## Test Structure

### Directory layout

```
e2e/
  global-setup.ts          — env vars, Tauri IPC stub script, STUB_* constants
  tsconfig.json

  fixtures/
    app.ts                 — custom `test` fixture: clears localStorage + IndexedDB before each test
    index.ts               — alternative fixture: injects IPC stub via addInitScript

  pages/                   — Page Object Model classes
    ChatPage.ts            — sendMessage, waitForReviewPanel, getLastAssistantMessage, toggleIncognito
    ReviewPanel.ts         — getProcessedPrompt, getOriginalMessage, getPiiRedactionCount, approve, cancel
    VaultPage.ts           — openVault, addEntry, getEntries, deleteEntry, exportVault, clearAll
    SettingsPage.ts        — openSettings, setPrivacyMode, toggleAlwaysReview, toggleGliner, closeSettings

  helpers/
    network.ts             — stubCloudApi, captureCloudRequest, captureCloudPayload, toSSE
    privacy.ts             — verifyRedaction, verifyPlaceholder, verifyNoPII, assertPayloadNoPII
    store.ts               — seedVault, clearVault, seedSettings, resetSettings, clearConversations, getStoreState

  tests/
    00-stub-smoke.spec.ts  — verifies the IPC stub resolves without a real Tauri binary (5 tests)
    01-chat-redaction-review.spec.ts  — chat → redaction → review → approval (7 tests)
    02-vault-operations.spec.ts       — PII vault CRUD, export, substitution (9 tests)
    03-incognito-mode.spec.ts         — non-persistence, indicator, project explorer (4 tests)
    04-always-review-mode.spec.ts     — always-review enforcement, cancel flow, regression guards (6 tests)
    05-prompt-transparency.spec.ts    — attribute badges, no-PII badge, reduction %, collapsible (5 tests)

  reports/
    html/                  — Playwright HTML report (git-ignored generated output)
    results.xml            — JUnit XML (git-ignored generated output)
```

### Page Object Model pattern

Every UI surface is wrapped in a Page Object class under `pages/`. Tests never use raw Playwright locator strings directly — they call POM methods, which encapsulate the `data-testid` selectors and error messages.

Example flow:

```ts
const chatPage = new ChatPage(page);
await chatPage.sendMessage("My salary is EUR 5000.");

const reviewPanel = await chatPage.waitForReviewPanel();
const processedPrompt = await reviewPanel.getProcessedPrompt();

await verifyRedaction(processedPrompt, "EUR 5000");
await reviewPanel.approve();
```

All POM methods throw descriptive errors that include the `data-testid` selector and a timeout value, so failures are immediately actionable without reading the POM source.

### Fixture and beforeEach state isolation

Two fixture files exist depending on the test's launch strategy:

| Fixture | When to use | What it does |
|---------|-------------|--------------|
| `fixtures/app.ts` | Tests that run against a compiled Tauri binary | Clears `localStorage` + IndexedDB via `page.evaluate` before each test body |
| `fixtures/index.ts` | Tests that run against the Vite dev server with the IPC stub | Injects `TAURI_IPC_STUB_SCRIPT` via `page.addInitScript` before the page loads |

The `beforeEach` cleanup runs before `use()` (not `afterEach`), so a failing test leaves its state intact for post-mortem inspection.

State is isolated at two levels:

- **localStorage** — Zustand persists `pii-vault` and `assistant-settings` keys here. Cleared by `localStorage.clear()` in the fixture.
- **IndexedDB** — Dexie stores conversation history in `PrivateAssistantDB`. Cleared by `indexedDB.deleteDatabase(...)` in `clearConversations()`.

To pre-populate state after the page loads, call the helpers from `helpers/store.ts`:

```ts
await page.goto(APP_URL);
await clearVault(page);                                   // reset vault
await seedVault(page, [{ text: "Jan de Vries", category: "person name" }]);
await seedSettings(page, { privacyMode: "hybrid" });
await page.reload();   // required when seeding before Zustand hydrates
```

### Network mocking and state seeding

Cloud calls go to `https://api.tokenfactory.nebius.com/v1/chat/completions`. Every test that sends a message must stub this endpoint before calling `sendMessage`, otherwise the request reaches the real API (or hangs in `AILOCALMIND_MOCK_CLOUD=1` mode).

Use `stubCloudApi` when you only need the response:

```ts
await stubCloudApi(page, {
  choices: [{ delta: { content: "Understood." }, finish_reason: "stop" }],
});
```

Use `captureCloudPayload` when you also need to inspect what was sent:

```ts
const cloudPayload = await captureCloudPayload(page, async () => {
  await chatPage.sendMessage("My salary is EUR 5000.");
  const reviewPanel = await chatPage.waitForReviewPanel();
  await reviewPanel.approve();
});
await verifyNoPII(cloudPayload, ["EUR 5000"]);
```

`captureCloudPayload` registers a one-shot route before the action and returns the parsed JSON body after it fires. Do not call `stubCloudApi` on the same page before `captureCloudPayload` — both register routes for the same URL pattern and the first match wins.

The IPC stub (`global-setup.ts`) intercepts `window.__TAURI_INTERNALS__.invoke` and returns hardcoded responses for `detect_pii`, `detect_pii_with_gliner`, `get_app_settings`, and `get_conversations`. Override it for a single test with a second `page.addInitScript` that patches the handler after `DOMContentLoaded` (see `04-always-review-mode.spec.ts` test 5 for the pattern).

---

## Adding New Tests

### Template for a new spec file

Create `e2e/tests/NN-description.spec.ts`. Use `fixtures/app.ts` as the default fixture (it gives you the automatic per-test cleanup). Import `fixtures/index.ts` instead only when you need the IPC stub injection (tests that target the Vite dev server without a compiled binary).

```ts
// e2e/tests/06-my-new-workflow.spec.ts
//
// Workflow: <short description>
// Design reference: design.md § X.Y
// Requirements reference: specs.md § WN

import { expect } from "@playwright/test";
import { test } from "../fixtures/app";           // auto-clears state before each test
import { ChatPage } from "../pages/ChatPage";
import { ReviewPanel } from "../pages/ReviewPanel";
import { stubCloudApi, captureCloudPayload } from "../helpers/network";
import { verifyRedaction, verifyPlaceholder, verifyNoPII } from "../helpers/privacy";
import { seedVault, clearVault, seedSettings } from "../helpers/store";

// Test data: synthetic, structurally valid, no real people.
const PERSON_NAME = "Jan de Vries";

const STUB_RESPONSE = {
  choices: [{ delta: { content: "Understood." }, finish_reason: "stop" }],
};

const APP_URL = "http://localhost:5173";

test.describe("my-new-workflow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await clearVault(page);
    await seedSettings(page, { privacyMode: "hybrid" });
  });

  test("brief description of what is verified", async ({ page }) => {
    // 1. Seed the minimum state needed.
    await seedVault(page, [{ text: PERSON_NAME, category: "person name" }]);
    await page.reload();  // Zustand re-hydrates from localStorage after reload

    // 2. Stub the cloud API.
    const chatPage = new ChatPage(page);
    await stubCloudApi(page, STUB_RESPONSE);

    // 3. Interact and capture the cloud payload.
    const cloudPayload = await captureCloudPayload(page, async () => {
      await chatPage.sendMessage(`My client ${PERSON_NAME} has a question.`);
      const reviewPanel = await chatPage.waitForReviewPanel();
      await reviewPanel.approve();
    });

    // 4. Assert privacy guarantees.
    await verifyNoPII(cloudPayload, [PERSON_NAME]);
  });
});
```

### Required imports

| Import | From | Used for |
|--------|------|----------|
| `test` | `../fixtures/app` or `../fixtures/index` | Test fixture with auto state isolation |
| `expect` | `@playwright/test` | Playwright assertions |
| `ChatPage` | `../pages/ChatPage` | Sending messages, waiting for review panel |
| `ReviewPanel` | `../pages/ReviewPanel` | Reading processed prompt, approving, cancelling |
| `VaultPage` | `../pages/VaultPage` | Vault CRUD via the Settings dialog |
| `SettingsPage` | `../pages/SettingsPage` | Privacy mode, always-review, GLiNER toggles |
| `stubCloudApi`, `captureCloudPayload` | `../helpers/network` | Intercept cloud requests |
| `verifyRedaction`, `verifyPlaceholder`, `verifyNoPII` | `../helpers/privacy` | Privacy assertions |
| `seedVault`, `clearVault`, `seedSettings`, `getStoreState` | `../helpers/store` | Pre-populate and read Zustand state |

### beforeEach pattern

Always start from a known baseline:

```ts
test.beforeEach(async ({ page }) => {
  await page.goto(APP_URL);
  await clearVault(page);                          // empty the PII vault
  await seedSettings(page, { privacyMode: "hybrid" });  // known settings baseline
});
```

Individual tests can call `seedVault` after `beforeEach` to add entries they need, then `page.reload()` so Zustand picks them up from localStorage.

### Common patterns

**Send a message and assert no PII reaches the cloud:**

```ts
const cloudPayload = await captureCloudPayload(page, async () => {
  await chatPage.sendMessage(`Contact ${EMAIL_ADDRESS} for the invoice.`);
  const panel = await chatPage.waitForReviewPanel();
  await panel.approve();
});
await verifyNoPII(cloudPayload, [EMAIL_ADDRESS]);
```

**Assert the review panel shows a placeholder instead of raw PII:**

```ts
const panel = await chatPage.waitForReviewPanel();
const processedPrompt = await panel.getProcessedPrompt();
await verifyRedaction(processedPrompt, PERSON_NAME);
await verifyPlaceholder(processedPrompt, /\[VAULT_PERSON_NAME_\d+\]/);
```

**Read a Zustand store after an action completes:**

```ts
const storeRaw = await getStoreState(page, "pii-vault");
const store = storeRaw as { state: { entries: { text: string; useCount: number }[] } };
const entry = store.state.entries.find(e => e.text === PERSON_NAME);
expect(entry?.useCount).toBeGreaterThanOrEqual(1);
```

**Override the IPC stub for GLiNER detection:**

```ts
await page.addInitScript(`
  document.addEventListener("DOMContentLoaded", function () {
    if (window.__TAURI_INTERNALS__) {
      var orig = window.__TAURI_INTERNALS__.invoke;
      window.__TAURI_INTERNALS__.invoke = function (cmd, args) {
        if (cmd === "detect_pii_with_gliner") {
          return Promise.resolve([{ text: "Jan de Vries", label: "PERSON", score: 0.95, start: 0, end: 12 }]);
        }
        return orig(cmd, args);
      };
    }
  }, { once: true });
`);
```

### Do's and don'ts

**Do:**
- Import `test` from `../fixtures/app` or `../fixtures/index`, never from `@playwright/test` directly — the fixtures provide auto-cleanup.
- Call `clearVault` and `seedSettings` in every `beforeEach` so each test starts from a documented baseline.
- Stub the cloud API before any `sendMessage` call that may reach it.
- Reload the page after seeding localStorage so Zustand hydrates the seeded state.
- Use POM methods for all UI interaction — never write raw `page.getByTestId` strings in test bodies.
- Keep each `test()` body self-contained: seed only what that test needs, assert only what that test cares about.

**Don't:**
- Rely on state left by a previous test. Execution order is sequential but not guaranteed to stay that way.
- Use hardcoded numeric IDs or generated placeholder suffixes (e.g. `[VAULT_PERSON_NAME_1]`) unless you control the vault contents exactly — prefer regex patterns like `/\[VAULT_PERSON_NAME_\d+\]/`.
- Call `stubCloudApi` and `captureCloudPayload` on the same page sequentially — they both register routes for the same URL pattern. Use `captureCloudPayload` when you need both interception and stubbing.
- Skip `page.reload()` after `seedVault` or `seedSettings` unless the test calls `page.goto(APP_URL)` after seeding (which also triggers hydration).
- Put shared mutable state in `describe`-level variables. Keep test data as `const` at the top of the file.

---

## Known Issues and Workarounds

### Async race: GLiNER and review panel

GLiNER ONNX inference runs on a thread pool and may complete after the React state update that opens the review panel. Asserting `getPiiRedactionCount()` immediately after `sendMessage()` can return `0` even when redaction did fire.

**Workaround:** wait for the redaction-count badge to appear before reading its value:

```ts
await page.waitForSelector('[data-testid="pii-redaction-count"]', { state: "visible" });
const count = await reviewPanel.getPiiRedactionCount();
```

`ReviewPanel.getPiiRedactionCount()` already returns `0` gracefully when the badge is absent, so calls that assert `>= 1` are the ones that need this wait.

### Vault delete button opacity (hover-to-reveal)

`VaultBrowser` renders the delete and edit buttons inside a Tailwind `group` — they are `opacity-0` until the row is hovered. Clicking them directly without hovering fails silently (the click fires on an invisible element).

`VaultPage.deleteEntry()` already calls `row.hover()` before clicking, so use that method. If you write a custom locator for the delete button, add a hover step first:

```ts
await row.hover();
await row.getByTestId("vault-entry-delete").click();
```

### localStorage vs IndexedDB reset timing

Zustand-persisted stores (`pii-vault`, `assistant-settings`) live in `localStorage`. Conversation history lives in Dexie (`PrivateAssistantDB` in IndexedDB). Both must be cleared between tests or earlier tests' state leaks forward.

The `fixtures/app.ts` fixture clears `localStorage` in the page context and calls `clearConversations` (which deletes `PrivateAssistantDB` and `ailocalmind` from IndexedDB) before each test body. This runs before `use()` so a failing test leaves the browser with its state for inspection.

If you clear state manually in a `beforeEach`, run it **before** `page.goto()` when using `addInitScript`-based seeding (fixtures/index.ts), and **after** `page.goto()` when using `page.evaluate`-based seeding (fixtures/app.ts). The order matters because `page.evaluate` requires an active page context.

### Windows MAX_PATH on artifacts

Playwright writes test traces, screenshots, and videos to `test-results/` with deeply nested path names that can exceed Windows' 260-character limit.

**Workaround (local):** enable long paths in Windows (`LongPathsEnabled` registry key, or Developer Mode), or set a shorter artifacts directory:

```bash
$env:PLAYWRIGHT_ARTIFACTS_DIR = "D:\pw-art"
```

**Workaround (CI):** the GitHub Actions workflow sets `PLAYWRIGHT_ARTIFACTS_DIR=D:\pw-art` and uses `CARGO_TARGET_DIR=D:\ct` to keep Rust build outputs short. Artifact uploads in the workflow also use the same short path.

### GLiNER model absent in CI

GLiNER requires a downloaded ONNX model file at `{data_dir}/gliner-models/{model-id}/model.onnx`. CI runners do not have this file.

When `AILOCALMIND_TEST_MODE=1` is set, the Rust `detect_pii_with_gliner` command returns a hardcoded empty fixture response instead of invoking the model. Tests that need GLiNER to detect PII override the IPC stub in JavaScript (see `04-always-review-mode.spec.ts` test 5) rather than relying on a real model download.

Do not write tests that depend on the real GLiNER model being present. Use the JS stub-override pattern to simulate detection results.

---

## Test Coverage

### The five critical workflows (31 tests total)

| File | Workflow | Tests |
|------|----------|-------|
| `00-stub-smoke.spec.ts` | IPC stub health check | 5 |
| `01-chat-redaction-review.spec.ts` | Chat → Redaction → Review → Approval | 7 |
| `02-vault-operations.spec.ts` | PII Vault CRUD, export, substitution | 9 |
| `03-incognito-mode.spec.ts` | Incognito non-persistence and indicator | 4 |
| `04-always-review-mode.spec.ts` | Always-review enforcement and cancel flow | 6 |
| `05-prompt-transparency.spec.ts` | Attribute badges, reduction %, collapsible | 5 |

### Components covered

| Component | Covered by |
|-----------|-----------|
| `ChatWindow.tsx` (message input, send button) | 01, 02, 03, 04, 05 |
| `PromptReviewPanel.tsx` (processed prompt, badges, approve/cancel) | 01, 02, 04, 05 |
| `VaultBrowser.tsx` (add, list, delete, export, clear, search) | 02 |
| `SettingsDialog.tsx` + `PrivacySettings.tsx` | 02, 04 |
| `Sidebar.tsx` (incognito button, new-chat button, section headers) | 03 |
| `PiiConfirmationPanel.tsx` (novel GLiNER entity confirm flow) | 01 (T4) |
| Tauri IPC stub (`__TAURI_INTERNALS__.invoke`) | 00 |
| Zustand stores (`pii-vault`, `assistant-settings`) | all |
| Dexie `PrivateAssistantDB` (conversation persistence) | 03 |

### Privacy guarantees tested

- Raw PII does not appear in the cloud request body (`verifyNoPII` on the intercepted `captureCloudPayload` result).
- Vault-term substitution replaces known PII with `[VAULT_<CATEGORY>_<N>]` placeholders before the review panel shows them.
- GLiNER-detected novel entities are offered for vault addition via `PiiConfirmationPanel`; confirmed entries are persisted.
- Incognito conversations are never written to IndexedDB and disappear on page reload.
- `alwaysReviewBeforeSend` blocks every send regardless of PII detection, and `skipCloudReview` cannot suppress it (regression guard in test 6 of suite 04).
- The review panel's processed prompt never contains raw PII even when the collapsible "original message" section is expanded.

### Reference documents

- `design.md` — full architecture, mock strategy, CI workflow, debugging guide (this README summarises its §§ 2, 6).
- `specs.md` — workflow requirements (W1–W5) that each suite maps to.
