/**
 * Privacy assertion helpers for AILocalMind E2E tests.
 *
 * These helpers verify that PII redaction, placeholder substitution, and
 * cloud-payload sanitisation work correctly end-to-end.  All string checks
 * are case-insensitive so that "Jan de Vries", "jan de vries", and
 * "JAN DE VRIES" are all treated as the same PII value.
 */

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Normalises a string for case-insensitive comparison: lowercase and trim.
 *
 * @example
 * normalizeForComparison("  Jan de Vries  ") // "jan de vries"
 */
export function normalizeForComparison(text: string): string {
  return text.toLowerCase().trim();
}

// ---------------------------------------------------------------------------
// Throwing assertion helpers (async so callers can `await` them uniformly)
// ---------------------------------------------------------------------------

/**
 * Asserts that `prompt` does NOT contain `rawPii` (case-insensitive).
 *
 * Intended to verify that a redaction step has removed sensitive data before
 * the text is shown in the Review Panel or sent to a cloud API.
 *
 * @param prompt  - The text to inspect (e.g. the processed prompt shown in the
 *                  Review Panel).
 * @param rawPii  - The raw PII value that must not appear (e.g. "Jan de Vries").
 *
 * @throws Error  When `rawPii` is found inside `prompt`.
 *
 * @example
 * await verifyRedaction(reviewPanelText, "Jan de Vries");
 */
export async function verifyRedaction(
  prompt: string,
  rawPii: string,
): Promise<void> {
  const normalizedPrompt = normalizeForComparison(prompt);
  const normalizedPii = normalizeForComparison(rawPii);

  if (normalizedPrompt.includes(normalizedPii)) {
    throw new Error(
      `Redaction failed: raw PII detected in prompt: '${rawPii}'`,
    );
  }
}

/**
 * Asserts that `prompt` contains at least one substring matching `pattern`.
 *
 * Use this to confirm that a placeholder token (e.g. `[VAULT_PERSON_NAME_1]`
 * or `[ATTR_INCOME_BRACKET]`) was inserted at the redaction site.
 *
 * @param prompt  - The text to inspect.
 * @param pattern - A regular expression the placeholder must satisfy.
 *
 * @throws Error  When no match is found.
 *
 * @example
 * await verifyPlaceholder(processedPrompt, /\[VAULT_\w+_\d+\]/);
 * await verifyPlaceholder(processedPrompt, /\[ATTR_\w+\]/);
 */
export async function verifyPlaceholder(
  prompt: string,
  pattern: RegExp,
): Promise<void> {
  if (!pattern.test(prompt)) {
    throw new Error(
      `Placeholder not found: pattern ${pattern} not in prompt`,
    );
  }
}

/**
 * Asserts that none of the provided PII values appear in the stringified
 * cloud payload (case-insensitive).
 *
 * The entire payload object is serialised with `JSON.stringify` so nested
 * fields (e.g. `messages[].content`) are covered by a single scan.
 *
 * @param cloudPayload - The request body that will be (or was) sent to the
 *                       cloud API.
 * @param piis         - Array of raw PII strings that must not be present.
 *
 * @throws Error  On the first PII value that is found.
 *
 * @example
 * await verifyNoPII(cloudRequestBody, ["Jan de Vries", "5000"]);
 */
export async function verifyNoPII(
  cloudPayload: object,
  piis: string[],
): Promise<void> {
  const serialised = JSON.stringify(cloudPayload).toLowerCase();

  for (const pii of piis) {
    const normalizedPii = normalizeForComparison(pii);
    if (serialised.includes(normalizedPii)) {
      throw new Error(`PII detected in cloud payload: '${pii}'`);
    }
  }
}

// ---------------------------------------------------------------------------
// Non-throwing boolean helper
// ---------------------------------------------------------------------------

/**
 * Returns `true` when none of `rawValues` appear in the stringified `payload`
 * (case-insensitive), `false` otherwise.
 *
 * This is the non-throwing companion to {@link verifyNoPII}.  Use it when you
 * need a conditional branch rather than an assertion failure.
 *
 * @param payload    - Any serialisable object.
 * @param rawValues  - PII strings to scan for.
 *
 * @example
 * const safe = assertPayloadNoPII(outgoingBody, ["Jan de Vries"]);
 * if (!safe) { console.warn("Payload contains PII — blocking send"); }
 */
export function assertPayloadNoPII(
  payload: object,
  rawValues: string[],
): boolean {
  const serialised = JSON.stringify(payload).toLowerCase();

  for (const value of rawValues) {
    const normalizedValue = normalizeForComparison(value);
    if (serialised.includes(normalizedValue)) {
      return false;
    }
  }

  return true;
}
