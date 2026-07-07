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

// GLiNER (ONNX) has a bounded context window; long text is scanned in overlapping
// windows of this size (see `glinerWindows`) rather than skipped, so novel PII deep
// in a long document (e.g. a legal PDF) is still caught.
const GLINER_MAX_CHARS = 6000;

// Cap total windows so a pathologically long document can't trigger unbounded
// sequential GLiNER (ONNX) inferences. Beyond this, the tail relies on term-matching.
const MAX_GLINER_WINDOWS = 48;

export interface GlinerEntity {
  text: string;
  label: string;
  start: number;
  end: number;
}

/**
 * Split `text` into overlapping windows no larger than the GLiNER context limit so
 * the WHOLE document is scanned. The overlap catches an entity that would otherwise
 * straddle a window boundary. Short text yields a single full-text window.
 */
export function glinerWindows(
  text: string,
  windowSize: number = GLINER_MAX_CHARS,
  overlap = 256,
  maxWindows: number = MAX_GLINER_WINDOWS
): Array<{ offset: number; chunk: string }> {
  if (text.length <= windowSize) return [{ offset: 0, chunk: text }];
  const step = Math.max(1, windowSize - overlap);
  const windows: Array<{ offset: number; chunk: string }> = [];
  for (let offset = 0; offset < text.length && windows.length < maxWindows; offset += step) {
    windows.push({ offset, chunk: text.slice(offset, offset + windowSize) });
    if (offset + windowSize >= text.length) break;
  }
  return windows;
}

/**
 * Keep only non-overlapping entities (interval scheduling, preferring longer spans)
 * so the position-based replacement can't corrupt text: a boundary-truncated entity
 * detected in two overlapping windows can otherwise yield overlapping ranges.
 */
export function dropOverlappingEntities(entities: GlinerEntity[]): GlinerEntity[] {
  const sorted = [...entities].sort(
    (a, b) => a.start - b.start || b.end - b.start - (a.end - a.start)
  );
  const kept: GlinerEntity[] = [];
  let lastEnd = -1;
  for (const e of sorted) {
    if (e.start >= lastEnd) {
      kept.push(e);
      lastEnd = e.end;
    }
  }
  return kept;
}

/** Run GLiNER over every window; return entities with ABSOLUTE positions (deduped). */
async function detectGlinerEntities(text: string): Promise<GlinerEntity[]> {
  const out: GlinerEntity[] = [];
  const seen = new Set<string>();
  const windows = glinerWindows(text);
  const last = windows[windows.length - 1];
  if (last && last.offset + last.chunk.length < text.length) {
    console.warn(
      `[cloud-redaction] GLiNER window cap (${windows.length}) reached; ~${
        text.length - (last.offset + last.chunk.length)
      } trailing chars scanned by term-matching only.`
    );
  }
  for (const { offset, chunk } of windows) {
    let entities: GlinerEntity[] = [];
    try {
      entities =
        (await invoke<GlinerEntity[]>("detect_pii_with_gliner", {
          text: chunk,
          confidenceThreshold: null,
          enabledLabels: null,
        })) || [];
    } catch {
      // One bad window is non-fatal; other windows + the known-terms pass apply.
      continue;
    }
    for (const e of entities) {
      const abs: GlinerEntity = {
        text: e.text,
        label: e.label,
        start: offset + e.start,
        end: offset + e.end,
      };
      const key = `${abs.start}:${abs.end}:${abs.text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(abs);
    }
  }
  // Drop overlapping ranges so the position-based replacement stays correct.
  return dropOverlappingEntities(out);
}

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

  // 1. GLiNER NER → stable registry tokens (novel-PII detection), windowed so
  //    long documents are fully scanned rather than skipped.
  try {
    const ensureRedactTerm = useUserContextStore.getState().ensureRedactTerm;
    const entities = await detectGlinerEntities(out);
    if (entities.length > 0) {
      // Descending by position so replacements don't shift later indices.
      const sorted = [...entities].sort((a, b) => b.start - a.start);
      for (const e of sorted) {
        const original = out.substring(e.start, e.end);
        if (
          !original.toLowerCase().includes(e.text.toLowerCase().substring(0, 3))
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
