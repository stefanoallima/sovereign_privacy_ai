import { describe, it, expect, beforeEach } from "vitest";
import { useSettingsStore } from "@/stores/settings";

describe("settings store — normattiva models", () => {
  beforeEach(() => {
    // Reset to defaults between tests (zustand persist hydrates from
    // localStorage in browser; in node test env it's a no-op).
    useSettingsStore.getState().resetToDefaults();
  });

  it("exposes normattivaModels in the initial state", () => {
    const models = useSettingsStore.getState().normattivaModels;
    expect(models.length).toBeGreaterThan(0);
    expect(models[0].provider).toBe("normattiva");
    expect(models[0].apiModelId).toBe("normattiva-legal-pro");
  });

  it("marks exactly one normattiva model as default", () => {
    const defaults = useSettingsStore
      .getState()
      .normattivaModels.filter((m) => m.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe("normattiva-legal-pro");
  });
});

describe("settings store — normattiva api key", () => {
  beforeEach(() => {
    useSettingsStore.getState().resetToDefaults();
  });

  it("defaults normattivaApiKey to empty string and endpoint to the normattiva host", () => {
    const { settings } = useSettingsStore.getState();
    expect(settings.normattivaApiKey).toBe("");
    expect(settings.normattivaApiEndpoint).toBe("https://api.normattiva.ai/v1");
  });

  it("setNormattivaApiKey updates settings.normattivaApiKey", () => {
    useSettingsStore.getState().setNormattivaApiKey("sk-test-1234");
    expect(useSettingsStore.getState().settings.normattivaApiKey).toBe("sk-test-1234");
  });
});