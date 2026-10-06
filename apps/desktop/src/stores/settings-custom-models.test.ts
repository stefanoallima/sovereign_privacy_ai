import { describe, it, expect, beforeEach, vi } from "vitest";
import { useSettingsStore } from "@/stores/settings";
import type { LLMModel } from "@/types";

const get = () => useSettingsStore.getState();

const modelInput = (over: Partial<LLMModel> = {}): Omit<LLMModel, "id"> => ({
  provider: "nebius",
  apiModelId: "acme/new-model-1",
  name: "New Model",
  contextWindow: 32000,
  speedTier: "fast",
  intelligenceTier: "high",
  inputCostPer1M: 1,
  outputCostPer1M: 2,
  isEnabled: true,
  isDefault: false,
  ...over,
});

describe("user-added models", () => {
  beforeEach(() => get().resetToDefaults());

  describe("addCustomModel", () => {
    it("adds a Nebius model to the cloud list and enables it", () => {
      get().addCustomModel(modelInput());
      const added = get().models.find((m) => m.apiModelId === "acme/new-model-1");
      expect(added).toBeDefined();
      expect(added!.id).toBe("custom-nebius-acme-new-model-1");
      expect(added!.provider).toBe("nebius");
      expect(get().settings.enabledModelIds).toContain(added!.id);
    });

    it("adds a Normattiva model to the Normattiva list, not the Nebius one", () => {
      const nebiusBefore = get().models.length;
      get().addCustomModel(modelInput({ provider: "normattiva", apiModelId: "legal-xl" }));
      expect(get().models).toHaveLength(nebiusBefore);
      const added = get().normattivaModels.find((m) => m.apiModelId === "legal-xl");
      expect(added?.provider).toBe("normattiva");
      expect(added?.id).toBe("custom-normattiva-legal-xl");
    });

    it("ignores blanks and duplicates within a provider", () => {
      get().addCustomModel(modelInput());
      const count = get().models.length;
      get().addCustomModel(modelInput()); // same provider + apiModelId
      get().addCustomModel(modelInput({ apiModelId: "   " }));
      expect(get().models).toHaveLength(count);
    });

    it("allows the same model id under different providers", () => {
      get().addCustomModel(modelInput({ apiModelId: "shared-id" }));
      get().addCustomModel(modelInput({ provider: "normattiva", apiModelId: "shared-id" }));
      expect(get().models.some((m) => m.apiModelId === "shared-id")).toBe(true);
      expect(get().normattivaModels.some((m) => m.apiModelId === "shared-id")).toBe(true);
    });

    it("does not enable a model added as disabled", () => {
      get().addCustomModel(modelInput({ isEnabled: false }));
      expect(get().settings.enabledModelIds).not.toContain("custom-nebius-acme-new-model-1");
    });
  });

  describe("addModelsFromIds", () => {
    it("adds only ids the provider doesn't already have and reports the count", () => {
      const existing = get().models[0].apiModelId;
      const n = get().addModelsFromIds("nebius", [existing, "m-a", "m-b", "m-a", " "]);
      expect(n).toBe(2);
      expect(get().models.filter((m) => m.id.startsWith("custom-nebius-m-"))).toHaveLength(2);
      expect(get().addModelsFromIds("nebius", ["m-a", "m-b"])).toBe(0);
    });

    it("routes Normattiva ids to the Normattiva list", () => {
      expect(get().addModelsFromIds("normattiva", ["n-1", "n-2"])).toBe(2);
      expect(get().normattivaModels.filter((m) => m.id.startsWith("custom-normattiva-"))).toHaveLength(2);
    });
  });

  describe("toggleModel", () => {
    it("toggles Normattiva models too", () => {
      get().toggleModel("normattiva-legal-lite");
      expect(get().normattivaModels.find((m) => m.id === "normattiva-legal-lite")!.isEnabled).toBe(false);
      expect(get().settings.enabledModelIds).not.toContain("normattiva-legal-lite");
      get().toggleModel("normattiva-legal-lite");
      expect(get().normattivaModels.find((m) => m.id === "normattiva-legal-lite")!.isEnabled).toBe(true);
    });
  });

  describe("getModelById", () => {
    it("finds Normattiva models (needed to route a custom Normattiva model)", () => {
      get().addCustomModel(modelInput({ provider: "normattiva", apiModelId: "legal-xl" }));
      expect(get().getModelById("custom-normattiva-legal-xl")?.provider).toBe("normattiva");
      expect(get().getModelById("normattiva-legal-pro")?.provider).toBe("normattiva");
    });
  });

  describe("removeCustomModel", () => {
    it("removes a custom model from either list", () => {
      get().addCustomModel(modelInput());
      get().addCustomModel(modelInput({ provider: "normattiva", apiModelId: "legal-xl" }));
      get().removeCustomModel("custom-nebius-acme-new-model-1");
      get().removeCustomModel("custom-normattiva-legal-xl");
      expect(get().getModelById("custom-nebius-acme-new-model-1")).toBeUndefined();
      expect(get().getModelById("custom-normattiva-legal-xl")).toBeUndefined();
      expect(get().settings.enabledModelIds).not.toContain("custom-nebius-acme-new-model-1");
    });

    it("never removes a built-in model", () => {
      const builtIn = get().models[0].id;
      get().removeCustomModel(builtIn);
      get().removeCustomModel("normattiva-legal-pro");
      expect(get().getModelById(builtIn)).toBeDefined();
      expect(get().getModelById("normattiva-legal-pro")).toBeDefined();
    });

    it("moves a selected default off a removed model so nothing points at a ghost", () => {
      get().addCustomModel(modelInput());
      const id = "custom-nebius-acme-new-model-1";
      get().updateSettings({ defaultModelId: id, cloudModeModel: id, hybridModeModel: id });
      get().removeCustomModel(id);
      const { defaultModelId, cloudModeModel, hybridModeModel } = get().settings;
      for (const sel of [defaultModelId, cloudModeModel, hybridModeModel]) {
        expect(sel).not.toBe(id);
        expect(get().getModelById(sel)).toBeDefined();
      }
    });
  });

  describe("replaceCloudModels", () => {
    it("keeps hand-added models when the auto-listed models are replaced", () => {
      get().addCustomModel(modelInput());
      get().replaceCloudModels(["listed/a", "listed/b"]);
      const apiIds = get().models.map((m) => m.apiModelId);
      expect(apiIds).toEqual(expect.arrayContaining(["listed/a", "listed/b", "acme/new-model-1"]));
      expect(get().settings.enabledModelIds).toContain("custom-nebius-acme-new-model-1");
    });
  });

  describe("persist migration", () => {
    // zustand's `persist` only attaches when a storage exists; the node test env has none,
    // so give a fresh copy of the store an in-memory localStorage and call its real migrate.
    const migrate = async (persisted: unknown) => {
      const mem = new Map<string, string>();
      vi.stubGlobal("localStorage", {
        getItem: (k: string) => mem.get(k) ?? null,
        setItem: (k: string, v: string) => void mem.set(k, v),
        removeItem: (k: string) => void mem.delete(k),
      });
      vi.resetModules();
      const { useSettingsStore: fresh } = await import("@/stores/settings");
      return fresh.persist.getOptions().migrate!(persisted, 1) as {
        models: LLMModel[];
        normattivaModels: LLMModel[];
        settings: { enabledModelIds: string[] };
      };
    };

    it("keeps custom models across a version bump while resetting built-ins", async () => {
      get().addCustomModel(modelInput());
      get().addCustomModel(modelInput({ provider: "normattiva", apiModelId: "legal-xl" }));
      const s = get();
      const persisted = {
        settings: s.settings,
        models: [...s.models, { ...s.models[0], id: "stale-builtin" }],
        normattivaModels: s.normattivaModels,
      };

      const out = await migrate(persisted);

      expect(out.models.some((m) => m.id === "custom-nebius-acme-new-model-1")).toBe(true);
      expect(out.normattivaModels.some((m) => m.id === "custom-normattiva-legal-xl")).toBe(true);
      // built-ins are reset to current defaults, so stale non-custom entries are dropped
      expect(out.models.some((m) => m.id === "stale-builtin")).toBe(false);
      // custom models stay enabled
      expect(out.settings.enabledModelIds).toContain("custom-nebius-acme-new-model-1");
    });

    it("tolerates old persisted state with no model lists", async () => {
      const out = await migrate({ settings: {} });
      expect(out.models.length).toBeGreaterThan(0);
      expect(out.normattivaModels.length).toBeGreaterThan(0);
    });

    it("does not duplicate a custom model that collides with a default id", async () => {
      const out = await migrate({
        settings: {},
        models: [{ ...get().models[0] }, { ...get().models[0], id: "custom-nebius-dup" }],
      });
      expect(out.models.filter((m) => m.id === get().models[0].id)).toHaveLength(1);
    });
  });
});
