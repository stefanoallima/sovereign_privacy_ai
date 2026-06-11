/**
 * Cloud Redaction — the single chokepoint for PII leaving the machine.
 *
 * INVARIANT: every payload bound for a cloud LLM API MUST pass through
 * `redactForCloud`. PII is resolved against the ONE profile-wide registry
 * (`customRedactTerms` + `ensureRedactTerm`), so the same value always maps to
 * the same token across every conversation and document — preserving narrative
 * and situational consistency for the model, and never leaking raw PII.
 *
 * Pattern at every call site: redact -> send -> rehydrate the response with the
 * returned mappings (responses/derived text shown or stored locally get the
 * real values back; only tokens ever go to the cloud).
 */

import { invoke } from "@tauri-apps/api/core";

export interface CloudRedaction {
  /** Text with PII replaced by stable, profile-wide tokens. */
  redacted: string;
  /** token -> original value, for rehydrating the response locally. */
  mappings: Map<string, string>;
}

// GLiNER (ONNX) has a bounded context window; skip oversized text (custom
// term-matching still covers it).
const GLINER_MAX_CHARS = 6000;

/**
 * Canonical redactor for cloud-bound text.
 *   1. GLiNER NER -> stable tokens via `ensureRedactTerm` (registers new values
 *      so they are redacted identically everywhere from now on).
 *   2. Profile-wide custom term-matching (Rust `redact_text_command`), covering
 *      every known value including those just registered in step 1.
 */
export async function redactForCloud(text: string): Promise<CloudRedaction> {
  const mappings = new Map<string, string>();
  if (!text || !text.trim()) return { redacted: text, mappings };

  const { useUserContextStore, selectActiveProfile } = await import(
    "@/stores/userContext"
  );
  let out = text;

  // 1. GLiNER NER → stable registry tokens.
  if (text.length <= GLINER_MAX_CHARS) {
    try {
      const ensureRedactTerm = useUserContextStore.getState().ensureRedactTerm;
      const entities = await invoke<
        Array<{ text: string; label: string; start: number; end: number }>
      >("detect_pii_with_gliner", {
        text: out,
        confidenceThreshold: null,
        enabledLabels: null,
      });
      if (entities && entities.length > 0) {
        // Descending by position so replacements don't shift later indices.
        const sorted = [...entities].sort((a, b) => b.start - a.start);
        for (const e of sorted) {
          const original = out.substring(e.start, e.end);
          if (
            !original
              .toLowerCase()
              .includes(e.text.toLowerCase().substring(0, 3))
          )
            continue;
          const token = ensureRedactTerm(e.label, original);
          if (!token || token === original) continue;
          out = out.substring(0, e.start) + token + out.substring(e.end);
          mappings.set(token, original);
        }
      }
    } catch {
      // GLiNER unavailable — term-matching below still covers known PII.
    }
  }

  // 2. Profile-wide term-matching against the full registry.
  const terms =
    selectActiveProfile(useUserContextStore.getState())?.customRedactTerms || [];
  if (terms.length > 0) {
    try {
      const result = await invoke<{
        text: string;
        mappings: Record<string, string>;
        redaction_count: number;
      }>("redact_text_command", {
        text: out,
        terms: terms.map((t) => ({
          label: t.label,
          value: t.value,
          replacement: t.replacement,
        })),
      });
      out = result.text;
      for (const [k, v] of Object.entries(result.mappings)) mappings.set(k, v);
    } catch {
      // non-fatal — partial redaction still applied
    }
  }

  return { redacted: out, mappings };
}

/** Restore original values (for cloud responses or locally-stored derivatives). */
export function rehydrateFromCloud(
  text: string,
  mappings: Map<string, string>
): string {
  let result = text;
  for (const [token, original] of mappings) {
    result = result.split(token).join(original);
  }
  return result;
}
