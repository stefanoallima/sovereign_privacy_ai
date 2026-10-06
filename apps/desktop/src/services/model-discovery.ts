/**
 * Model discovery for OpenAI-compatible endpoints.
 *
 * Asks the endpoint which models it serves (`GET {baseUrl}/models`) so the user can add
 * them without anyone maintaining model-id strings in the app. Only the API key leaves
 * the machine here — no user content — so this is outside the redaction chokepoint.
 */

export type DiscoveryProvider = "nebius" | "normattiva";

export class ModelDiscoveryError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "ModelDiscoveryError";
  }
}

const TIMEOUT_MS = 10_000;
const MAX_MODEL_IDS = 2000;

/**
 * A model id is sent back to the API as-is, so only accept plain identifiers: no
 * whitespace/control characters, bounded length. (Ids look like `org/Model-7B:tag`.)
 */
export function isValidModelId(id: string): boolean {
  return id.length > 0 && id.length <= 200 && /^[^\s\u0000-\u001f\u007f]+$/.test(id);
}

/** Plain http would put the API key on the wire in clear text; allow it only for loopback. */
export function isSafeEndpoint(baseUrl: string): boolean {
  let u: URL;
  try {
    u = new URL(baseUrl);
  } catch {
    return false;
  }
  if (u.protocol === "https:") return true;
  return (
    u.protocol === "http:" &&
    (u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]")
  );
}

/** Pull model ids out of the shapes OpenAI-compatible servers return. */
export function parseModelIds(body: unknown): string[] {
  const list: unknown[] = Array.isArray(body)
    ? body
    : Array.isArray((body as { data?: unknown })?.data)
      ? ((body as { data: unknown[] }).data)
      : Array.isArray((body as { models?: unknown })?.models)
        ? ((body as { models: unknown[] }).models)
        : [];
  const ids = list
    .map((m) =>
      typeof m === "string"
        ? m
        : typeof (m as { id?: unknown })?.id === "string"
          ? (m as { id: string }).id
          : ""
    )
    .map((id) => id.trim())
    .filter(isValidModelId);
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b)).slice(0, MAX_MODEL_IDS);
}

/**
 * Fetch the model ids an endpoint serves. Throws ModelDiscoveryError with a
 * user-presentable message on any failure.
 */
export async function fetchEndpointModels(
  baseUrl: string,
  apiKey: string
): Promise<string[]> {
  const base = baseUrl.trim().replace(/\/+$/, "");
  if (!base) throw new ModelDiscoveryError("No API endpoint configured.");
  const key = apiKey.trim();
  if (!key) throw new ModelDiscoveryError("Add an API key first.");
  if (!isSafeEndpoint(base)) {
    throw new ModelDiscoveryError(
      "Refusing to send your API key over an insecure or invalid endpoint. Use an https:// URL."
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: controller.signal,
    });
    if (response.status === 401 || response.status === 403) {
      throw new ModelDiscoveryError(
        "The endpoint rejected the API key.",
        response.status
      );
    }
    if (response.status === 404) {
      throw new ModelDiscoveryError(
        "This endpoint doesn't list models (no /models route). Add the model id manually.",
        404
      );
    }
    if (!response.ok) {
      throw new ModelDiscoveryError(
        `The endpoint returned an error (${response.status}).`,
        response.status
      );
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ModelDiscoveryError("The endpoint returned an unreadable response.");
    }
    return parseModelIds(body);
  } catch (e) {
    if (e instanceof ModelDiscoveryError) throw e;
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new ModelDiscoveryError("The endpoint took too long to respond.");
    }
    throw new ModelDiscoveryError(
      "Couldn't reach the endpoint. Check the URL and your connection."
    );
  } finally {
    clearTimeout(timer);
  }
}
