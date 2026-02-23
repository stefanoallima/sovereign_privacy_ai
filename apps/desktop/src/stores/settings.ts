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

// Curated cloud models available on Nebius AI Studio
const DEFAULT_MODELS: LLMModel[] = [
  {
    id: "qwen3-32b-fast",
    provider: "nebius",
    apiModelId: "Qwen/Qwen3-32B-fast",
    name: "Qwen3 32B Fast",
    contextWindow: 32000,
    speedTier: "fast",
    intelligenceTier: "high",
    inputCostPer1M: 0.2,
    outputCostPer1M: 0.2,
    isEnabled: true,
    isDefault: true,
  },
  {
    id: "deepseek-v3",
    provider: "nebius",
    apiModelId: "deepseek-ai/DeepSeek-V3",
    name: "DeepSeek V3",
    contextWindow: 64000,
    speedTier: "medium",
    intelligenceTier: "very-high",
    inputCostPer1M: 0.3,
    outputCostPer1M: 0.3,
    isEnabled: true,
    isDefault: false,
  },
  {
    id: "qwen3-235b",
    provider: "nebius",
    apiModelId: "Qwen/Qwen3-235B-A22B-Instruct-2507",
    name: "Qwen3 235B MoE",
    contextWindow: 128000,
    speedTier: "medium",
    intelligenceTier: "very-high",
    inputCostPer1M: 0.35,
    outputCostPer1M: 0.35,
    isEnabled: true,
    isDefault: false,
  },
  {
    id: "llama-3.3-70b-fast",
    provider: "nebius",
    apiModelId: "meta-llama/Llama-3.3-70B-Instruct-fast",
    name: "Llama 3.3 70B Fast",
    contextWindow: 128000,
    speedTier: "fast",
    intelligenceTier: "very-high",
    inputCostPer1M: 0.35,
    outputCostPer1M: 0.35,
    isEnabled: true,
    isDefault: false,
  },
];

const DEFAULT_SETTINGS: AppSettings = {
  nebiusApiKey: "",
  nebiusApiEndpoint: "https://api.studio.nebius.ai/v1",
  mem0ApiKey: "",
  enableMemory: false,
  defaultModelId: "qwen3-32b-fast",
  enabledModelIds: DEFAULT_MODELS.map((m) => m.id),
  defaultVoiceId: "en_US-lessac-medium",
  speechRate: 1.0,
  pushToTalkKey: "Ctrl+Space",
  saveAudioRecordings: false,
  encryptLocalData: true,
  // Privacy Mode
  privacyMode: "cloud",
  localModeModel: "qwen3-1.7b",
  hybridModeModel: "qwen3-32b-fast",
  cloudModeModel: "qwen3-32b-fast",
  // Backward compat (derived from privacyMode)
  airplaneMode: false,
  airplaneModeModel: "qwen3-1.7b",
  theme: "system",
  showTokenCounts: true,
  showModelSelector: true,
};

interface SettingsStore {
  settings: AppSettings;
  models: LLMModel[];
  ollamaModels: LLMModel[];

  // Actions
  updateSettings: (partial: Partial<AppSettings>) => void;
  setApiKey: (key: string) => void;
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
  addCustomModel: (model: Omit<LLMModel, "id">) => void;
  removeCustomModel: (modelId: string) => void;
  resetToDefaults: () => void;

  // Selectors
  getEnabledModels: () => LLMModel[];
  getDefaultModel: () => LLMModel | undefined;
  getModelById: (id: string) => LLMModel | undefined;
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

      updateSettings: (partial) =>
        set((state) => ({
          settings: { ...state.settings, ...partial },
        })),

      setApiKey: (key) =>
        set((state) => ({
          settings: { ...state.settings, nebiusApiKey: key },
        })),

      setDefaultModel: (modelId) =>
        set((state) => ({
          settings: { ...state.settings, defaultModelId: modelId },
          models: state.models.map((m) => ({
            ...m,
            isDefault: m.id === modelId,
          })),
        })),

