import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppSettings, LLMModel } from "@/types";

// Embedded local models (llama.cpp backend — no Ollama required)
// These are the models shown in the chat model selector.
// The actual download/management is in PrivacySettings via Rust commands.
const DEFAULT_OLLAMA_MODELS: LLMModel[] = [
  {
    id: "local-qwen3-0.6b",
    provider: "ollama",
    apiModelId: "qwen3-0.6b",
    name: "Qwen3 0.6B (Ultra-Light)",
    contextWindow: 4096,
    speedTier: "fast",
    intelligenceTier: "good",
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    isEnabled: true,
    isDefault: false,
  },
  {
    id: "local-qwen3-1.7b",
    provider: "ollama",
    apiModelId: "qwen3-1.7b",
    name: "Qwen3 1.7B (Light)",
    contextWindow: 4096,
    speedTier: "fast",
    intelligenceTier: "high",
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    isEnabled: true,
    isDefault: true,
  },
  {
    id: "local-qwen3-4b",
    provider: "ollama",
    apiModelId: "qwen3-4b",
    name: "Qwen3 4B (Medium)",
    contextWindow: 4096,
    speedTier: "medium",
    intelligenceTier: "high",
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    isEnabled: true,
    isDefault: false,
  },
  // Qwen3.5 4B disabled — 'qwen35' architecture not yet supported by llama-cpp-2 v0.1.x
  {
    id: "local-qwen3-8b",
    provider: "ollama",
    apiModelId: "qwen3-8b",
    name: "Qwen3 8B (Full)",
    contextWindow: 4096,
    speedTier: "slow",
    intelligenceTier: "very-high",
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    isEnabled: true,
    isDefault: false,
  },
];

// Cloud models available on tokenfactory.nebius.com
const DEFAULT_MODELS: LLMModel[] = [
  {
    id: "minimax-m2",
    provider: "nebius",
    apiModelId: "MiniMaxAI/MiniMax-M2.1",
    name: "MiniMax M2.1",
    contextWindow: 128000,
    speedTier: "medium",
    intelligenceTier: "very-high",
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    isEnabled: true,
    isDefault: true,
  },
  {
    id: "kimi-k2",
    provider: "nebius",
    apiModelId: "moonshotai/Kimi-K2.5",
    name: "Kimi K2.5",
    contextWindow: 128000,
    speedTier: "medium",
    intelligenceTier: "very-high",
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    isEnabled: true,
    isDefault: false,
  },
  {
    id: "qwen3-32b",
    provider: "nebius",
    apiModelId: "Qwen/Qwen3-32B",
    name: "Qwen3 32B",
    contextWindow: 128000,
    speedTier: "fast",
    intelligenceTier: "high",
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    isEnabled: true,
    isDefault: false,
  },
];

// Cloud models available on the Normattiva legal-AI platform.
// Endpoint is configured in AppSettings; the desktop points the
// OpenAI-compatible client at it.
const DEFAULT_NORMATTIVA_MODELS: LLMModel[] = [
  {
    id: "normattiva-legal-pro",
    provider: "normattiva",
    apiModelId: "normattiva-legal-pro",
    name: "Normattiva Legal Pro",
    contextWindow: 128000,
    speedTier: "medium",
    intelligenceTier: "very-high",
    // Cost is server-billed; placeholders until x_normattiva.cost_estimate_eur
    // is wired into the model settings UI (Phase 1).
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    isEnabled: true,
    isDefault: true,
  },
  {
    id: "normattiva-legal-lite",
    provider: "normattiva",
    apiModelId: "normattiva-legal-lite",
    name: "Normattiva Legal Lite",
    contextWindow: 64000,
    speedTier: "fast",
    intelligenceTier: "high",
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    isEnabled: true,
    isDefault: false,
  },
];

// The live codicecivile.ai OpenAI-compatible base URL (ratified cross-repo 2026-07-07:
// the `api.` host + `/api/v1` path — NOT the apex, which serves the SPA). See the
// collaboration folder's CONTRACT.md §2 / DESKTOP_STATUS_2026-07-07.md (TASK-B5).
export const NORMATTIVA_DEFAULT_ENDPOINT = "https://api.codicecivile.ai/api/v1";
// Dead defaults shipped by earlier builds. Installs still pointing at one of these are
// auto-migrated to the live endpoint (v18); a user's own custom endpoint is preserved.
const LEGACY_NORMATTIVA_ENDPOINTS = ["https://api.normattiva.ai/v1"];

