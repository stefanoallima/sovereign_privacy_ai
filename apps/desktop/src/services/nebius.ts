import type { LLMModel, NormattivaExtension, RateLimitInfo } from "@/types";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  /** OpenAI-SDK convention: ask for a final usage chunk with exact token counts (B2a). */
  stream_options?: { include_usage?: boolean };
}

export interface ChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }[];
  /** Additive Normattiva extension. The platform may emit it on the final
   *  content chunk (or a dedicated chunk); streamChatCompletion accumulates it. */
  x_normattiva?: NormattivaExtension;
  /** Exact token counts, emitted in a dedicated final chunk (choices: []) when
   *  stream_options.include_usage=true (B2a). */
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  /** Additive extension returned by the Normattiva legal agent. Standard
   *  OpenAI-compat clients ignore it; the desktop reads citations / tools /
   *  cost / (Phase 1) streaming agent stage from here. Optional — omitted
   *  when the platform does not emit it. */
  x_normattiva?: NormattivaExtension;
}

/** Parse the per-account quota from `X-RateLimit-*` response headers (C2). Values may be
 *  an integer or the string "unlimited"; returns undefined when the headers are absent. */
export function parseRateLimit(headers: Headers): RateLimitInfo | undefined {
  const parseVal = (v: string | null): number | "unlimited" | undefined => {
    if (v == null) return undefined;
    if (v.trim().toLowerCase() === "unlimited") return "unlimited";
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const limit = parseVal(headers.get("X-RateLimit-Limit"));
  const remaining = parseVal(headers.get("X-RateLimit-Remaining"));
  const resetRaw = headers.get("X-RateLimit-Reset");
  const reset =
    resetRaw != null && Number.isFinite(Number(resetRaw)) ? Number(resetRaw) : undefined;
  if (limit === undefined && remaining === undefined && reset === undefined) return undefined;
  return { limit, remaining, reset };
}

/** Friendly, provider-aware message for HTTP 429 (rate limit / monthly quota exhausted). */
function rateLimitMessage(quota: RateLimitInfo | undefined, baseUrl: string): string {
  const parts = ["You've hit the request limit."];
  if (typeof quota?.limit === "number" && typeof quota?.remaining === "number") {
    parts.push(`Used ${quota.limit - quota.remaining}/${quota.limit} this month.`);
  }
  if (baseUrl.includes("codicecivile.ai")) {
    parts.push("Upgrade at codicecivile.ai/pricing to continue.");
  } else {
    parts.push("Please try again later.");
  }
  return parts.join(" ");
}

export class OpenAICompatibleClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = "https://api.studio.nebius.ai/v1") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  setBaseUrl(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async validateApiKey(): Promise<boolean> {
    if (!this.apiKey) return false;

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * EGRESS BACKSTOP (defense-in-depth). Even if a caller forgot to redact, the
   * client strips all KNOWN PII (PII Vault + profile registry) from every message
   * before it hits the network — so already-known raw PII can never leave via
   * this client. Callers still run `redactForCloud` (incl. GLiNER novel-PII NER)
   * up front; this is the last line, not a replacement.
   */
  private async redactBackstop(messages: ChatMessage[]): Promise<ChatMessage[]> {
    try {
      const { redactKnownTerms } = await import("./cloud-redaction");
      return await Promise.all(
        messages.map(async (m) => ({
          ...m,
          content: (await redactKnownTerms(m.content)).redacted,
        }))
      );
    } catch (e) {
      // If the backstop itself fails, fall back to the caller-redacted messages
      // rather than blocking the send (callers already redact up front) — but make
      // the failure VISIBLE, since the last-line guarantee didn't run this time.
      console.warn("[cloud] egress redaction backstop failed; relying on caller redaction", e);
      return messages;
    }
  }

  async *streamChatCompletion(
    options: ChatCompletionOptions
  ): AsyncGenerator<
    string,
    {
      inputTokens: number;
      outputTokens: number;
      xNormattiva?: NormattivaExtension;
      quota?: RateLimitInfo;
    }
  > {
    const url = `${this.baseUrl}/chat/completions`;
    console.debug(`[cloud] POST ${url} model=${options.model} key=${this.apiKey ? 'set' : '(none)'}`);
    const messages = await this.redactBackstop(options.messages);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        ...options,
        messages,
        stream: true,
        // B2a: request a final usage chunk with exact token counts (caller may override).
        stream_options: { include_usage: true, ...options.stream_options },
      }),
    });

    // C2: per-account quota rides on the response headers (present on 200 and 429).
    const quota = parseRateLimit(response.headers);

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error(rateLimitMessage(quota, this.baseUrl));
      }
      const error = await response.text();
      throw new Error(`Nebius API error: ${response.status} - ${error}\n(endpoint: ${url}, model: ${options.model})`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let totalContent = "";
    let xNormattiva: NormattivaExtension | undefined;
    let usageFromStream: ChatCompletionChunk["usage"] | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;

        if (trimmed.startsWith("data: ")) {
          try {
            const json = JSON.parse(trimmed.slice(6)) as ChatCompletionChunk;
            const content = json.choices[0]?.delta?.content;
            if (content) {
              totalContent += content;
              yield content;
            }
            // B1: accumulate the Normattiva extension from any chunk that carries
            // it (the platform emits it on/near the final chunk). Later fields win.
            if (json.x_normattiva) {
              xNormattiva = { ...xNormattiva, ...json.x_normattiva };
            }
            // B2a: the include_usage final chunk carries exact token counts.
            if (json.usage) {
              usageFromStream = json.usage;
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }

    // B2a: prefer the platform's EXACT token counts (from the include_usage final
    // chunk); fall back to a char/4 estimate only if the platform didn't emit usage.
    const inputTokens =
      usageFromStream?.prompt_tokens ??
      Math.ceil(messages.reduce((sum, m) => sum + m.content.length, 0) / 4);
    const outputTokens =
      usageFromStream?.completion_tokens ?? Math.ceil(totalContent.length / 4);

    // B1: x_normattiva (citations + cost) accumulated across SSE chunks and returned so
    // the chat can render citation chips + a cost footer on the finalized message.
    return { inputTokens, outputTokens, xNormattiva, quota };
  }

  async chatCompletion(
    options: ChatCompletionOptions
  ): Promise<ChatCompletionResponse> {
    const messages = await this.redactBackstop(options.messages);
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        ...options,
        messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error(rateLimitMessage(parseRateLimit(response.headers), this.baseUrl));
      }
      const error = await response.text();
      throw new Error(`Nebius API error: ${response.status} - ${error}`);
    }

    return response.json();
  }
}

