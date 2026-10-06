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
    .filter(Boolean);
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
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
  if (!apiKey.trim()) throw new ModelDiscoveryError("Add an API key first.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
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
