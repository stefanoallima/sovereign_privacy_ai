import { describe, it, expect, beforeEach, vi } from "vitest";
import { useSettingsStore } from "@/stores/settings";
import type { LLMModel } from "@/types";

const get = () => useSettingsStore.getState();
// Custom ids carry a hash of the exact api id, so tests look them up instead of hardcoding.
const nebId = (apiId = "acme/new-model-1") =>
  get().models.find((m) => m.apiModelId === apiId)?.id ?? "";
const norId = (apiId = "legal-xl") =>
  get().normattivaModels.find((m) => m.apiModelId === apiId)?.id ?? "";

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
      expect(added!.id).toMatch(/^custom-nebius-acme-new-model-1-[a-z0-9]+$/);
      expect(added!.provider).toBe("nebius");
      expect(get().settings.enabledModelIds).toContain(added!.id);
    });

    it("adds a Normattiva model to the Normattiva list, not the Nebius one", () => {
      const nebiusBefore = get().models.length;
      get().addCustomModel(modelInput({ provider: "normattiva", apiModelId: "legal-xl" }));
      expect(get().models).toHaveLength(nebiusBefore);
      const added = get().normattivaModels.find((m) => m.apiModelId === "legal-xl");
      expect(added?.provider).toBe("normattiva");
      expect(added?.id).toMatch(/^custom-normattiva-legal-xl-[a-z0-9]+$/);
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
      expect(get().settings.enabledModelIds).not.toContain(nebId());
    });

    it("gives ids that slug identically distinct store ids (a/b vs a-b)", () => {
      get().addCustomModel(modelInput({ apiModelId: "vendor/m-1" }));
      get().addCustomModel(modelInput({ apiModelId: "vendor-m-1" }));
      const a = nebId("vendor/m-1");
      const b = nebId("vendor-m-1");
      expect(a).not.toBe("");
      expect(b).not.toBe("");
      expect(a).not.toBe(b);
      get().toggleModel(a);
      expect(get().models.find((m) => m.id === a)!.isEnabled).toBe(false);
      expect(get().models.find((m) => m.id === b)!.isEnabled).toBe(true);
    });

    it("never lets an added model claim default status", () => {
      get().addCustomModel(modelInput({ isDefault: true }));
      expect(get().models.find((m) => m.id === nebId())!.isDefault).toBe(false);
      expect(get().models.filter((m) => m.isDefault).length).toBeLessThanOrEqual(1);
    });

    it.each(["has space", "tab\tinside", "new\nline", "x".repeat(201), ""])(
      "rejects an invalid model id (%j)",
      (bad) => {
        const before = get().models.length;
        get().addCustomModel(modelInput({ apiModelId: bad }));
        expect(get().models).toHaveLength(before);
      }
    );
  });

  describe("addModelsFromIds", () => {
    it("adds only ids the provider doesn't already have and reports the count", () => {
      const existing = get().models[0].apiModelId;
      const n = get().addModelsFromIds("nebius", [existing, "m-a", "m-b", "m-a", " "]);
      expect(n).toBe(2);
      expect(get().models.filter((m) => m.id.startsWith("custom-nebius-m-"))).toHaveLength(2);
      expect(get().addModelsFromIds("nebius", ["m-a", "m-b"])).toBe(0);
    });

    it("skips invalid ids from a hostile or buggy endpoint", () => {
      const n = get().addModelsFromIds("nebius", ["ok-1", "bad id", "x".repeat(300), "ctl\u0001"]);
      expect(n).toBe(1);
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
      expect(get().getModelById(norId())?.provider).toBe("normattiva");
      expect(get().getModelById("normattiva-legal-pro")?.provider).toBe("normattiva");
    });
  });

  describe("removeCustomModel", () => {
    it("removes a custom model from either list", () => {
      get().addCustomModel(modelInput());
      get().addCustomModel(modelInput({ provider: "normattiva", apiModelId: "legal-xl" }));
      const nid = nebId();
      const rid = norId();
      get().removeCustomModel(nid);
      get().removeCustomModel(rid);
      expect(get().getModelById(nid)).toBeUndefined();
      expect(get().getModelById(rid)).toBeUndefined();
      expect(get().settings.enabledModelIds).not.toContain(nid);
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
      const id = nebId();
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
      expect(get().settings.enabledModelIds).toContain(nebId());
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
      const nid = nebId();
      const rid = norId();
      const persisted = {
        settings: s.settings,
        models: [...s.models, { ...s.models[0], id: "stale-builtin" }],
        normattivaModels: s.normattivaModels,
      };

      const out = await migrate(persisted);

      expect(out.models.some((m) => m.id === nid)).toBe(true);
      expect(out.normattivaModels.some((m) => m.id === rid)).toBe(true);
      // built-ins are reset to current defaults, so stale non-custom entries are dropped
      expect(out.models.some((m) => m.id === "stale-builtin")).toBe(false);
      // custom models stay enabled
      expect(out.settings.enabledModelIds).toContain(nid);
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

    it("drops malformed persisted custom models and repairs bad numbers", async () => {
      const base = { ...get().models[0] };
      const good = { ...base, id: "custom-nebius-good-1", provider: "nebius", apiModelId: "good/model" };
      const out = await migrate({
        settings: {},
        models: [
          good,
          { ...good, id: "custom-nebius-good-1" }, // duplicate id
          { ...good, id: "custom-bad-provider", provider: "evil" },
          { ...good, id: "custom-no-api", apiModelId: undefined },
          { ...good, id: "custom-spacey", apiModelId: "has space" },
          { ...good, id: "custom-badnums", apiModelId: "nums/ok", contextWindow: -5, inputCostPer1M: "x", outputCostPer1M: -1 },
          "garbage",
          null,
        ],
        normattivaModels: "not-a-list",
      });
      const custom = out.models.filter((m) => m.id.startsWith("custom-"));
      expect(custom.map((m) => m.apiModelId).sort()).toEqual(["good/model", "nums/ok"]);
      const nums = custom.find((m) => m.apiModelId === "nums/ok")!;
      expect(nums.contextWindow).toBe(128000);
      expect(nums.inputCostPer1M).toBe(0);
      expect(nums.outputCostPer1M).toBe(0);
      expect(out.normattivaModels.every((m) => !m.id.startsWith("custom-"))).toBe(true);
    });
  });
});

