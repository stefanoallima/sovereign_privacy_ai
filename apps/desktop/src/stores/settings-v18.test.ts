// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { BRAND } from "@/config/branding";
import { BRAND_DEFAULTS } from "@/config/defaults";

describe("settings store v18 migration", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  describe("v17 → v18 migration", () => {
    it("sets brand = BRAND when existing settings lack the brand field", async () => {
      localStorage.setItem(
        "assistant-settings",
        JSON.stringify({
          state: {
            settings: { defaultModelId: "minimax-m2" },
            models: [],
            ollamaModels: [],
          },
          version: 17,
        })
      );

      const { useSettingsStore } = await import("./settings");
      await useSettingsStore.persist.rehydrate();

      expect(useSettingsStore.getState().settings.brand).toBe(BRAND);
    });

    it("sets legalDisclaimerAcknowledged = false when existing settings lack the field", async () => {
      localStorage.setItem(
        "assistant-settings",
        JSON.stringify({
          state: {
            settings: { defaultModelId: "minimax-m2" },
            models: [],
            ollamaModels: [],
          },
          version: 17,
        })
      );

      const { useSettingsStore } = await import("./settings");
      await useSettingsStore.persist.rehydrate();

      expect(
        useSettingsStore.getState().settings.legalDisclaimerAcknowledged
      ).toBe(false);
    });

    it("preserves existing user settings during v17 → v18 migration", async () => {
      localStorage.setItem(
        "assistant-settings",
        JSON.stringify({
          state: {
            settings: {
              defaultModelId: "minimax-m2",
              nebiusApiKey: "user-secret",
            },
            models: [],
            ollamaModels: [],
          },
          version: 17,
        })
      );

      const { useSettingsStore } = await import("./settings");
      await useSettingsStore.persist.rehydrate();

      const settings = useSettingsStore.getState().settings;
      expect(settings.nebiusApiKey).toBe("user-secret");
      expect(settings.brand).toBe(BRAND);
      expect(settings.legalDisclaimerAcknowledged).toBe(false);
    });
  });

  describe("fresh install (no persisted state)", () => {
    it("initializes brand = BRAND", async () => {
      const { useSettingsStore } = await import("./settings");
      await useSettingsStore.persist.rehydrate();

      expect(useSettingsStore.getState().settings.brand).toBe(BRAND);
    });

    it("initializes legalDisclaimerAcknowledged = false", async () => {
      const { useSettingsStore } = await import("./settings");
      await useSettingsStore.persist.rehydrate();

      expect(
        useSettingsStore.getState().settings.legalDisclaimerAcknowledged
      ).toBe(false);
    });

    it("pre-fills defaultModelId with BRAND_DEFAULTS[BRAND]", async () => {
      const { useSettingsStore } = await import("./settings");
      await useSettingsStore.persist.rehydrate();

      expect(useSettingsStore.getState().settings.defaultModelId).toBe(
        BRAND_DEFAULTS[BRAND].defaultModelId
      );
    });
  });
});
