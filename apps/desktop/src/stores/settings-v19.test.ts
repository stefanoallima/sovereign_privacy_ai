// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { BRAND } from "@/config/branding";
import { BRAND_DEFAULTS } from "@/config/defaults";

describe("settings store v19 migration", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  describe("v18 → v19 migration", () => {
    it("sets brand = BRAND when existing settings lack the brand field", async () => {
      localStorage.setItem(
        "assistant-settings",
        JSON.stringify({
          state: {
            settings: { defaultModelId: "minimax-m2" },
            models: [],
            ollamaModels: [],
          },
          version: 18,
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
          version: 18,
        })
      );

      const { useSettingsStore } = await import("./settings");
      await useSettingsStore.persist.rehydrate();

      expect(
        useSettingsStore.getState().settings.legalDisclaimerAcknowledged
      ).toBe(false);
    });

    it("preserves existing user settings during v18 → v19 migration", async () => {
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
          version: 18,
        })
      );

      const { useSettingsStore } = await import("./settings");
      await useSettingsStore.persist.rehydrate();

      const settings = useSettingsStore.getState().settings;
      expect(settings.nebiusApiKey).toBe("user-secret");
      expect(settings.brand).toBe(BRAND);
      expect(settings.legalDisclaimerAcknowledged).toBe(false);
    });

    it("pre-fills cloudModeModel and hybridModeModel with BRAND_DEFAULTS[BRAND].defaultModelId", async () => {
      // Regression test: previously the v18 migration hardcoded "minimax-m2"
      // for cloudModeModel/hybridModeModel, ignoring BRAND_DEFAULTS[BRAND].
      // On Sovereign, BRAND_DEFAULTS.sovereign.defaultModelId is
      // "deepseek-ai/DeepSeek-V3" — a fresh install would otherwise end up
      // with defaultModelId="DeepSeek-V3" but cloudModeModel="minimax-m2".
      localStorage.setItem(
        "assistant-settings",
        JSON.stringify({
          state: {
            settings: { defaultModelId: "minimax-m2" },
            models: [],
            ollamaModels: [],
          },
          version: 18,
        })
      );

      const { useSettingsStore } = await import("./settings");
      await useSettingsStore.persist.rehydrate();

      const settings = useSettingsStore.getState().settings;
      expect(settings.cloudModeModel).toBe(BRAND_DEFAULTS[BRAND].defaultModelId);
      expect(settings.hybridModeModel).toBe(BRAND_DEFAULTS[BRAND].defaultModelId);
      expect(settings.defaultModelId).toBe(BRAND_DEFAULTS[BRAND].defaultModelId);
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

    it("overrides nebiusApiEndpoint with BRAND_DEFAULTS[BRAND].defaultApiEndpoint when non-empty", async () => {
      // Regression test: previously the v18 migration never touched
      // nebiusApiEndpoint, so a Normattiva user upgrading from v17 kept the
      // Nebius URL and would never be able to reach api.normattiva.ai.
      const { useSettingsStore } = await import("./settings");
      await useSettingsStore.persist.rehydrate();

      const expected =
        BRAND_DEFAULTS[BRAND].defaultApiEndpoint ||
        useSettingsStore.getState().settings.nebiusApiEndpoint;
      expect(useSettingsStore.getState().settings.nebiusApiEndpoint).toBe(
        expected
      );
    });
  });
});
