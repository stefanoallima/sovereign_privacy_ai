import type { LLMModel, NormattivaExtension } from "@/types";

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

  async *streamChatCompletion(
    options: ChatCompletionOptions
  ): AsyncGenerator<string, { inputTokens: number; outputTokens: number }> {
    const url = `${this.baseUrl}/chat/completions`;
    console.debug(`[Nebius] POST ${url} model=${options.model} key=${this.apiKey ? 'set' : '(none)'}`);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        ...options,
        stream: true,
      }),
    });

    if (!response.ok) {
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
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }

    // Estimate tokens (rough: ~4 chars per token)
    const inputTokens = Math.ceil(
      options.messages.reduce((sum, m) => sum + m.content.length, 0) / 4
    );
    const outputTokens = Math.ceil(totalContent.length / 4);

    return { inputTokens, outputTokens };
  }

  async chatCompletion(
    options: ChatCompletionOptions
  ): Promise<ChatCompletionResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        ...options,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Nebius API error: ${response.status} - ${error}`);
    }

    return response.json();
  }
}

// One client per (provider, baseUrl, apiKey) — keyed so different API keys can
// coexist. Normattiva and Nebius each get their own default endpoint.
const NORMATTIVA_DEFAULT_BASE = "https://api.normattiva.ai/v1";
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
