// e2e/global-setup.ts
// Exports a default globalSetup function wired via playwright.config.ts.
// Sets test-mode env vars and makes the Tauri IPC stub available to all tests
// via the exported TAURI_IPC_STUB_SCRIPT string that fixtures inject with
// page.addInitScript() before React mounts.

import type { FullConfig } from "@playwright/test";

// ---------------------------------------------------------------------------
// Fixture responses — the canonical stub data used by all e2e tests.
// Tests can import these constants to assert against exact values.
// ---------------------------------------------------------------------------

export const STUB_APP_SETTINGS = {
  nebiusApiKey: "e2e-stub-key",
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
  // privacyMode is the canonical field in AppSettings; preferredBackend is an
  // alias that some test assertions use (maps to the same value).
  privacyMode: "hybrid" as const,
  preferredBackend: "hybrid" as const,
  localModeModel: "qwen3-1.7b",
  hybridModeModel: "minimax-m2",
  cloudModeModel: "minimax-m2",
  airplaneMode: false,
  airplaneModeModel: "qwen3-1.7b",
  cloudTrustLevel: null as null,
  skipCloudReview: false,
  alwaysReviewBeforeSend: false,
  theme: "light" as const,
  showTokenCounts: true,
  showModelSelector: true,
  glinerEnabled: false,
  glinerModelId: null as null,
  glinerConfidenceThreshold: 0.4,
  autoRedactAllContent: false,
};

export const STUB_DETECT_PII_RESULT = {
  entities: [],
  redacted: null, // filled dynamically from the input text at runtime
};

export const STUB_CONVERSATIONS: unknown[] = [];

// ---------------------------------------------------------------------------
// The IPC stub script — injected into every page via page.addInitScript()
// before the app's JavaScript runs. Implements window.__TAURI_INTERNALS__.invoke
// so that @tauri-apps/api/core's invoke() resolves without a real Tauri binary.
// ---------------------------------------------------------------------------

export const TAURI_IPC_STUB_SCRIPT = `
(function () {
  // Fixture responses — must stay in sync with STUB_* constants in global-setup.ts
  var APP_SETTINGS = ${JSON.stringify(STUB_APP_SETTINGS)};

  function handleInvoke(cmd, args) {
    switch (cmd) {
      case 'detect_pii':
        return Promise.resolve({ entities: [], redacted: (args && args.text) || '' });

      case 'detect_pii_with_gliner':
        // Returns an array of DetectedEntity (empty = no PII found)
        return Promise.resolve([]);

      case 'get_app_settings':
        return Promise.resolve(APP_SETTINGS);

      case 'get_conversations':
        return Promise.resolve([]);

      // At-rest encryption for zustand stores (services/encrypted-storage).
      // Fake, reversible "cipher": the UTF-8 bytes themselves, so stores persist
      // and tests can read them back (see getStoreState in helpers/store.ts).
      case 'encrypt_string':
        return Promise.resolve(
          Array.from(new TextEncoder().encode((args && args.plaintext) || ''))
        );

      case 'decrypt_string':
        return Promise.resolve(
          new TextDecoder().decode(new Uint8Array((args && args.ciphertext) || []))
        );

      // Privacy routing: behave like a safe hybrid/full-text decision that
      // passes the (already locally redacted) text through unchanged. A test
      // can override fields (e.g. attributes_only) via
      // window.__E2E_PRIVACY_DECISION__.
      case 'process_chat_with_privacy':
        return Promise.resolve(Object.assign({
          prompt: (args && args.text) || '',
          backend: 'hybrid',
          model: null,
          is_safe: true,
          content_mode: 'full_text',
          info: 'E2E stub: full text',
        }, window.__E2E_PRIVACY_DECISION__ || {}));

      // Graceful no-ops for commands not covered by the stub
      default:
        return Promise.resolve(null);
    }
  }

  // Minimal __TAURI_INTERNALS__ implementation expected by @tauri-apps/api/core
  var callbacks = new Map();

  function registerCallback(callback, once) {
    var id = Math.floor(Math.random() * 0xFFFFFFFF);
    callbacks.set(id, function (data) {
      if (once) callbacks.delete(id);
      if (callback) callback(data);
    });
    return id;
  }

  function runCallback(id, data) {
    var cb = callbacks.get(id);
    if (cb) cb(data);
  }

  window.__TAURI_INTERNALS__ = window.__TAURI_INTERNALS__ || {};
  window.__TAURI_INTERNALS__.invoke = handleInvoke;
  window.__TAURI_INTERNALS__.transformCallback = registerCallback;
  window.__TAURI_INTERNALS__.runCallback = runCallback;
  window.__TAURI_INTERNALS__.unregisterCallback = function (id) { callbacks.delete(id); };
  window.__TAURI_INTERNALS__.callbacks = callbacks;

  // Window/webview metadata read by @tauri-apps/api/webviewWindow getCurrentWindow() /
  // getCurrentWebviewWindow(). ChatWindow.tsx calls getCurrentWebviewWindow().onDragDropEvent()
  // at mount; without this metadata that threw "Cannot read properties of undefined (reading
  // 'currentWindow')" and crashed the whole main app. (onDragDropEvent's listen() then resolves
  // via the stubbed invoke.)
  window.__TAURI_INTERNALS__.metadata = window.__TAURI_INTERNALS__.metadata || {
    currentWindow: { label: 'main' },
    currentWebview: { label: 'main' },
  };

  // Also expose on the legacy window.__TAURI__ path used by some feature checks
  window.__TAURI__ = window.__TAURI__ || {};
  window.__TAURI__.core = { invoke: handleInvoke };
})();
`;

// ---------------------------------------------------------------------------
// globalSetup — called once by Playwright before any test or browser launches.
// ---------------------------------------------------------------------------

export default async function globalSetup(_config: FullConfig): Promise<void> {
  // Signal to the app that it is running inside an E2E test harness.
  // The Vite dev server picks this up; Rust checks AILOCALMIND_TEST_MODE.
  process.env.AILOCALMIND_TEST_MODE = "1";
  process.env.AILOCALMIND_MOCK_CLOUD = "1";
}