/**
 * B5: resolve the Normattiva endpoint to persist. Repoints a dead/legacy default (or a
 * missing value) to the live endpoint, but keeps any value the user set themselves.
 */
export function resolveNormattivaEndpoint(stored: string | undefined | null): string {
  if (stored && !LEGACY_NORMATTIVA_ENDPOINTS.includes(stored)) return stored;
  return NORMATTIVA_DEFAULT_ENDPOINT;
}

// ---- User-added models --------------------------------------------------------------
// Users can add model ids their endpoint serves without an app update. Custom models
// carry a `custom-` id prefix so migrations and "replace list" can tell them apart from
// the built-in defaults and keep them.
const CUSTOM_MODEL_PREFIX = "custom-";
const isCustomModelId = (id: string) => id.startsWith(CUSTOM_MODEL_PREFIX);

type CloudProvider = "nebius" | "normattiva";

// Plain identifiers only (no whitespace/control chars), bounded length. Mirrors
// services/model-discovery isValidModelId; kept local so the store has no service import.
const isValidApiModelId = (id: string) =>
  id.length > 0 && id.length <= 200 && /^[^\s\u0000-\u001f\u007f]+$/.test(id);

// The slug is lossy ("a/b" and "a-b" both slug to "a-b"), so a short hash of the exact
// id is appended: two different api ids can never share a store id.
function customModelId(provider: CloudProvider, apiModelId: string): string {
  const id = apiModelId.trim();
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h * 33) ^ id.charCodeAt(i)) >>> 0;
  const slug = id.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return `${CUSTOM_MODEL_PREFIX}${provider}-${slug}-${h.toString(36)}`;
}

/** Keep only well-formed custom models from persisted state (it is untrusted input). */
function sanitizeCustomModels(list: unknown): LLMModel[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: LLMModel[] = [];
  for (const m of list as Partial<LLMModel>[]) {
    if (
      !m ||
      typeof m.id !== "string" ||
      !isCustomModelId(m.id) ||
      (m.provider !== "nebius" && m.provider !== "normattiva") ||
      typeof m.apiModelId !== "string" ||
      !isValidApiModelId(m.apiModelId) ||
      seen.has(m.id)
    ) {
      continue;
    }
    seen.add(m.id);
    out.push(
      buildCustomModel(m.provider, m.apiModelId, {
        name: typeof m.name === "string" && m.name.trim() ? m.name.slice(0, 120) : undefined,
        contextWindow:
          typeof m.contextWindow === "number" && m.contextWindow > 0 ? m.contextWindow : 128000,
        speedTier: m.speedTier ?? "medium",
        intelligenceTier: m.intelligenceTier ?? "high",
        inputCostPer1M: typeof m.inputCostPer1M === "number" && m.inputCostPer1M >= 0 ? m.inputCostPer1M : 0,
        outputCostPer1M: typeof m.outputCostPer1M === "number" && m.outputCostPer1M >= 0 ? m.outputCostPer1M : 0,
        isEnabled: m.isEnabled !== false,
      })
    );
  }
  return out;
}

function buildCustomModel(
  provider: CloudProvider,
  apiModelId: string,
  overrides: Partial<Omit<LLMModel, "id" | "provider" | "apiModelId">> = {}
): LLMModel {
  const apiId = apiModelId.trim();
  return {
    id: customModelId(provider, apiId),
    provider,
    apiModelId: apiId,
    name: apiId.split("/").pop() || apiId,
    contextWindow: 128000,
    speedTier: "medium",
    intelligenceTier: "high",
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    isEnabled: true,
    ...overrides,
    // Custom models never take over as the default; that is an explicit user action.
    isDefault: false,
  };
}

const DEFAULT_SETTINGS: AppSettings = {
  nebiusApiKey: "",
  nebiusApiEndpoint: "https://api.tokenfactory.nebius.com/v1",
  normattivaApiKey: "",
  normattivaApiEndpoint: NORMATTIVA_DEFAULT_ENDPOINT,
  mem0ApiKey: "",
  enableMemory: false,
  useLocalMemory: true,
  defaultModelId: "minimax-m2",
  enabledModelIds: DEFAULT_MODELS.map((m) => m.id),
  defaultVoiceId: "en_US-lessac-medium",
  speechRate: 1.0,
  pushToTalkKey: "Ctrl+Space",
  saveAudioRecordings: false,
  encryptLocalData: true,
  // Privacy Mode
  privacyMode: "cloud",
  localModeModel: "qwen3-1.7b",
  hybridModeModel: "minimax-m2",
  cloudModeModel: "minimax-m2",
  // Backward compat (derived from privacyMode)
  airplaneMode: false,
  airplaneModeModel: "qwen3-1.7b",
  cloudTrustLevel: null,
  skipCloudReview: false,
  alwaysReviewBeforeSend: false,
  theme: "light",
  showTokenCounts: true,
  showModelSelector: true,
  // GLiNER Privacy Shield
  glinerEnabled: false,
  glinerModelId: null,
  glinerConfidenceThreshold: 0.4,
  // Auto-redact all cloud-bound content
  autoRedactAllContent: true,
};

