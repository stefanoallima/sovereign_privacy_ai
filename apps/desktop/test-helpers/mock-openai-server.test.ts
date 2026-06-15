import { describe, it, expect, afterEach } from "vitest";
import { startMockOpenAIServer, type MockOpenAIServerHandle } from "./mock-openai-server";

describe("mockOpenAIServer", () => {
  let server: MockOpenAIServerHandle | null = null;

  afterEach(async () => {
    if (server) await server.close();
    server = null;
  });

  it("responds to GET /v1/models", async () => {
    server = await startMockOpenAIServer();
    const res = await fetch(`${server.baseUrl}/v1/models`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.map((m: { id: string }) => m.id)).toContain(
      "normattiva-legal-pro"
    );
  });

  it("responds to POST /v1/chat/completions with usage + x_normattiva", async () => {
    server = await startMockOpenAIServer();
    const res = await fetch(`${server.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer test",
      },
      body: JSON.stringify({
        model: "normattiva-legal-pro",
        messages: [{ role: "user", content: "Il mio cliente [PERSON_1]..." }],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.usage.total_tokens).toBe(59);
    expect(body.x_normattiva.citations[0].ref).toBe("c.c. art. 1456");
  });

  it("overrides per-path responses", async () => {
    server = await startMockOpenAIServer();
    server.setResponse("/v1/models", () => ({
      status: 401,
      body: JSON.stringify({ error: { message: "bad key" } }),
    }));
    const res = await fetch(`${server.baseUrl}/v1/models`);
    expect(res.status).toBe(401);
  });
});
