// e2e/fixtures/index.ts
// Shared Playwright test fixtures for AILocalMind E2E tests.
//
// Every test file should import `test` and `expect` from this module instead
// of @playwright/test directly. The custom `test` fixture injects the Tauri
// IPC stub via page.addInitScript() before the page loads, ensuring that
// @tauri-apps/api/core's invoke() resolves without a real Tauri binary.

import { test as base, expect, type Page } from "@playwright/test";
import { TAURI_IPC_STUB_SCRIPT, STUB_APP_SETTINGS } from "../global-setup";

export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    // Inject the stub before any page scripts run (including React/Vite).
    // addInitScript registers the script for execution on every navigation,
    // so it must be called before page.goto().
    await page.addInitScript(TAURI_IPC_STUB_SCRIPT);
    await use(page);
  },
});

export { expect };

/** Convenience: seed Zustand settings store via localStorage before page load. */
export async function seedSettings(
  page: Page,
  overrides: Partial<typeof STUB_APP_SETTINGS> = {}
): Promise<void> {
  const merged = { ...STUB_APP_SETTINGS, ...overrides };
  const storageValue = JSON.stringify({
    state: { settings: merged },
    version: 16,
  });
  await page.addInitScript(
    ({ key, value }: { key: string; value: string }) => {
      localStorage.setItem(key, value);
    },
    { key: "assistant-settings", value: storageValue }
  );
}

/** Convenience: clear all persisted state (localStorage + IndexedDB). */
export async function clearAllState(page: Page): Promise<void> {
  await page.evaluate(async () => {
    localStorage.clear();
    // indexedDB.databases() is not available in all browsers; guard it
    if (typeof indexedDB.databases === "function") {
      const dbNames = await indexedDB.databases();
      for (const db of dbNames) {
        if (db.name) indexedDB.deleteDatabase(db.name);
      }
    }
  });
}
