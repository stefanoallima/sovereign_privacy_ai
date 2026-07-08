import { describe, it, expect, afterEach } from "vitest";
import { getCloudClient, resetCloudClients } from "./nebius";

// B1: streamChatCompletion must accumulate the `x_normattiva` extension (citations +
// cost) from the SSE chunks and expose it via the generator's RETURN value, so the
// chat can render citation chips + a cost footer on the finalized message.

function sseResponse(lines: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      for (const l of lines) controller.enqueue(enc.encode(l));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

const chunk = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`;

describe("streamChatCompletion — x_normattiva accumulation (B1)", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    resetCloudClients();
  });

  async function drain(
    stream: AsyncGenerator<string, { inputTokens: number; outputTokens: number; xNormattiva?: unknown }>
  ) {
    let content = "";
    // Manual iteration: the generator's RETURN value carries xNormattiva.
    while (true) {
      const next = await stream.next();
      if (next.done) return { content, ret: next.value };
      content += next.value;
    }
  }

  it("accumulates citations + cost from the final content chunk into the return value", async () => {
    const lines = [
      chunk({
        id: "c", object: "chat.completion.chunk", created: 1, model: "normattiva-legal-pro",
        choices: [{ index: 0, delta: { content: "Ai sensi " }, finish_reason: null }],
      }),
      chunk({
        id: "c", object: "chat.completion.chunk", created: 1, model: "normattiva-legal-pro",
        choices: [{ index: 0, delta: { content: "dell'art. 1456 c.c." }, finish_reason: null }],
        x_normattiva: {
          citations: [
            { type: "article", ref: "c.c. art. 1456", title: "Clausola risolutiva espressa", url: "https://codicecivile.ai/codice-civile/art1456" },
          ],
          tools_used: ["codici.search"],
          cost_estimate_eur: 0.0142,
        },
      }),
      chunk({
        id: "c", object: "chat.completion.chunk", created: 1, model: "normattiva-legal-pro",
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      }),
      "data: [DONE]\n\n",
    ];
    global.fetch = (async () => sseResponse(lines)) as typeof fetch;

    const client = getCloudClient("normattiva", "k", "https://example.test/api/v1");
    const { content, ret } = await drain(
      client.streamChatCompletion({ model: "normattiva-legal-pro", messages: [{ role: "user", content: "art 1456?" }] })
    );

    expect(content).toContain("art. 1456");
    const x = ret.xNormattiva as { citations: { ref: string }[]; cost_estimate_eur: number };
    expect(x).toBeDefined();
    expect(x.citations[0].ref).toBe("c.c. art. 1456");
    expect(x.cost_estimate_eur).toBeCloseTo(0.0142);
  });

  it("returns undefined xNormattiva when no chunk carries the extension", async () => {
    const lines = [
      chunk({
        id: "c", object: "chat.completion.chunk", created: 1, model: "m",
        choices: [{ index: 0, delta: { content: "ciao" }, finish_reason: null }],
      }),
      "data: [DONE]\n\n",
    ];
    global.fetch = (async () => sseResponse(lines)) as typeof fetch;

    const client = getCloudClient("normattiva", "k", "https://example.test/api/v1");
    const { ret } = await drain(
      client.streamChatCompletion({ model: "m", messages: [{ role: "user", content: "x" }] })
    );
    expect(ret.xNormattiva).toBeUndefined();
  });

  // B2a: request stream_options.include_usage and use the platform's exact token counts.
  it("sends stream_options.include_usage and returns the platform's exact token counts", async () => {
    let sentBody: { stream?: boolean; stream_options?: { include_usage?: boolean } } | undefined;
    const lines = [
      chunk({
        id: "c", object: "chat.completion.chunk", created: 1, model: "m",
        choices: [{ index: 0, delta: { content: "ciao" }, finish_reason: null }],
      }),
      // The include_usage final chunk: empty choices, exact usage.
      chunk({
        id: "c", object: "chat.completion.chunk", created: 1, model: "m",
        choices: [], usage: { prompt_tokens: 312, completion_tokens: 184, total_tokens: 496 },
      }),
      "data: [DONE]\n\n",
    ];
    global.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      sentBody = JSON.parse(String(init?.body));
      return sseResponse(lines);
    }) as typeof fetch;

    const client = getCloudClient("normattiva", "k", "https://example.test/api/v1");
    const { ret } = await drain(
      client.streamChatCompletion({ model: "m", messages: [{ role: "user", content: "hi" }] })
    );

    expect(sentBody?.stream).toBe(true);
    expect(sentBody?.stream_options?.include_usage).toBe(true);
    // Exact counts from the platform, not a char/4 estimate.
    expect(ret.inputTokens).toBe(312);
    expect(ret.outputTokens).toBe(184);
  });

  it("falls back to an estimate when the platform emits no usage chunk", async () => {
    const lines = [
      chunk({
        id: "c", object: "chat.completion.chunk", created: 1, model: "m",
        choices: [{ index: 0, delta: { content: "some words here" }, finish_reason: null }],
      }),
      "data: [DONE]\n\n",
    ];
    global.fetch = (async () => sseResponse(lines)) as typeof fetch;
    const client = getCloudClient("normattiva", "k", "https://example.test/api/v1");
    const { ret } = await drain(
      client.streamChatCompletion({ model: "m", messages: [{ role: "user", content: "hi" }] })
    );
    // No usage chunk → estimated (non-zero) counts, not the exact platform values.
    expect(ret.outputTokens).toBeGreaterThan(0);
  });
});
