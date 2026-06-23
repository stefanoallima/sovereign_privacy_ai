import { describe, it, expect, beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe("sovereign per-brand module", () => {
  it("exports BACKEND_PRIVACY_INFO with the 3 Sovereign backends", async () => {
    const { BACKEND_PRIVACY_INFO } = await import("./sovereign");
    expect(BACKEND_PRIVACY_INFO.nebius).toBeDefined();
    expect(BACKEND_PRIVACY_INFO.ollama).toBeDefined();
    expect(BACKEND_PRIVACY_INFO.hybrid).toBeDefined();
  });

  it("BACKEND_PRIVACY_INFO describes ollama as fully local", async () => {
    const { BACKEND_PRIVACY_INFO } = await import("./sovereign");
    expect(BACKEND_PRIVACY_INFO.ollama.localProcessing).toBe(true);
    expect(BACKEND_PRIVACY_INFO.ollama.sendsToCloud).toBe(false);
    expect(BACKEND_PRIVACY_INFO.ollama.level).toBe("high");
  });

  it("BACKEND_PRIVACY_INFO describes hybrid as local+cloud", async () => {
    const { BACKEND_PRIVACY_INFO } = await import("./sovereign");
    expect(BACKEND_PRIVACY_INFO.hybrid.localProcessing).toBe(true);
    expect(BACKEND_PRIVACY_INFO.hybrid.sendsToCloud).toBe(true);
    expect(BACKEND_PRIVACY_INFO.hybrid.level).toBe("medium");
  });

  it("BACKEND_PRIVACY_INFO describes nebius as cloud-direct", async () => {
    const { BACKEND_PRIVACY_INFO } = await import("./sovereign");
    expect(BACKEND_PRIVACY_INFO.nebius.localProcessing).toBe(false);
    expect(BACKEND_PRIVACY_INFO.nebius.sendsToCloud).toBe(true);
    expect(BACKEND_PRIVACY_INFO.nebius.level).toBe("low");
  });

  it("exports BACKEND_OPTIONS including all 3 Sovereign backends (and a normattiva fallback)", async () => {
    const { BACKEND_OPTIONS } = await import("./sovereign");
    const values = BACKEND_OPTIONS.map((o) => o.value);
    expect(values).toContain("nebius");
    expect(values).toContain("ollama");
    expect(values).toContain("hybrid");
  });

  it("getBuiltInPersonaConfig returns Sovereign personas", async () => {
    const { getBuiltInPersonaConfig } = await import("./sovereign");
    expect(getBuiltInPersonaConfig("Psychologist")).not.toBeNull();
    expect(getBuiltInPersonaConfig("Life Coach")).not.toBeNull();
    expect(getBuiltInPersonaConfig("Career Coach")).not.toBeNull();
    expect(getBuiltInPersonaConfig("Tax Navigator")).not.toBeNull();
    expect(getBuiltInPersonaConfig("Dutch Tax Advisor")).not.toBeNull();
  });

  it("getBuiltInPersonaConfig returns null for Normattiva persona", async () => {
    const { getBuiltInPersonaConfig } = await import("./sovereign");
    expect(getBuiltInPersonaConfig("legal-advisor-it")).toBeNull();
  });

  it("BUILT_IN_PERSONA_PROMPTS has the 2 Sovereign tax prompts", async () => {
    const { BUILT_IN_PERSONA_PROMPTS } = await import("./sovereign");
    expect(BUILT_IN_PERSONA_PROMPTS["Tax Navigator"]).toBeDefined();
    expect(BUILT_IN_PERSONA_PROMPTS["Dutch Tax Advisor"]).toBeDefined();
    expect(BUILT_IN_PERSONA_PROMPTS["legal-advisor-it"]).toBeUndefined();
  });

  it("getRecommendedConfig('privacy') uses hybrid (Sovereign default)", async () => {
    const { getRecommendedConfig } = await import("./sovereign");
    expect(getRecommendedConfig("privacy").preferred_backend).toBe("hybrid");
  });

  it("getDefaultConfig uses nebius (Sovereign default)", async () => {
    const { getDefaultConfig } = await import("./sovereign");
    expect(getDefaultConfig().preferred_backend).toBe("nebius");
  });
});
