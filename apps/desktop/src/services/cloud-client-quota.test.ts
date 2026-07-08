import { describe, it, expect, afterEach } from "vitest";
import { getCloudClient, resetCloudClients, parseRateLimit } from "./nebius";

// C2: the client parses the per-account `X-RateLimit-*` quota headers off every chat
// response and surfaces them (on the stream return), and turns a 429 into a friendly,
// provider-aware message instead of a raw "API error 429".

function sseResponse(lines: string[], headers: Record<string, string> = {}): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      for (const l of lines) controller.enqueue(enc.encode(l));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream", ...headers },
  });
}

const chunk = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`;

describe("parseRateLimit (C2)", () => {
  it("parses integer quota headers", () => {
    const q = parseRateLimit(
      new Headers({
        "X-RateLimit-Limit": "200",
        "X-RateLimit-Remaining": "150",
        "X-RateLimit-Reset": "1781230509",
      })
    );
    expect(q).toEqual({ limit: 200, remaining: 150, reset: 1781230509 });
  });

  it("preserves the 'unlimited' sentinel", () => {
    const q = parseRateLimit(
      new Headers({ "X-RateLimit-Limit": "unlimited", "X-RateLimit-Remaining": "unlimited" })
    );
    expect(q?.limit).toBe("unlimited");
    expect(q?.remaining).toBe("unlimited");
  });

  it("returns undefined when no quota headers are present", () => {
    expect(parseRateLimit(new Headers({}))).toBeUndefined();
  });
});

describe("streamChatCompletion — quota + 429 (C2)", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    resetCloudClients();
  });

  async function drain(
    stream: AsyncGenerator<string, { quota?: unknown }>
  ) {
    let content = "";
    while (true) {
      const next = await stream.next();
      if (next.done) return { content, ret: next.value };
      content += next.value;
    }
  }

  it("returns the quota parsed from the response headers", async () => {
    const lines = [
      chunk({
        id: "c", object: "chat.completion.chunk", created: 1, model: "m",
        choices: [{ index: 0, delta: { content: "ciao" }, finish_reason: null }],
      }),
      "data: [DONE]\n\n",
    ];
    global.fetch = (async () =>
      sseResponse(lines, { "X-RateLimit-Limit": "200", "X-RateLimit-Remaining": "150" })) as typeof fetch;

    const client = getCloudClient("normattiva", "k", "https://api.codicecivile.ai/api/v1");
    const { ret } = await drain(
      client.streamChatCompletion({ model: "m", messages: [{ role: "user", content: "hi" }] })
    );
    expect(ret.quota).toEqual({ limit: 200, remaining: 150, reset: undefined });
  });

  it("throws a friendly, quota-aware message on 429 (with the upgrade link)", async () => {
    global.fetch = (async () =>
      new Response("rate limited", {
        status: 429,
        headers: { "X-RateLimit-Limit": "50", "X-RateLimit-Remaining": "0" },
      })) as typeof fetch;

    const client = getCloudClient("normattiva", "k", "https://api.codicecivile.ai/api/v1");
    const stream = client.streamChatCompletion({ model: "m", messages: [{ role: "user", content: "hi" }] });

    let msg = "";
    try {
      await stream.next();
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).toMatch(/hit the request limit/i);
    expect(msg).toMatch(/Used 50\/50 this month/);
    expect(msg).toMatch(/codicecivile\.ai\/pricing/);
    // NOT the raw "API error 429" string
    expect(msg).not.toMatch(/API error/i);
  });
});
