import { describe, it, expect, afterEach } from "vitest";
import { getCloudClient, resetCloudClients } from "./nebius";
import { startMockOpenAIServer, type MockOpenAIServerHandle } from "../../test-helpers/mock-openai-server";

describe("OpenAICompatibleClient — x_normattiva extension", () => {
  let server: MockOpenAIServerHandle | null = null;

  afterEach(async () => {
    resetCloudClients();
    if (server) await server.close();
    server = null;
  });

  it("returns x_normattiva in the non-streaming chatCompletion response", async () => {
    server = await startMockOpenAIServer();
    const client = getCloudClient("normattiva", "test-key", `${server.baseUrl}/v1`);
    const response = await client.chatCompletion({
      model: "normattiva-legal-pro",
      messages: [{ role: "user", content: "Ciao" }],
    });
    expect(response.x_normattiva).toBeDefined();
    expect(response.x_normattiva?.citations?.[0].ref).toBe("c.c. art. 1456");
    expect(response.x_normattiva?.tools_used).toContain("codici.search");
    expect(response.x_normattiva?.cost_estimate_eur).toBeCloseTo(0.0123);
  });

  it("returns undefined x_normattiva when the platform omits it", async () => {
    server = await startMockOpenAIServer();
    server.setResponse("/v1/chat/completions", () => ({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "chatcmpl-test",
        object: "chat.completion",
        created: 1781230509,
        model: "normattiva-legal-pro",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "ok" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    }));
    const client = getCloudClient("normattiva", "test-key", `${server.baseUrl}/v1`);
    const response = await client.chatCompletion({
      model: "normattiva-legal-pro",
      messages: [{ role: "user", content: "x" }],
    });
    expect(response.x_normattiva).toBeUndefined();
  });
});
