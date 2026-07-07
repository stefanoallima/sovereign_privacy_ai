/**
 * Shared Playwright test fixture for AILocalMind E2E tests.
 *
 * Import `test` from this module (not directly from @playwright/test) so that
 * every test automatically gets a clean state before it runs:
 *   - localStorage is cleared (wipes all Zustand-persisted stores)
 *   - IndexedDB conversation databases are deleted
 *
 * Usage:
 *   import { test } from "../fixtures/app";
 *   import { expect } from "@playwright/test";
 *
 *   test("my test", async ({ page }) => { ... });
 *
 * The beforeEach hook runs AFTER the page is created but BEFORE the test body,
 * so any seedVault() / seedSettings() calls in the test body execute on a
 * clean slate.
 */

import { test as base, type Page } from "@playwright/test";
import { TAURI_IPC_STUB_SCRIPT } from "../global-setup";

// Extend the base test with a beforeEach that resets all persisted state.
// We use base.extend with a custom `page` fixture that wraps the built-in one.
export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    // Clear all Zustand-persisted state (localStorage) and Dexie conversation
    // history (IndexedDB) before each test.  We do this before use() rather
    // than after so that a failing test leaves its state intact for
    // post-mortem debugging.
    //
    // Inject the Tauri IPC stub so @tauri-apps/api invoke() resolves without a real binary.
    await page.addInitScript(TAURI_IPC_STUB_SCRIPT);

    // Reset persisted state ONCE, on the app's real origin. Two constraints:
    //   - page.evaluate(() => localStorage.clear()) throws "SecurityError: Access is denied"
    //     on about:blank (before any navigation) in current Chromium — so we navigate first;
    //   - clearing via addInitScript would re-run on EVERY navigation, wiping state that the
    //     reload-persistence tests (e.g. 02-vault-operations' page.reload()) depend on — so we
    //     clear imperatively, exactly once, here.
    await page.goto("http://localhost:5173");
    await page.evaluate(() => {
      localStorage.clear();
      indexedDB.deleteDatabase("PrivateAssistantDB");
      indexedDB.deleteDatabase("ailocalmind");
    });

    await use(page);
  },
});

export { expect } from "@playwright/test";
