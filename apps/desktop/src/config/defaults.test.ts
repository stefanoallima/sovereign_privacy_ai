import { describe, it, expect } from "vitest";
import { BRAND_DEFAULTS } from "./defaults";

describe("BRAND_DEFAULTS", () => {
  describe("sovereign", () => {
    it("defaultPersonaId is 'general-assistant'", () => {
      expect(BRAND_DEFAULTS.sovereign.defaultPersonaId).toBe(
        "general-assistant"
      );
    });

    it("defaultCloudBackend is 'nebius'", () => {
      expect(BRAND_DEFAULTS.sovereign.defaultCloudBackend).toBe("nebius");
    });

    it("defaultApiEndpoint is empty string", () => {
      expect(BRAND_DEFAULTS.sovereign.defaultApiEndpoint).toBe("");
    });

    it("defaultModelId is 'deepseek-ai/DeepSeek-V3'", () => {
      expect(BRAND_DEFAULTS.sovereign.defaultModelId).toBe(
        "deepseek-ai/DeepSeek-V3"
      );
    });

    it("hideWizard is false", () => {
      expect(BRAND_DEFAULTS.sovereign.hideWizard).toBe(false);
    });

    it("hideOllama is false", () => {
      expect(BRAND_DEFAULTS.sovereign.hideOllama).toBe(false);
    });

    it("hideLocalModelSelector is false", () => {
      expect(BRAND_DEFAULTS.sovereign.hideLocalModelSelector).toBe(false);
    });

    it("legalDisclaimerText is null", () => {
      expect(BRAND_DEFAULTS.sovereign.legalDisclaimerText).toBeNull();
    });
  });

  describe("normattiva", () => {
    it("defaultPersonaId is 'legal-advisor-it'", () => {
      expect(BRAND_DEFAULTS.normattiva.defaultPersonaId).toBe(
        "legal-advisor-it"
      );
    });

    it("defaultCloudBackend is 'normattiva'", () => {
      expect(BRAND_DEFAULTS.normattiva.defaultCloudBackend).toBe("normattiva");
    });

    it("defaultApiEndpoint is the normattiva API URL", () => {
      expect(BRAND_DEFAULTS.normattiva.defaultApiEndpoint).toBe(
        "https://api.normattiva.ai/v1"
      );
    });

    it("defaultModelId is 'normattiva-legal-pro'", () => {
      expect(BRAND_DEFAULTS.normattiva.defaultModelId).toBe(
        "normattiva-legal-pro"
      );
    });

    it("hideWizard is true", () => {
      expect(BRAND_DEFAULTS.normattiva.hideWizard).toBe(true);
    });

    it("hideOllama is true", () => {
      expect(BRAND_DEFAULTS.normattiva.hideOllama).toBe(true);
    });

    it("hideLocalModelSelector is true", () => {
      expect(BRAND_DEFAULTS.normattiva.hideLocalModelSelector).toBe(true);
    });

    it("legalDisclaimerText is non-null and contains the required disclaimer", () => {
      const text = BRAND_DEFAULTS.normattiva.legalDisclaimerText;
      expect(text).not.toBeNull();
      expect(text).toContain("non sostituisce il parere");
    });
  });
});
