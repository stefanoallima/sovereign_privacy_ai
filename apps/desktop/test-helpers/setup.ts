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
      // Deterministic stand-in for the ONNX GLiNER model: detect a sentinel name
      // so tests can exercise GLiNER-driven redaction (incl. long-document
      // windowing) without the real model. Other test PII (e.g. "Mario Rossi") is
      // covered via the custom-term registry, not here. Called per window, so the
      // positions are chunk-relative and the caller offsets them to absolute.
      const text = args?.text ?? "";
      const SENTINEL = "Giulia Bianchi";
      const entities: Array<{ text: string; label: string; start: number; end: number }> = [];
      let i = text.indexOf(SENTINEL);
      while (i !== -1) {
        entities.push({ text: SENTINEL, label: "PERSON", start: i, end: i + SENTINEL.length });
        i = text.indexOf(SENTINEL, i + SENTINEL.length);
      }
      return entities;
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