describe("default model selection", () => {
  beforeEach(() => get().resetToDefaults());

  const addNew = (apiId: string) => {
    get().addCustomModel(modelInput({ apiModelId: apiId }));
    return nebId(apiId);
  };

  it("'Set default' applies to Cloud and Hybrid chat, not just defaultModelId", () => {
    const id = addNew("MiniMaxAI/MiniMax-M3");
    get().setDefaultModel(id);
    const { defaultModelId, cloudModeModel, hybridModeModel } = get().settings;
    expect([defaultModelId, cloudModeModel, hybridModeModel]).toEqual([id, id, id]);
    // and the model chat actually resolves is the chosen one
    expect(get().getDefaultModel()?.id).toBe(id);
    expect(get().resolveModel(undefined)?.id).toBe(id);
    expect(get().models.filter((m) => m.isDefault).map((m) => m.id)).toEqual([id]);
  });

  it("ignores an unknown model id", () => {
    const before = get().settings.cloudModeModel;
    get().setDefaultModel("does-not-exist");
    expect(get().settings.cloudModeModel).toBe(before);
  });

  describe("resolveModel", () => {
    it("uses the conversation's pinned model while it is enabled", () => {
      const id = addNew("pinned/model");
      expect(get().resolveModel(id)?.id).toBe(id);
    });

    it("falls back to the default when the pinned model is disabled", () => {
      const pinned = addNew("pinned/model");
      get().toggleModel(pinned);
      const def = get().settings.defaultModelId;
      expect(get().resolveModel(pinned)?.id).toBe(def);
    });

    it("falls back when the pinned model no longer exists", () => {
      expect(get().resolveModel("gone-model")?.id).toBe(get().settings.defaultModelId);
    });

    it("falls back to the first enabled model if the default is also disabled", () => {
      const other = addNew("other/model");
      get().setDefaultModel(other);
      // disable everything except one model
      for (const m of get().models) if (m.id !== other && m.isEnabled) get().toggleModel(m.id);
      get().toggleModel(other); // disable the default too -> nothing enabled in nebius
      expect(get().resolveModel("x")).toBeDefined(); // normattiva/ollama may remain; never throws
    });
  });

  describe("disabling the selected default", () => {
    it("moves default/cloud/hybrid to another enabled model", () => {
      const a = addNew("model/a");
      get().setDefaultModel(a);
      get().toggleModel(a);
      const { defaultModelId, cloudModeModel, hybridModeModel } = get().settings;
      for (const sel of [defaultModelId, cloudModeModel, hybridModeModel]) {
        expect(sel).not.toBe(a);
        expect(get().getModelById(sel)?.isEnabled).toBe(true);
      }
    });

    it("does not touch selections that point elsewhere", () => {
      const a = addNew("model/a");
      const before = { ...get().settings };
      get().toggleModel(a);
      expect(get().settings.cloudModeModel).toBe(before.cloudModeModel);
      expect(get().settings.defaultModelId).toBe(before.defaultModelId);
    });
  });

  describe("getTitleModel", () => {
    it("returns an enabled Nebius model, preferring the default", () => {
      const id = addNew("title/model");
      get().setDefaultModel(id);
      expect(get().getTitleModel()?.id).toBe(id);
      expect(get().getTitleModel()?.provider).toBe("nebius");
    });

    it("skips disabled models and never returns a hardcoded id", () => {
      const first = get().models.find((m) => m.isEnabled)!;
      get().toggleModel(first.id);
      const t = get().getTitleModel();
      expect(t?.isEnabled).toBe(true);
      expect(t?.id).not.toBe(first.id);
    });
  });

  describe("migration keeps the user's model choice", () => {
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
        settings: { defaultModelId: string; cloudModeModel: string; hybridModeModel: string };
      };
    };

    it("keeps a still-existing custom selection instead of resetting to minimax-m2", async () => {
      const id = addNew("keep/me");
      get().setDefaultModel(id);
      const s = get();
      const out = await migrate({ settings: s.settings, models: s.models, normattivaModels: s.normattivaModels });
      expect(out.settings.defaultModelId).toBe(id);
      expect(out.settings.cloudModeModel).toBe(id);
      expect(out.settings.hybridModeModel).toBe(id);
    });

    it("falls back to the built-in default when the selected model is gone", async () => {
      const out = await migrate({
        settings: { defaultModelId: "custom-nebius-vanished-x", cloudModeModel: "nope", hybridModeModel: 42 },
      });
      expect(out.settings.defaultModelId).toBe("minimax-m2");
      expect(out.settings.cloudModeModel).toBe("minimax-m2");
      expect(out.settings.hybridModeModel).toBe("minimax-m2");
    });
  });
});