// One client per (provider, baseUrl, apiKey) — keyed so different API keys can
// coexist. Normattiva and Nebius each get their own default endpoint.
// Live codicecivile.ai OpenAI-compatible base (ratified 2026-07-07: `api.` host, `/api/v1` path).
const NORMATTIVA_DEFAULT_BASE = "https://api.codicecivile.ai/api/v1";
const NEBIUS_DEFAULT_BASE = "https://api.tokenfactory.nebius.com/v1";

const clientCache = new Map<string, OpenAICompatibleClient>();

function cacheKey(provider: string, baseUrl: string, apiKey: string): string {
  return `${provider}::${baseUrl}::${apiKey}`;
}

/**
 * Get (or create) an OpenAI-compatible client for the given provider.
 * Provider-specific defaults are filled in for `baseUrl`; pass an explicit
 * `baseUrl` to override (used in tests, and to point at staging).
 */
export function getCloudClient(
  provider: "nebius" | "ollama" | "normattiva",
  apiKey: string,
  baseUrl?: string
): OpenAICompatibleClient {
  const defaultBase =
    provider === "normattiva" ? NORMATTIVA_DEFAULT_BASE : NEBIUS_DEFAULT_BASE;
  const resolvedBase = (baseUrl ?? defaultBase).replace(/\/+$/, "");
  const key = cacheKey(provider, resolvedBase, apiKey);
  const existing = clientCache.get(key);
  if (existing) {
    existing.setApiKey(apiKey);
    return existing;
  }
  const client = new OpenAICompatibleClient(apiKey, resolvedBase);
  clientCache.set(key, client);
  return client;
}

/** Test helper — drop all cached clients. Not exported in index.ts. */
export function resetCloudClients(): void {
  clientCache.clear();
}

// Back-compat: keep the old singleton getter working. It now points at
// the Nebius provider.
export function getOpenAICompatibleClient(
  apiKey?: string,
  baseUrl?: string
): OpenAICompatibleClient {
  return getCloudClient("nebius", apiKey ?? "", baseUrl);
}
export const getNebiusClient = getOpenAICompatibleClient;

// Back-compat class alias. Existing call sites still import { NebiusClient };
// new code should use OpenAICompatibleClient directly. Remove this alias
// once all call sites migrate (tracked in a follow-up).
export { OpenAICompatibleClient as NebiusClient };

// Helper to estimate cost
export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  model: LLMModel
): number {
  const inputCost = (inputTokens / 1_000_000) * model.inputCostPer1M;
  const outputCost = (outputTokens / 1_000_000) * model.outputCostPer1M;
  return inputCost + outputCost;
}
