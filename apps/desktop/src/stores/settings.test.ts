import { describe, it, expect, beforeEach } from "vitest";
import {
  useSettingsStore,
  resolveNormattivaEndpoint,
  NORMATTIVA_DEFAULT_ENDPOINT,
} from "@/stores/settings";

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

  it("defaults normattivaApiKey to empty string and endpoint to the live codicecivile.ai host", () => {
    const { settings } = useSettingsStore.getState();
    expect(settings.normattivaApiKey).toBe("");
    expect(settings.normattivaApiEndpoint).toBe("https://api.codicecivile.ai/api/v1");
    expect(settings.normattivaApiEndpoint).toBe(NORMATTIVA_DEFAULT_ENDPOINT);
  });

  it("setNormattivaApiKey updates settings.normattivaApiKey", () => {
    useSettingsStore.getState().setNormattivaApiKey("sk-test-1234");
    expect(useSettingsStore.getState().settings.normattivaApiKey).toBe("sk-test-1234");
  });
});

// B5: the v18 persist migration repoints existing installs off the dead
// api.normattiva.ai default onto the live codicecivile.ai endpoint, without
// clobbering an endpoint the user set themselves (staging/mock).
describe("resolveNormattivaEndpoint (B5 endpoint flip / v18 migration)", () => {
  it("repoints the dead legacy default to the live codicecivile.ai endpoint", () => {
    expect(resolveNormattivaEndpoint("https://api.normattiva.ai/v1")).toBe(
      "https://api.codicecivile.ai/api/v1"
    );
  });

  it("fills a missing/empty stored endpoint with the live default", () => {
    expect(resolveNormattivaEndpoint(undefined)).toBe(NORMATTIVA_DEFAULT_ENDPOINT);
    expect(resolveNormattivaEndpoint(null)).toBe(NORMATTIVA_DEFAULT_ENDPOINT);
    expect(resolveNormattivaEndpoint("")).toBe(NORMATTIVA_DEFAULT_ENDPOINT);
  });

  it("preserves a user's custom endpoint (staging/mock override)", () => {
    expect(resolveNormattivaEndpoint("http://localhost:8000/api/v1")).toBe(
      "http://localhost:8000/api/v1"
    );
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

  // A persona that routes to the Normattiva legal backend (built-in legal-advisor-it).
  const LEGAL_PERSONA = {
    preferred_backend: "normattiva" as const,
    preferredModelId: "normattiva-legal-pro",
  };
  // A normal cloud persona that has nothing to do with the legal backend.
  const GENERIC_PERSONA = {
    preferred_backend: "hybrid" as const,
    preferredModelId: "qwen3-32b-fast",
  };

  it("returns a non-normattiva model when normattivaApiKey is empty", () => {
    const store = useSettingsStore.getState();
    store.updateSettings({ privacyMode: "cloud", normattivaApiKey: "" });
    expect(store.getDefaultModel()?.provider).not.toBe("normattiva");
  });

  it("does NOT hijack to normattiva when a key is set but no persona is provided", () => {
    const store = useSettingsStore.getState();
    store.updateSettings({ privacyMode: "cloud" });
    store.setNormattivaApiKey("sk-test-1234");
    // No active persona → the generic cloud default, never the legal model.
    expect(store.getDefaultModel()?.provider).not.toBe("normattiva");
  });

  it("returns a non-normattiva default for a generic cloud persona even when a normattiva key is set", () => {
    const store = useSettingsStore.getState();
    store.updateSettings({ privacyMode: "cloud" });
    store.setNormattivaApiKey("sk-test-1234");
    // Setting a Normattiva key must not reroute unrelated personas to the legal endpoint.
    expect(store.getDefaultModel(GENERIC_PERSONA)?.provider).not.toBe("normattiva");
  });

  it("returns normattiva-legal-pro when the active persona prefers the normattiva backend and a key is set", () => {
    const store = useSettingsStore.getState();
    store.updateSettings({ privacyMode: "cloud" });
    store.setNormattivaApiKey("sk-test-1234");
    const m = store.getDefaultModel(LEGAL_PERSONA);
    expect(m?.id).toBe("normattiva-legal-pro");
    expect(m?.provider).toBe("normattiva");
  });

  it("returns a non-normattiva model for the legal persona when the normattiva key is empty", () => {
    const store = useSettingsStore.getState();
    store.updateSettings({ privacyMode: "cloud", normattivaApiKey: "" });
    // Can't use the legal endpoint without a key → fall back to a usable model.
    expect(store.getDefaultModel(LEGAL_PERSONA)?.provider).not.toBe("normattiva");
  });
});