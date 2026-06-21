import { describe, it, expect, afterEach } from "vitest";
import { getCloudClient, resetCloudClients } from "./nebius";
import { startMockOpenAIServer, type MockOpenAIServerHandle } from "../../test-helpers/mock-openai-server";

describe("getCloudClient factory", () => {
  let server: MockOpenAIServerHandle | null = null;

  afterEach(async () => {
    resetCloudClients();
    if (server) await server.close();
    server = null;
  });

  it("returns a client whose baseUrl matches the provider default when none is passed", () => {
    const normattiva = getCloudClient("normattiva", "test-key");
    expect(normattiva).toBeDefined();
    // We don't expose baseUrl publicly; validate via /models below.
  });

  it("uses the explicit baseUrl when passed", async () => {
    server = await startMockOpenAIServer();
    // Mock server only serves /v1/*; pass baseUrl including /v1 to match
    // the convention used by the built-in factory defaults.
    const client = getCloudClient("normattiva", "test-key", `${server.baseUrl}/v1`);
    const ok = await client.validateApiKey();
    expect(ok).toBe(true);
  });

  it("uses the normattiva default endpoint when no baseUrl is passed", async () => {
    // We can't start a real server on the default endpoint in tests,
    // but we can verify the URL the client picks is what we expect by
    // exercising validateApiKey against a server that will 404 — the
    // resulting ok=false is enough; we separately assert the URL prefix
    // by spying on fetch.
    const originalFetch = global.fetch;
    let observedUrl = "";
    global.fetch = (async (url: string | URL | Request) => {
      observedUrl = String(url);
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

    try {
      const client = getCloudClient("normattiva", "k");
      await client.validateApiKey();
      expect(observedUrl.startsWith("https://api.normattiva.ai/v1/")).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("caches one client per (provider, apiKey, baseUrl) tuple", () => {
    const a = getCloudClient("normattiva", "k1");
    const b = getCloudClient("normattiva", "k1");
    expect(a).toBe(b);
    const c = getCloudClient("normattiva", "k2");
    expect(a).not.toBe(c);
  });
});