interface SettingsStore {
  settings: AppSettings;
  models: LLMModel[];
  ollamaModels: LLMModel[];
  normattivaModels: LLMModel[];

  // Actions
  updateSettings: (partial: Partial<AppSettings>) => void;
  setApiKey: (key: string) => void;
  setNormattivaApiKey: (key: string) => void;
  setNormattivaApiEndpoint: (endpoint: string) => void;
  setDefaultModel: (modelId: string) => void;
  toggleModel: (modelId: string) => void;
  toggleAirplaneMode: () => void;
  setAirplaneModeModel: (model: string) => void;
  setPrivacyMode: (mode: 'local' | 'hybrid' | 'cloud') => void;
  updateModelPricing: (
    modelId: string,
    inputCost: number,
    outputCost: number
  ) => void;
  /** Add one model for a cloud provider. No-op if that provider already has the apiModelId. */
  addCustomModel: (model: Omit<LLMModel, "id">) => void;
  /** Bulk-add models discovered from an endpoint. Returns how many were new. */
  addModelsFromIds: (provider: CloudProvider, apiModelIds: string[]) => number;
  removeCustomModel: (modelId: string) => void;
  replaceCloudModels: (ids: string[]) => void;
  resetToDefaults: () => void;

  // Selectors
  getEnabledModels: () => LLMModel[];
  getDefaultModel: (persona?: { preferred_backend?: string; preferredModelId?: string }) => LLMModel | undefined;
  getModelById: (id: string) => LLMModel | undefined;
  /**
   * The model a chat should actually use: the preferred id (e.g. the conversation's pinned
   * model) if it still exists AND is enabled, else the global default, else the first
   * enabled model. A pinned model that was disabled/removed (e.g. a model the endpoint no
   * longer serves) must not keep being used.
   */
  resolveModel: (preferredId?: string | null) => LLMModel | undefined;
  /** An enabled Nebius cloud model for lightweight jobs such as conversation titles. */
  getTitleModel: () => LLMModel | undefined;
  isAirplaneModeActive: () => boolean;
  getActivePrivacyMode: (persona?: any) => 'local' | 'hybrid' | 'cloud' | 'custom';
  getAllModels: () => LLMModel[];
  getLocalModels: () => LLMModel[];
  getCloudModels: () => LLMModel[];
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      models: DEFAULT_MODELS,
      ollamaModels: DEFAULT_OLLAMA_MODELS,
      normattivaModels: DEFAULT_NORMATTIVA_MODELS,

      updateSettings: (partial) =>
        set((state) => ({
          settings: { ...state.settings, ...partial },
        })),

      setApiKey: (key) =>
        set((state) => ({
          settings: { ...state.settings, nebiusApiKey: key },
        })),

      setNormattivaApiKey: (key) =>
        set((state) => ({
          settings: { ...state.settings, normattivaApiKey: key },
        })),

      setNormattivaApiEndpoint: (endpoint) =>
        set((state) => ({
          settings: { ...state.settings, normattivaApiEndpoint: endpoint },
        })),

      setDefaultModel: (modelId) =>
        set((state) => {
          const model = state.models.find((m) => m.id === modelId);
          if (!model) return state;
          return {
            // Cloud and Hybrid chat read cloudModeModel / hybridModeModel first, so the
            // default has to be applied to those too or "Set default" changes nothing.
            settings: {
              ...state.settings,
              defaultModelId: modelId,
              cloudModeModel: modelId,
              hybridModeModel: modelId,
            },
            models: state.models.map((m) => ({
              ...m,
              isDefault: m.id === modelId,
            })),
          };
        }),

