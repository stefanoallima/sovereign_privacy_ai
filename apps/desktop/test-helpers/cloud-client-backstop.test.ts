import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getCloudClient, resetCloudClients } from "@/services/nebius";
import { useUserContextStore } from "@/stores/userContext";
import {
  startMockOpenAIServer,
  type MockOpenAIServerHandle,
} from "./mock-openai-server";

// #1 (architecture review): the redaction chokepoint must be ENFORCED, not just
// a convention. The OpenAI-compatible client re-redacts all KNOWN PII (profile
// registry + PII Vault) immediately before egress, so a call site that forgot to
// redact still cannot leak already-known raw PII to a cloud API.
describe("cloud client — egress backstop (#1 enforcement)", () => {
  let server: MockOpenAIServerHandle | null = null;

  beforeEach(() => {
    useUserContextStore.getState().createProfile("backstop-test");
    // Simulate a value that is already KNOWN (e.g. redacted in a prior turn).
    useUserContextStore.getState().ensureRedactTerm("PERSON", "Mario Rossi");
  });

  afterEach(async () => {
    resetCloudClients();
    if (server) await server.close();
    server = null;
  });

  it("strips already-known PII even when the caller sends RAW (un-redacted) content", async () => {
    server = await startMockOpenAIServer();
    const bodies: string[] = [];
    const originalFetch = global.fetch;
    global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      if (init?.body) bodies.push(String(init.body));
      return originalFetch(url, init);
    }) as typeof fetch;

    try {
      const client = getCloudClient("normattiva", "k", `${server.baseUrl}/v1`);
      // The caller "forgot" to redact and passes RAW PII straight to the client.
      await client.chatCompletion({
        model: "normattiva-legal-pro",
        messages: [{ role: "user", content: "Contatta Mario Rossi urgentemente." }],
      });
      // The backstop must have tokenized it before the request left.
      expect(bodies.join("|")).not.toContain("Mario Rossi");
    } finally {
      global.fetch = originalFetch;
    }
  });
});
