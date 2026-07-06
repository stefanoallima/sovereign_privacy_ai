import { vi } from "vitest";

// In a Node test env there is no `window.__TAURI_INTERNALS__`, so the real
// `@tauri-apps/api/core` `invoke` throws on every call. redactForCloud and the
// user-context store catch those errors and silently no-op, which would leave
// text un-redacted in tests. This mock returns deterministic results for the
// two IPC commands the chokepoint actually uses, plus a null default for
// anything else (preserving "unknown command" semantics).

vi.mock("@tauri-apps/api/core", () => ({
  invoke: async (cmd: string, args?: { text?: string; terms?: Array<{ label: string; value: string; replacement: string }> }) => {
    if (cmd === "detect_pii_with_gliner") {
      return [];
    }
    if (cmd === "redact_text_command") {
      const text: string = args?.text ?? "";
      const terms: Array<{ label: string; value: string; replacement: string }> = args?.terms ?? [];
      const mappings: Record<string, string> = {};
      let out = text;
      for (const t of terms) {
        if (out.includes(t.value)) {
          out = out.split(t.value).join(t.replacement);
          mappings[t.replacement] = t.value;
        }
      }
      return {
        text: out,
        mappings,
        redaction_count: Object.keys(mappings).length,
      };
    }
    return null;
  },
}));
