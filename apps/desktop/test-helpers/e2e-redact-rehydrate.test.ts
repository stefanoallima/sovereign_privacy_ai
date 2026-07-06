import { describe, it, expect, afterEach } from "vitest";
import { getCloudClient, resetCloudClients } from "@/services/nebius";
import { redactForCloud, rehydrateFromCloud } from "@/services/cloud-redaction";
import {
  startMockOpenAIServer,
  type MockOpenAIServerHandle,
} from "./mock-openai-server";

describe("e2e: redact → cloud → rehydrate", () => {
  let server: MockOpenAIServerHandle | null = null;

  afterEach(async () => {
    resetCloudClients();
    if (server) await server.close();
    server = null;
  });

  it("redacts PII, sends only tokens, rehydrates the response with real values", { timeout: 20000 }, async () => {
    server = await startMockOpenAIServer();

    const { useUserContextStore } = await import("@/stores/userContext");
    const state = useUserContextStore.getState();
    state.createProfile("e2e-test-profile");
    const ensure = useUserContextStore.getState().ensureRedactTerm;
    const token = ensure("PERSON", "Mario Rossi");
    expect(token).toBeTruthy();
    expect(token).not.toBe("Mario Rossi");

    const original = "Il mio cliente Mario Rossi ha un debito di 50.000 euro.";
    const { redacted, mappings } = await redactForCloud(original);
    expect(redacted).not.toContain("Mario Rossi");
    expect(redacted).toContain(token);
    expect(mappings.get(token)).toBe("Mario Rossi");

    const client = getCloudClient(
      "normattiva",
      "test-key",
      `${server.baseUrl}/v1`
    );
    const response = await client.chatCompletion({
      model: "normattiva-legal-pro",
      messages: [
        { role: "system", content: "Sei un consulente legale." },
        { role: "user", content: redacted },
      ],
    });

    const assistantText = response.choices[0].message.content;
    expect(assistantText).toContain(token);

    const finalText = rehydrateFromCloud(assistantText, mappings);
    expect(finalText).toContain("Mario Rossi");
    expect(finalText).not.toContain(token);

    expect(response.x_normattiva?.citations?.[0].ref).toBe("c.c. art. 1456");
  });

  it("never sends a non-streaming request that contains the raw PII", { timeout: 20000 }, async () => {
    server = await startMockOpenAIServer();

    const { useUserContextStore } = await import("@/stores/userContext");
    useUserContextStore.getState().createProfile("e2e-test-profile");
    useUserContextStore
      .getState()
      .ensureRedactTerm("EMAIL", "mario@rossi.it");

    const bodies: string[] = [];
    const originalFetch = global.fetch;
    global.fetch = (async (
      url: string | URL | Request,
      init?: RequestInit
    ) => {
      if (init?.body) bodies.push(String(init.body));
      return originalFetch(url, init);
    }) as typeof fetch;

    try {
      const { redactForCloud } = await import("@/services/cloud-redaction");
      const { redacted } = await redactForCloud("Contatta mario@rossi.it");
      const client = getCloudClient(
        "normattiva",
        "k",
        `${server.baseUrl}/v1`
      );
      await client.chatCompletion({
        model: "normattiva-legal-pro",
        messages: [{ role: "user", content: redacted }],
      });
      expect(bodies.join("|")).not.toContain("mario@rossi.it");
    } finally {
      global.fetch = originalFetch;
    }
  });
});
