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

describe("settings store — selectors include normattiva models", () => {
  beforeEach(() => {
    useSettingsStore.getState().resetToDefaults();
  });

  it("getAllModels() returns normattiva models", () => {
    const all = useSettingsStore.getState().getAllModels();
    const normattiva = all.filter((m) => m.provider === "normattiva");
    expect(normattiva.length).toBeGreaterThan(0);
  });

  it("getEnabledModels() returns normattiva models in non-local mode", () => {
    const enabled = useSettingsStore.getState().getEnabledModels();
    const normattiva = enabled.filter((m) => m.provider === "normattiva");
    expect(normattiva.length).toBeGreaterThan(0);
  });

  it("getCloudModels() returns normattiva models", () => {
    const cloud = useSettingsStore.getState().getCloudModels();
    const normattiva = cloud.filter((m) => m.provider === "normattiva");
    expect(normattiva.length).toBeGreaterThan(0);
  });
});

describe("settings store — getDefaultModel with normattiva", () => {
  beforeEach(() => {
    useSettingsStore.getState().resetToDefaults();
  });

  it("returns a non-normattiva model when normattivaApiKey is empty and normattiva-legal-pro is marked as default", () => {
    const store = useSettingsStore.getState();
    // Ensure we're in cloud mode
    store.updateSettings({ privacyMode: "cloud" });
    // Ensure normattivaApiKey is empty
    store.updateSettings({ normattivaApiKey: "" });
    // Get the default model
    const defaultModel = store.getDefaultModel();
    // Should not return a normattiva model when key is empty
    expect(defaultModel?.provider).not.toBe("normattiva");
  });

  it("returns normattiva-legal-pro when normattivaApiKey is set and it is marked as default", () => {
    const store = useSettingsStore.getState();
    // Ensure we're in cloud mode
    store.updateSettings({ privacyMode: "cloud" });
    // Set normattivaApiKey
    store.setNormattivaApiKey("sk-test-1234");
    // Get the default model
    const defaultModel = store.getDefaultModel();
    // Should return normattiva model when key is set
    expect(defaultModel?.id).toBe("normattiva-legal-pro");
    expect(defaultModel?.provider).toBe("normattiva");
  });
});