      toggleModel: (modelId) =>
        set((state) => {
          const model =
            state.models.find((m) => m.id === modelId) ||
            state.normattivaModels.find((m) => m.id === modelId);
          if (!model) return state;

          const newEnabled = !model.isEnabled;
          const enabledModelIds = newEnabled
            ? [...state.settings.enabledModelIds, modelId]
            : state.settings.enabledModelIds.filter((id) => id !== modelId);
          const flip = (m: LLMModel) =>
            m.id === modelId ? { ...m, isEnabled: newEnabled } : m;

          // Disabling the model that is currently the default/cloud/hybrid selection would
          // leave chat pointing at a model the user turned off: move the selection.
          const fallback = state.models.find((m) => m.isEnabled && m.id !== modelId)?.id;
          const move = (id: string) =>
            !newEnabled && id === modelId && fallback ? fallback : id;

          return {
            settings: {
              ...state.settings,
              enabledModelIds,
              defaultModelId: move(state.settings.defaultModelId),
              cloudModeModel: move(state.settings.cloudModeModel),
              hybridModeModel: move(state.settings.hybridModeModel),
            },
            models: state.models.map(flip),
            normattivaModels: state.normattivaModels.map(flip),
          };
        }),

      toggleAirplaneMode: () =>
        set((state) => ({
          settings: {
            ...state.settings,
            airplaneMode: !state.settings.airplaneMode,
          },
        })),

      setAirplaneModeModel: (model) =>
        set((state) => ({
          settings: {
            ...state.settings,
            airplaneModeModel: model,
          },
        })),

      setPrivacyMode: (mode) =>
        set((state) => ({
          settings: {
            ...state.settings,
            privacyMode: mode,
            // Backward compat: airplaneMode = local
            airplaneMode: mode === 'local',
          },
        })),

      updateModelPricing: (modelId, inputCost, outputCost) =>
        set((state) => ({
          models: state.models.map((m) =>
            m.id === modelId
              ? { ...m, inputCostPer1M: inputCost, outputCostPer1M: outputCost }
              : m
          ),
        })),

      addCustomModel: (model) =>
        set((state) => {
          const provider: CloudProvider =
            model.provider === "normattiva" ? "normattiva" : "nebius";
          const list = provider === "normattiva" ? state.normattivaModels : state.models;
          const apiId = model.apiModelId.trim();
          if (!isValidApiModelId(apiId) || list.some((m) => m.apiModelId === apiId)) return state;

          const newModel = buildCustomModel(provider, apiId, {
            name: model.name?.trim() || undefined,
            contextWindow: model.contextWindow,
            speedTier: model.speedTier,
            intelligenceTier: model.intelligenceTier,
            inputCostPer1M: model.inputCostPer1M,
            outputCostPer1M: model.outputCostPer1M,
            isEnabled: model.isEnabled,
          });
          return {
            ...(provider === "normattiva"
              ? { normattivaModels: [...state.normattivaModels, newModel] }
              : { models: [...state.models, newModel] }),
            settings: {
              ...state.settings,
              enabledModelIds: newModel.isEnabled
                ? [...state.settings.enabledModelIds, newModel.id]
                : state.settings.enabledModelIds,
            },
          };
        }),

      addModelsFromIds: (provider, apiModelIds) => {
        const before = get();
        const list = provider === "normattiva" ? before.normattivaModels : before.models;
        const known = new Set(list.map((m) => m.apiModelId));
        const fresh = [...new Set(apiModelIds.map((i) => i.trim()).filter(isValidApiModelId))].filter(
          (i) => !known.has(i)
        );
        if (fresh.length === 0) return 0;
        const added = fresh.map((i) => buildCustomModel(provider, i));
        set((state) => ({
          ...(provider === "normattiva"
            ? { normattivaModels: [...state.normattivaModels, ...added] }
            : { models: [...state.models, ...added] }),
          settings: {
            ...state.settings,
            enabledModelIds: [...state.settings.enabledModelIds, ...added.map((m) => m.id)],
          },
        }));
        return added.length;
      },

      removeCustomModel: (modelId) =>
        set((state) => {
          if (!isCustomModelId(modelId)) return state;
          const models = state.models.filter((m) => m.id !== modelId);
          const normattivaModels = state.normattivaModels.filter((m) => m.id !== modelId);
          // If the removed model was a selected default, fall back to a model that exists.
          const fallback =
            models.find((m) => m.isEnabled)?.id ?? models[0]?.id ?? DEFAULT_SETTINGS.defaultModelId;
          const fix = (id: string) => (id === modelId ? fallback : id);
          return {
            models,
            normattivaModels,
            settings: {
              ...state.settings,
              enabledModelIds: state.settings.enabledModelIds.filter((id) => id !== modelId),
              defaultModelId: fix(state.settings.defaultModelId),
              cloudModeModel: fix(state.settings.cloudModeModel),
              hybridModeModel: fix(state.settings.hybridModeModel),
            },
          };
        }),

