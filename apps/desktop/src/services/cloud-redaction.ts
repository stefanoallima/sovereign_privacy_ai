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
 *
 * ENFORCEMENT: the invariant is not left to convention. The OpenAI-compatible
 * client (`services/nebius.ts`) runs `redactKnownTerms` on every outbound message
 * as a mandatory egress backstop, so a call site that forgets to redact cannot
 * leak already-known PII.
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
 * Known-terms redaction: PII Vault + the profile-wide custom-term registry via
 * the Rust matcher. This is the CHEAP, deterministic pass (no GLiNER NER). It is
 * shared by `redactForCloud` (step 2) and, crucially, run by the cloud client as
 * an EGRESS BACKSTOP so already-known raw PII can never leave — even if a caller
 * forgot to call `redactForCloud` first.
 */
export async function redactKnownTerms(text: string): Promise<CloudRedaction> {
  const mappings = new Map<string, string>();
  if (!text || !text.trim()) return { redacted: text, mappings };

  const { useUserContextStore, selectActiveProfile } = await import(
    "@/stores/userContext"
  );
  let out = text;

  // Seed the ONE registry from the PII Vault so vault-saved values are covered
  // in every path (F3). ensureRedactTerm dedupes → one stable token per value.
  try {
    const { usePiiVaultStore } = await import("@/stores/piiVault");
    const ensureRedactTerm = useUserContextStore.getState().ensureRedactTerm;
    for (const entry of usePiiVaultStore.getState().entries) {
      if (entry.text && entry.text.trim().length >= 2) {
        ensureRedactTerm(entry.category, entry.text);
      }
    }
  } catch {
    // Vault unavailable — non-fatal; registry term-match below still applies.
  }

  // Profile-wide term-matching against the full registry (Rust).
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

/**
 * Canonical redactor for cloud-bound text.
 *   1. GLiNER NER -> stable tokens via `ensureRedactTerm` (registers new values
 *      so they are redacted identically everywhere from now on).
 *   2. Known-terms pass (`redactKnownTerms`): PII Vault + the profile-wide
 *      registry, covering every known value including those just registered.
 */
export async function redactForCloud(text: string): Promise<CloudRedaction> {
  const mappings = new Map<string, string>();
  if (!text || !text.trim()) return { redacted: text, mappings };

  const { useUserContextStore } = await import("@/stores/userContext");
  let out = text;

  // 1. GLiNER NER → stable registry tokens (novel-PII detection).
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
      // GLiNER unavailable — known-terms pass below still covers known PII.
    }
  }

  // 2. Known-terms pass (PII Vault + registry) — shared with the client backstop.
  const known = await redactKnownTerms(out);
  out = known.redacted;
  for (const [k, v] of known.mappings) mappings.set(k, v);

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
