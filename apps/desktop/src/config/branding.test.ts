import { describe, it, expect, beforeEach, vi } from "vitest";

describe("branding", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  describe("default (VITE_BRAND not set)", () => {
    it("BRAND resolves to 'sovereign'", async () => {
      const { BRAND } = await import("./branding");
      expect(BRAND).toBe("sovereign");
    });

    it("IS_NORMATTIVA is false", async () => {
      const { IS_NORMATTIVA } = await import("./branding");
      expect(IS_NORMATTIVA).toBe(false);
    });

    it("IS_SOVEREIGN is true", async () => {
      const { IS_SOVEREIGN } = await import("./branding");
      expect(IS_SOVEREIGN).toBe(true);
    });

    it("BRAND_NAME is 'Sovereign AI'", async () => {
      const { BRAND_NAME } = await import("./branding");
      expect(BRAND_NAME).toBe("Sovereign AI");
    });

    it("BRAND_TAGLINE is the sovereign tagline", async () => {
      const { BRAND_TAGLINE } = await import("./branding");
      expect(BRAND_TAGLINE).toBe("Private AI for sensitive life decisions");
    });

    it("BRAND_COLOR_ACCENT is the sovereign accent", async () => {
      const { BRAND_COLOR_ACCENT } = await import("./branding");
      expect(BRAND_COLOR_ACCENT).toBe("#3b82f6");
    });

    it("BRAND_INSTALL_DIR is 'Sovereign AI'", async () => {
      const { BRAND_INSTALL_DIR } = await import("./branding");
      expect(BRAND_INSTALL_DIR).toBe("Sovereign AI");
    });

    it("BRAND_IDENTIFIER is the sovereign identifier", async () => {
      const { BRAND_IDENTIFIER } = await import("./branding");
      expect(BRAND_IDENTIFIER).toBe("com.privateassistant.app");
    });
  });

  describe("with VITE_BRAND='sovereign'", () => {
    beforeEach(() => {
      vi.stubEnv("VITE_BRAND", "sovereign");
    });

    it("BRAND resolves to 'sovereign'", async () => {
      const { BRAND } = await import("./branding");
      expect(BRAND).toBe("sovereign");
    });

    it("IS_NORMATTIVA is false and IS_SOVEREIGN is true", async () => {
      const { IS_NORMATTIVA, IS_SOVEREIGN } = await import("./branding");
      expect(IS_NORMATTIVA).toBe(false);
      expect(IS_SOVEREIGN).toBe(true);
    });
  });

  describe("with VITE_BRAND='normattiva'", () => {
    beforeEach(() => {
      vi.stubEnv("VITE_BRAND", "normattiva");
    });

    it("BRAND resolves to 'normattiva'", async () => {
      const { BRAND } = await import("./branding");
      expect(BRAND).toBe("normattiva");
    });

    it("IS_NORMATTIVA is true and IS_SOVEREIGN is false", async () => {
      const { IS_NORMATTIVA, IS_SOVEREIGN } = await import("./branding");
      expect(IS_NORMATTIVA).toBe(true);
      expect(IS_SOVEREIGN).toBe(false);
    });

    it("BRAND_NAME is 'Normattiva'", async () => {
      const { BRAND_NAME } = await import("./branding");
      expect(BRAND_NAME).toBe("Normattiva");
    });

    it("BRAND_TAGLINE is the normattiva tagline", async () => {
      const { BRAND_TAGLINE } = await import("./branding");
      expect(BRAND_TAGLINE).toBe(
        "Consulenza legale italiana con privacy locale"
      );
    });

    it("BRAND_COLOR_ACCENT is the normattiva accent", async () => {
      const { BRAND_COLOR_ACCENT } = await import("./branding");
      expect(BRAND_COLOR_ACCENT).toBe("#0c2c54");
    });

    it("BRAND_INSTALL_DIR is 'Normattiva'", async () => {
      const { BRAND_INSTALL_DIR } = await import("./branding");
      expect(BRAND_INSTALL_DIR).toBe("Normattiva");
    });

    it("BRAND_IDENTIFIER is the normattiva identifier", async () => {
      const { BRAND_IDENTIFIER } = await import("./branding");
      expect(BRAND_IDENTIFIER).toBe("it.normattiva.app");
    });
  });
});
