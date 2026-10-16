import { describe, it, expect, beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe("backend-routing-service entry point (brand selection)", () => {
  describe("default (VITE_BRAND not set → sovereign)", () => {
    beforeEach(() => vi.stubEnv("VITE_BRAND", ""));

    it("BACKEND_OPTIONS includes nebius, ollama, hybrid", async () => {
      const { BACKEND_OPTIONS } = await import("./backend-routing-service");
      const values = BACKEND_OPTIONS.map((o) => o.value);
      expect(values).toContain("nebius");
      expect(values).toContain("ollama");
      expect(values).toContain("hybrid");
    });

    it("getBuiltInPersonaConfig returns Psychologist (Sovereign persona)", async () => {
      const { getBuiltInPersonaConfig } = await import("./backend-routing-service");
      expect(getBuiltInPersonaConfig("Psychologist")).not.toBeNull();
      expect(getBuiltInPersonaConfig("legal-advisor-it")).toBeNull();
    });
  });

  describe("with VITE_BRAND='sovereign'", () => {
    beforeEach(() => vi.stubEnv("VITE_BRAND", "sovereign"));

    it("BACKEND_OPTIONS includes nebius, ollama, hybrid", async () => {
      const { BACKEND_OPTIONS } = await import("./backend-routing-service");
      const values = BACKEND_OPTIONS.map((o) => o.value);
      expect(values).toContain("nebius");
      expect(values).toContain("ollama");
      expect(values).toContain("hybrid");
    });

    it("getDefaultConfig returns nebius", async () => {
      const { getDefaultConfig } = await import("./backend-routing-service");
      expect(getDefaultConfig().preferred_backend).toBe("nebius");
    });
  });

  describe("with VITE_BRAND='normattiva'", () => {
    beforeEach(() => vi.stubEnv("VITE_BRAND", "normattiva"));

    it("BACKEND_OPTIONS contains only normattiva", async () => {
      const { BACKEND_OPTIONS } = await import("./backend-routing-service");
      expect(BACKEND_OPTIONS).toHaveLength(1);
      expect(BACKEND_OPTIONS[0].value).toBe("normattiva");
    });

    it("getBuiltInPersonaConfig returns legal-advisor-it (Normattiva persona)", async () => {
      const { getBuiltInPersonaConfig } = await import("./backend-routing-service");
      const cfg = getBuiltInPersonaConfig("legal-advisor-it");
      expect(cfg).not.toBeNull();
      expect(cfg?.preferred_backend).toBe("normattiva");
      expect(getBuiltInPersonaConfig("Psychologist")).toBeNull();
    });

    it("getDefaultConfig returns normattiva", async () => {
      const { getDefaultConfig } = await import("./backend-routing-service");
      expect(getDefaultConfig().preferred_backend).toBe("normattiva");
    });
  });

  describe("shared API (identical for both brands)", () => {
    it("makeBackendRoutingDecision is exported", async () => {
      const { makeBackendRoutingDecision } = await import("./backend-routing-service");
      expect(typeof makeBackendRoutingDecision).toBe("function");
    });

    it("validatePersonaBackendConfig is exported", async () => {
      const { validatePersonaBackendConfig } = await import("./backend-routing-service");
      expect(typeof validatePersonaBackendConfig).toBe("function");
    });

    it("getBackendPrivacy has a fallback for backends not in this build", async () => {
      const { getBackendPrivacy } = await import("./backend-routing-service");
      // Even for a Sovereign build, looking up 'normattiva' should not crash —
      // the helper returns the generic 'cloud' fallback.
      const fallback = getBackendPrivacy("normattiva");
      expect(fallback).toBeDefined();
      expect(fallback.sendsToCloud).toBe(true);
    });
  });
});
