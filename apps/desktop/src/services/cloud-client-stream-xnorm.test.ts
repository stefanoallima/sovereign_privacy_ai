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
});
