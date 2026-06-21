import { describe, it, expect, afterEach } from "vitest";
import { getCloudClient, resetCloudClients } from "./nebius";
import { startMockOpenAIServer, type MockOpenAIServerHandle } from "../../test-helpers/mock-openai-server";

describe("OpenAICompatibleClient.validateApiKey", () => {
  let server: MockOpenAIServerHandle | null = null;

  afterEach(async () => {
    resetCloudClients();
    if (server) await server.close();
    server = null;
  });

  it("returns true when the mock server returns 200", async () => {
    server = await startMockOpenAIServer();
    const client = getCloudClient("normattiva", "test-key", `${server.baseUrl}/v1`);
    const ok = await client.validateApiKey();
    expect(ok).toBe(true);
  });

  it("returns false when the mock server returns 401", async () => {
    server = await startMockOpenAIServer();
    server.setResponse("/v1/models", () => ({
      status: 401,
      body: JSON.stringify({ error: { message: "bad key" } }),
    }));
    const client = getCloudClient("normattiva", "test-key", `${server.baseUrl}/v1`);
    const ok = await client.validateApiKey();
    expect(ok).toBe(false);
  });

  it("returns false when the network is unreachable", async () => {
    // Port 1 is reserved (tcpmux) and unbound on any modern host, so
    // connect() should be refused immediately by the kernel — fast enough
    // to keep the test quick.
    const client = getCloudClient("normattiva", "test-key", "http://127.0.0.1:1");
    const ok = await client.validateApiKey();
    expect(ok).toBe(false);
  });
});