      replaceCloudModels: (ids) =>
        set((state) => {
          const newModels: LLMModel[] = ids.map((id, i) => ({
            id: `cloud-${id.replace(/[^a-zA-Z0-9]/g, '-')}`,
            provider: "nebius" as const,
            apiModelId: id,
            name: id.split('/').pop() ?? id,
            contextWindow: 128000,
            speedTier: "medium" as const,
            intelligenceTier: "high" as const,
            inputCostPer1M: 0,
            outputCostPer1M: 0,
            isEnabled: true,
            isDefault: i === 0,
          }));
          const firstId = newModels[0]?.id ?? state.settings.cloudModeModel;
          // Keep models the user added by hand; "replace" only swaps the auto-listed ones.
          const keptCustom = state.models.filter(
            (m) => isCustomModelId(m.id) && !newModels.some((n) => n.apiModelId === m.apiModelId)
          );
          return {
            models: [...newModels, ...keptCustom],
            settings: {
              ...state.settings,
              enabledModelIds: [...newModels, ...keptCustom].filter((m) => m.isEnabled).map((m) => m.id),
              defaultModelId: firstId,
              cloudModeModel: firstId,
              hybridModeModel: firstId,
            },
          };
        }),

      resetToDefaults: () =>
        set({
          settings: DEFAULT_SETTINGS,
          models: DEFAULT_MODELS,
          ollamaModels: DEFAULT_OLLAMA_MODELS,
          normattivaModels: DEFAULT_NORMATTIVA_MODELS,
        }),

      // Returns enabled models based on privacy mode
      getEnabledModels: () => {
        const { settings, models, ollamaModels, normattivaModels } = get();
        const enabledLocal = ollamaModels.filter((m) => m.isEnabled);
        if (settings.privacyMode === 'local') {
          return enabledLocal;
        }
        return [
          ...models.filter((m) => m.isEnabled),
          ...normattivaModels.filter((m) => m.isEnabled),
          ...enabledLocal,
        ];
      },

      getDefaultModel: (persona) => {
        const { settings, models, ollamaModels, normattivaModels } = get();
        if (settings.privacyMode === 'local') {
          // Return matching local model by localModeModel apiModelId
          const matchingModel = ollamaModels.find(
            (m) => m.apiModelId === settings.localModeModel
          );
          return matchingModel || ollamaModels.find((m) => m.isEnabled);
        }
        if (settings.privacyMode === 'hybrid') {
          return models.find((m) => m.id === settings.hybridModeModel)
            || ollamaModels.find((m) => m.id === settings.hybridModeModel)
            || models.find((m) => m.id === settings.defaultModelId);
        }
        // cloud mode: find default, skipping normattiva if no API key
        const isNormattivaKeyEmpty = !settings.normattivaApiKey || settings.normattivaApiKey.trim() === '';
        // Prefer a Normattiva model ONLY when the ACTIVE persona routes to the
        // Normattiva legal backend (its preferred_backend is 'normattiva', or its
        // preferredModelId names a Normattiva model). Keying off the persona — not
        // merely "a key exists" — stops an unrelated persona (e.g. the psychologist)
        // from being rerouted to the legal endpoint the moment a Normattiva key is
        // pasted (wrong tool + surprising billing). A key is still required, since
        // the endpoint is unusable without one.
        if (!isNormattivaKeyEmpty && persona) {
          const personaPrefersNormattiva =
            persona.preferred_backend === 'normattiva' ||
            normattivaModels.some((m) => m.id === persona.preferredModelId);
          if (personaPrefersNormattiva) {
            const chosen =
              normattivaModels.find((m) => m.id === persona.preferredModelId) ||
              normattivaModels.find((m) => m.isDefault) ||
              normattivaModels.find((m) => m.isEnabled);
            if (chosen) return chosen;
          }
        }
        const allModels = [
          ...models,
          ...ollamaModels,
          ...(isNormattivaKeyEmpty ? [] : normattivaModels),
        ];
        return allModels.find((m) => m.id === settings.cloudModeModel)
          || allModels.find((m) => m.id === settings.defaultModelId)
          || models.find((m) => m.isEnabled)
          || ollamaModels.find((m) => m.isEnabled);
      },

