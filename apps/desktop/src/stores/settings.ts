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

// Curated cloud models — use "Load models" in API Settings to replace with your endpoint's real list
const DEFAULT_MODELS: LLMModel[] = [
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
    isDefault: true,
  },
  {
    id: "minimax-m1",
    provider: "nebius",
    apiModelId: "MiniMax/MiniMax-M1",
    name: "MiniMax M1",
    contextWindow: 128000,
    speedTier: "medium",
    intelligenceTier: "very-high",
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    isEnabled: true,
    isDefault: false,
  },
  {
    id: "kimi-k2",
    provider: "nebius",
    apiModelId: "moonshotai/Kimi-K2-Instruct",
    name: "Kimi K2",
    contextWindow: 128000,
    speedTier: "medium",
    intelligenceTier: "very-high",
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    isEnabled: true,
    isDefault: false,
  },
];

const DEFAULT_SETTINGS: AppSettings = {
  nebiusApiKey: "",
  nebiusApiEndpoint: "https://api.studio.nebius.ai/v1",
  mem0ApiKey: "",
  enableMemory: false,
  defaultModelId: "qwen3-32b",
  enabledModelIds: DEFAULT_MODELS.map((m) => m.id),
  defaultVoiceId: "en_US-lessac-medium",
  speechRate: 1.0,
  pushToTalkKey: "Ctrl+Space",
  saveAudioRecordings: false,
  encryptLocalData: true,
  // Privacy Mode
  privacyMode: "cloud",
  localModeModel: "qwen3-1.7b",
  hybridModeModel: "qwen3-32b",
  cloudModeModel: "qwen3-32b",
  // Backward compat (derived from privacyMode)
  airplaneMode: false,
  airplaneModeModel: "qwen3-1.7b",
  skipCloudReview: false,
  theme: "light",
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
  replaceCloudModels: (ids: string[]) => void;
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
          return {
            models: newModels,
            settings: {
              ...state.settings,
              enabledModelIds: newModels.map((m) => m.id),
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

      getActivePrivacyMode: (_persona?: any) => {
        // The user's explicit pill selection (settings.privacyMode) always wins.
        // Persona preferred_backend is a routing default, not a UI override.
        return get().settings.privacyMode;
      },

      getAllModels: () => [...get().models, ...get().ollamaModels],

      getLocalModels: () => get().ollamaModels.filter((m) => m.isEnabled),

      getCloudModels: () => get().models.filter((m) => m.isEnabled),
    }),
    {
      name: "assistant-settings",
      version: 8, // v8: remove deepseek, qwen3-32b as default
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
            theme: 'light',
            localModeModel: old.localModeModel ?? old.airplaneModeModel ?? 'qwen3-1.7b',
            hybridModeModel: 'qwen3-32b',
            cloudModeModel: 'qwen3-32b',
            defaultModelId: 'qwen3-32b',
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