      toggleModel: (modelId) =>
        set((state) => {
          const model = state.models.find((m) => m.id === modelId);
          if (!model) return state;

          const newEnabled = !model.isEnabled;
          const enabledModelIds = newEnabled
            ? [...state.settings.enabledModelIds, modelId]
            : state.settings.enabledModelIds.filter((id) => id !== modelId);

          return {
            settings: { ...state.settings, enabledModelIds },
            models: state.models.map((m) =>
              m.id === modelId ? { ...m, isEnabled: newEnabled } : m
            ),
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
          const id = `custom-${Date.now()}`;
          const newModel: LLMModel = { ...model, id };
          return {
            models: [...state.models, newModel],
            settings: {
              ...state.settings,
              enabledModelIds: [...state.settings.enabledModelIds, id],
            },
          };
        }),

      removeCustomModel: (modelId) =>
        set((state) => ({
          models: state.models.filter(
            (m) => m.id !== modelId || !m.id.startsWith("custom-")
          ),
          settings: {
            ...state.settings,
            enabledModelIds: state.settings.enabledModelIds.filter(
              (id) => id !== modelId
            ),
          },
        })),

      resetToDefaults: () =>
        set({
          settings: DEFAULT_SETTINGS,
          models: DEFAULT_MODELS,
          ollamaModels: DEFAULT_OLLAMA_MODELS,
        }),

      // Returns enabled models based on privacy mode
      getEnabledModels: () => {
        const { settings, models, ollamaModels } = get();
        const enabledLocal = ollamaModels.filter((m) => m.isEnabled);
        if (settings.privacyMode === 'local') {
          return enabledLocal;
        }
        return [...models.filter((m) => m.isEnabled), ...enabledLocal];
      },

      getDefaultModel: () => {
        const { settings, models, ollamaModels } = get();
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
        // cloud mode
        return models.find((m) => m.id === settings.cloudModeModel)
          || ollamaModels.find((m) => m.id === settings.cloudModeModel)
          || models.find((m) => m.id === settings.defaultModelId);
      },

      getModelById: (id) => {
        const { models, ollamaModels } = get();
        return models.find((m) => m.id === id) || ollamaModels.find((m) => m.id === id);
      },

      isAirplaneModeActive: () => get().settings.privacyMode === 'local',

      getActivePrivacyMode: (persona?: any) => {
        const { settings } = get();
        // Map persona's preferred_backend to the equivalent pill mode.
        // 'custom' is only returned for unrecognised/exotic backends.
        if (persona?.preferred_backend) {
          if (persona.preferred_backend === 'ollama') return 'local';
          if (persona.preferred_backend === 'hybrid') return 'hybrid';
          if (persona.preferred_backend === 'nebius') return settings.privacyMode;
          // Truly unknown backend → custom
          return 'custom';
        }
        return settings.privacyMode;
      },

      getAllModels: () => [...get().models, ...get().ollamaModels],

      getLocalModels: () => get().ollamaModels.filter((m) => m.isEnabled),

      getCloudModels: () => get().models.filter((m) => m.isEnabled),
    }),
    {
      name: "assistant-settings",
      version: 5, // v5: privacy mode replaces airplane mode
      migrate: (persisted: unknown, _version: number) => {
        // On version change, preserve user settings but reset model lists to new defaults
        const p = persisted as Partial<{ settings: Record<string, any> }>;
        const old = p?.settings ?? {} as Record<string, any>;
        // Migrate airplaneMode → privacyMode
        const privacyMode = old.airplaneMode ? 'local' as const : (old.privacyMode ?? 'cloud' as const);
        return {
          settings: {
            ...DEFAULT_SETTINGS,
            ...old,
            privacyMode,
            localModeModel: old.localModeModel ?? old.airplaneModeModel ?? 'qwen3-1.7b',
            hybridModeModel: old.hybridModeModel ?? 'qwen3-32b-fast',
            cloudModeModel: old.cloudModeModel ?? old.defaultModelId ?? 'qwen3-32b-fast',
            airplaneMode: privacyMode === 'local',
            airplaneModeModel: old.airplaneModeModel ?? 'qwen3-1.7b',
          },
          models: DEFAULT_MODELS,
          ollamaModels: DEFAULT_OLLAMA_MODELS,
        };
      },
      partialize: (state) => ({
        settings: state.settings,
        models: state.models,
        ollamaModels: state.ollamaModels,
      }),
    }
  )
);
