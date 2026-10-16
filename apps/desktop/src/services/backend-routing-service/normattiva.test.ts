import { describe, it, expect, beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe("normattiva per-brand module", () => {
  it("exports BACKEND_PRIVACY_INFO with only the normattiva backend", async () => {
    const { BACKEND_PRIVACY_INFO } = await import("./normattiva");
    expect(BACKEND_PRIVACY_INFO.normattiva).toBeDefined();
  });

  it("BACKEND_PRIVACY_INFO describes normattiva as cloud-direct (legal domain)", async () => {
    const { BACKEND_PRIVACY_INFO } = await import("./normattiva");
    expect(BACKEND_PRIVACY_INFO.normattiva.localProcessing).toBe(false);
    expect(BACKEND_PRIVACY_INFO.normattiva.sendsToCloud).toBe(true);
    expect(BACKEND_PRIVACY_INFO.normattiva.level).toBe("low");
  });

  it("exports BACKEND_OPTIONS with only the normattiva backend", async () => {
    const { BACKEND_OPTIONS } = await import("./normattiva");
    expect(BACKEND_OPTIONS).toHaveLength(1);
    expect(BACKEND_OPTIONS[0].value).toBe("normattiva");
  });

  it("getBuiltInPersonaConfig returns the legal-advisor-it persona", async () => {
    const { getBuiltInPersonaConfig } = await import("./normattiva");
    const cfg = getBuiltInPersonaConfig("legal-advisor-it");
    expect(cfg).not.toBeNull();
    expect(cfg?.preferred_backend).toBe("normattiva");
    expect(cfg?.enable_local_anonymizer).toBe(true);
    expect(cfg?.anonymization_mode).toBe("required");
  });

  it("getBuiltInPersonaConfig returns null for Sovereign personas", async () => {
    const { getBuiltInPersonaConfig } = await import("./normattiva");
    expect(getBuiltInPersonaConfig("Psychologist")).toBeNull();
    expect(getBuiltInPersonaConfig("Life Coach")).toBeNull();
    expect(getBuiltInPersonaConfig("Tax Navigator")).toBeNull();
    expect(getBuiltInPersonaConfig("Dutch Tax Advisor")).toBeNull();
  });

  it("BUILT_IN_PERSONA_PROMPTS has the legal-advisor-it prompt", async () => {
    const { BUILT_IN_PERSONA_PROMPTS } = await import("./normattiva");
    expect(BUILT_IN_PERSONA_PROMPTS["legal-advisor-it"]).toBeDefined();
    expect(BUILT_IN_PERSONA_PROMPTS["Tax Navigator"]).toBeUndefined();
    expect(BUILT_IN_PERSONA_PROMPTS["Dutch Tax Advisor"]).toBeUndefined();
  });

  it("getRecommendedConfig('privacy') uses normattiva (Normattiva default)", async () => {
    const { getRecommendedConfig } = await import("./normattiva");
    expect(getRecommendedConfig("privacy").preferred_backend).toBe("normattiva");
  });

  it("getDefaultConfig uses normattiva (Normattiva default)", async () => {
    const { getDefaultConfig } = await import("./normattiva");
    expect(getDefaultConfig().preferred_backend).toBe("normattiva");
  });
});