      getModelById: (id) => {
        const { models, ollamaModels, normattivaModels } = get();
        return (
          models.find((m) => m.id === id) ||
          ollamaModels.find((m) => m.id === id) ||
          normattivaModels.find((m) => m.id === id)
        );
      },

      resolveModel: (preferredId) => {
        const { settings, getModelById, getEnabledModels } = get();
        for (const id of [preferredId, settings.defaultModelId]) {
          const m = id ? getModelById(id) : undefined;
          if (m?.isEnabled) return m;
        }
        return getEnabledModels()[0];
      },

      getTitleModel: () => {
        const { settings, models } = get();
        const enabled = models.filter((m) => m.isEnabled);
        return enabled.find((m) => m.id === settings.defaultModelId) ?? enabled[0];
      },

      isAirplaneModeActive: () => get().settings.privacyMode === 'local',

      getActivePrivacyMode: (_persona?: any) => {
        // The user's explicit pill selection (settings.privacyMode) always wins.
        // Persona preferred_backend is a routing default, not a UI override.
        return get().settings.privacyMode;
      },

      getAllModels: () => [
        ...get().models,
        ...get().ollamaModels,
        ...get().normattivaModels,
      ],

      getLocalModels: () => get().ollamaModels.filter((m) => m.isEnabled),

      getCloudModels: () => [
        ...get().models,
        ...get().normattivaModels,
      ].filter((m) => m.isEnabled),
    }),
    {
      name: "assistant-settings",
      version: 18, // v18: repoint normattiva endpoint to the live codicecivile.ai host (B5)
      migrate: (persisted: unknown, _version: number) => {
        // On version change, preserve user settings and the models the user added, but
        // reset the built-in model lists to the new defaults.
        const p = persisted as Partial<{
          settings: Record<string, any>;
          models: LLMModel[];
          normattivaModels: LLMModel[];
        }>;
        const keepCustom = (list: unknown, defaults: LLMModel[]) => {
          const custom = sanitizeCustomModels(list);
          return [...defaults, ...custom.filter((c) => !defaults.some((d) => d.id === c.id))];
        };
        const old = p?.settings ?? {} as Record<string, any>;
        // Keep the user's chosen default/cloud/hybrid model across a version bump when it
        // still exists after the reset (built-ins + their custom models); otherwise fall
        // back to the built-in default. Previously these were always reset to minimax-m2.
        const migratedModels = keepCustom(p?.models, DEFAULT_MODELS);
        const keepSelection = (id: unknown): string =>
          typeof id === 'string' && migratedModels.some((m) => m.id === id) ? id : 'minimax-m2';
        // Migrate airplaneMode → privacyMode
        const privacyMode = old.airplaneMode ? 'local' as const : (old.privacyMode ?? 'cloud' as const);
        return {
          settings: {
            ...DEFAULT_SETTINGS,
            ...old,
            privacyMode,
            theme: 'light',
            localModeModel: old.localModeModel ?? old.airplaneModeModel ?? 'qwen3-1.7b',
            hybridModeModel: keepSelection(old.hybridModeModel),
            cloudModeModel: keepSelection(old.cloudModeModel),
            defaultModelId: keepSelection(old.defaultModelId),
            airplaneMode: privacyMode === 'local',
            airplaneModeModel: old.airplaneModeModel ?? 'qwen3-1.7b',
            glinerEnabled: old.glinerEnabled ?? false,
            glinerModelId: old.glinerModelId ?? null,
            glinerConfidenceThreshold: old.glinerConfidenceThreshold ?? 0.4,
            autoRedactAllContent: old.autoRedactAllContent ?? true,
            useLocalMemory: old.useLocalMemory ?? true,
            cloudTrustLevel: old.cloudTrustLevel ?? null,
            normattivaApiKey: old.normattivaApiKey ?? "",
            // B5: move installs off the dead default; keep a user's custom endpoint.
            normattivaApiEndpoint: resolveNormattivaEndpoint(old.normattivaApiEndpoint),
          },
          models: migratedModels,
          ollamaModels: DEFAULT_OLLAMA_MODELS,
          normattivaModels: keepCustom(p?.normattivaModels, DEFAULT_NORMATTIVA_MODELS),
        };
      },
      partialize: (state) => ({
        settings: state.settings,
        models: state.models,
        ollamaModels: state.ollamaModels,
        normattivaModels: state.normattivaModels,
      }),
    }
  )
);
