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
import { clearConversations } from "../helpers/store";

// Extend the base test with a beforeEach that resets all persisted state.
// We use base.extend with a custom `page` fixture that wraps the built-in one.
export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    // Clear all Zustand-persisted state (localStorage) and Dexie conversation
    // history (IndexedDB) before each test.  We do this before use() rather
    // than after so that a failing test leaves its state intact for
    // post-mortem debugging.
    //
    // page.evaluate() executes inside the webview/browser context.
    // localStorage.clear() wipes all Zustand persist keys for the current origin.
    await page.evaluate(() => {
      // eslint-disable-next-line no-restricted-globals
      localStorage.clear();
    });
    await clearConversations(page);

    await use(page);
  },
});

export { expect } from "@playwright/test";
