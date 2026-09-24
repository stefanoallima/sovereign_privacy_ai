/**
 * JS fallback redaction (case-insensitive). Used only when the Rust
 * redact_text_command is unavailable or fails, so known terms are still
 * redacted rather than sent in the clear.
 */
export function jsFallbackRedact(
  text: string,
  terms: Array<{ label: string; value: string; replacement: string }>
): { text: string; mappings: Map<string, string>; count: number } {
  const mappings = new Map<string, string>();
  let result = text;
  let count = 0;

  for (const term of terms) {
    if (!term.value || term.value.length < 2) continue;
    const escaped = term.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "gi");
    const matches = result.match(regex);
    if (matches && matches.length > 0) {
      count += matches.length;
      result = result.replace(regex, term.replacement);
      mappings.set(term.replacement, term.value);
    }
  }

  return { text: result, mappings, count };
}
