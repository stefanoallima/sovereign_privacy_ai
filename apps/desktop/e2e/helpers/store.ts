/**
 * Zustand store seeding helpers for AILocalMind E2E tests.
 *
 * All helpers operate via page.evaluate() so they write directly to the
 * webview's localStorage (where Zustand persist middleware stores state).
 * Conversation history lives in Dexie (IndexedDB) and is cleared separately.
 *
 * Key-to-store mapping:
 *   "pii-vault"          → usePiiVaultStore (piiVault.ts)
 *   "assistant-settings" → useSettingsStore (settings.ts)
 *   IndexedDB "PrivateAssistantDB" → Dexie db (lib/db.ts)
 */

import type { Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Internal types (mirrors src/types/index.ts — kept local so the e2e tree
// has no direct import dependency on the app's src/)
// ---------------------------------------------------------------------------

interface PiiVaultEntry {
  id: string;
  text: string;
  category: string;
  placeholder: string;
  confirmedAt: string;
  useCount: number;
}

interface AppSettings {
  nebiusApiKey: string;
  nebiusApiEndpoint: string;
  mem0ApiKey: string;
  enableMemory: boolean;
  useLocalMemory: boolean;
  defaultModelId: string;
  enabledModelIds: string[];
  defaultVoiceId: string;
  speechRate: number;
  pushToTalkKey: string;
  saveAudioRecordings: boolean;
  encryptLocalData: boolean;
  privacyMode: "local" | "hybrid" | "cloud";
  localModeModel: string;
  hybridModeModel: string;
  cloudModeModel: string;
  airplaneMode: boolean;
  airplaneModeModel: string;
  cloudTrustLevel: "trusted" | "partial" | "minimal" | null;
  skipCloudReview: boolean;
  theme: "light" | "dark" | "system";
  showTokenCounts: boolean;
  showModelSelector: boolean;
  glinerEnabled: boolean;
  glinerModelId: string | null;
  glinerConfidenceThreshold: number;
  autoRedactAllContent: boolean;
}

// ---------------------------------------------------------------------------
// Defaults (must stay in sync with src/stores/settings.ts DEFAULT_SETTINGS)
// ---------------------------------------------------------------------------

const DEFAULT_APP_SETTINGS: AppSettings = {
  nebiusApiKey: "",
  nebiusApiEndpoint: "https://api.tokenfactory.nebius.com/v1",
  mem0ApiKey: "",
  enableMemory: false,
  useLocalMemory: true,
  defaultModelId: "minimax-m2",
  enabledModelIds: ["minimax-m2"],
  defaultVoiceId: "en_US-lessac-medium",
  speechRate: 1.0,
  pushToTalkKey: "Ctrl+Space",
  saveAudioRecordings: false,
  encryptLocalData: true,
  privacyMode: "cloud",
  localModeModel: "qwen3-1.7b",
  hybridModeModel: "minimax-m2",
  cloudModeModel: "minimax-m2",
  airplaneMode: false,
  airplaneModeModel: "qwen3-1.7b",
  cloudTrustLevel: null,
  skipCloudReview: false,
  theme: "light",
  showTokenCounts: true,
  showModelSelector: true,
  glinerEnabled: false,
  glinerModelId: null,
  glinerConfidenceThreshold: 0.4,
  autoRedactAllContent: true,
};

// ---------------------------------------------------------------------------
// Helper: generate a vault placeholder in the same format as makePlaceholder()
// in piiVaultStore.ts: [VAULT_<CATEGORY>_<n>]
// ---------------------------------------------------------------------------

function makePlaceholder(category: string, index: number): string {
  const key = category.toUpperCase().replace(/\s+/g, "_");
  return `[VAULT_${key}_${index}]`;
}

// ---------------------------------------------------------------------------
// PII Vault helpers
// ---------------------------------------------------------------------------

/**
 * Seeds the PII vault store with the given entries.
 * Entries are written directly to localStorage under the "pii-vault" key in
 * Zustand's persist format.
 *
 * Must be called AFTER page.goto() so that localStorage is accessible for the
 * current origin.
 *
 * @param page    Playwright Page.
 * @param entries Array of { text, category } pairs. Placeholders are generated
 *                automatically in the same format as the app (VAULT_<CAT>_<n>).
 */
export async function seedVault(
  page: Page,
  entries: { text: string; category: string }[]
): Promise<void> {
  // Build counter map so each category gets incrementing placeholder indices,
  // matching the runtime behaviour of makePlaceholder() in piiVaultStore.ts.
  const counters: Record<string, number> = {};
  const now = new Date().toISOString();

  const vaultEntries: PiiVaultEntry[] = entries.map((e, i) => {
    const key = e.category.toUpperCase().replace(/\s+/g, "_");
    counters[key] = (counters[key] ?? 0) + 1;
    return {
      id: `pii-seed-${i}-${Date.now()}`,
      text: e.text,
      category: e.category,
      placeholder: makePlaceholder(e.category, counters[key]),
      confirmedAt: now,
      useCount: 0,
    };
  });

  const storageValue = JSON.stringify({
    state: { entries: vaultEntries },
    version: 0,
  });

  await page.evaluate(
    ({ key, value }: { key: string; value: string }) => {
      localStorage.setItem(key, value);
    },
    { key: "pii-vault", value: storageValue }
  );
}

/**
 * Clears all entries from the PII vault store (writes an empty entries array).
 *
 * @param page Playwright Page.
 */
export async function clearVault(page: Page): Promise<void> {
  await seedVault(page, []);
}

// ---------------------------------------------------------------------------
// App settings helpers
// ---------------------------------------------------------------------------

/**
 * Seeds the app settings store with DEFAULT_APP_SETTINGS merged with the
 * provided partial overrides.
 *
 * Written to localStorage under "assistant-settings" in Zustand's persist
 * format (version 16, matching the current migration version in settings.ts).
 *
 * Must be called AFTER page.goto().
 *
 * @param page    Playwright Page.
 * @param partial Partial AppSettings to override. Unspecified keys keep their
 *                defaults.
 */
export async function seedSettings(
  page: Page,
  partial: Partial<AppSettings> = {}
): Promise<void> {
  const merged: AppSettings = { ...DEFAULT_APP_SETTINGS, ...partial };

  const storageValue = JSON.stringify({
    state: { settings: merged },
    version: 16,
  });

  await page.evaluate(
    ({ key, value }: { key: string; value: string }) => {
      localStorage.setItem(key, value);
    },
    { key: "assistant-settings", value: storageValue }
  );
}

/**
 * Resets the app settings store to DEFAULT_APP_SETTINGS.
 *
 * @param page Playwright Page.
 */
export async function resetSettings(page: Page): Promise<void> {
  await seedSettings(page, {});
}

// ---------------------------------------------------------------------------
// Conversation / IndexedDB helpers
// ---------------------------------------------------------------------------

/**
 * Deletes the Dexie conversation database from IndexedDB.
 *
 * The actual Dexie DB name used by lib/db.ts is "PrivateAssistantDB".
 * Both names are deleted so this helper works regardless of which name the
 * running app version uses.
 *
 * @param page Playwright Page.
 */
export async function clearConversations(page: Page): Promise<void> {
  await page.evaluate(() => {
    // "PrivateAssistantDB" is the real name used in src/lib/db.ts
    indexedDB.deleteDatabase("PrivateAssistantDB");
    // "ailocalmind" is the canonical test-spec name kept for forward-compat
    indexedDB.deleteDatabase("ailocalmind");
  });
}

// ---------------------------------------------------------------------------
// Generic store state reader
// ---------------------------------------------------------------------------

/**
 * Reads a Zustand-persisted store from localStorage and returns the parsed
 * JSON object.
 *
 * @param page      Playwright Page.
 * @param storeName The localStorage key (e.g. "pii-vault", "assistant-settings").
 * @returns         The parsed JSON object, or null if the key is absent.
 */
export async function getStoreState(
  page: Page,
  storeName: string
): Promise<unknown> {
  return page.evaluate((key: string) => {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }, storeName);
}
