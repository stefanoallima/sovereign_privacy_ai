import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppSettings, LLMModel } from "@/types";

// Default local Ollama models
const DEFAULT_OLLAMA_MODELS: LLMModel[] = [
  {
    id: "ollama-mistral-7b",
    provider: "ollama",
    apiModelId: "mistral:7b-instruct-q5_K_M",
    name: "Mistral 7B (Local)",
    contextWindow: 8000,
    speedTier: "medium",
    intelligenceTier: "good",
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    isEnabled: true,
    isDefault: true,
  },
  {
    id: "ollama-llama3.2-3b",
    provider: "ollama",
    apiModelId: "llama3.2:3b",
    name: "Llama 3.2 3B (Local)",
    contextWindow: 8000,
    speedTier: "very-fast",
    intelligenceTier: "good",
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    isEnabled: true,
    isDefault: false,
  },
  {
    id: "ollama-llama3.1-8b",
    provider: "ollama",
    apiModelId: "llama3.1:8b",
    name: "Llama 3.1 8B (Local)",
    contextWindow: 8000,
    speedTier: "fast",
    intelligenceTier: "high",
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    isEnabled: true,
    isDefault: false,
  },
  {
    id: "ollama-qwen2.5-7b",
    provider: "ollama",
    apiModelId: "qwen2.5:7b",
    name: "Qwen 2.5 7B (Quantized)",
    contextWindow: 32000,
    speedTier: "fast",
    intelligenceTier: "high",
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    isEnabled: true,
    isDefault: false,
  },
  {
    id: "ollama-deepseek-r1-7b",
    provider: "ollama",
    apiModelId: "deepseek-r1:7b",
    name: "DeepSeek R1 7B (Local)",
    contextWindow: 16000,
    speedTier: "medium",
    intelligenceTier: "very-high",
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    isEnabled: true,
    isDefault: false,
  },
];

// Default models available on Nebius
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
    id: "qwen3-14b",
    provider: "nebius",
    apiModelId: "Qwen/Qwen3-14B",
    name: "Qwen3 14B",
    contextWindow: 128000,
    speedTier: "very-fast",
    intelligenceTier: "good",
    inputCostPer1M: 0.1,
    outputCostPer1M: 0.1,
    isEnabled: true,
    isDefault: false,
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
    id: "llama-3.1-70b",
    provider: "nebius",
    apiModelId: "meta-llama/Llama-3.1-70B-Instruct",
    name: "Llama 3.1 70B",
    contextWindow: 128000,
    speedTier: "medium",
    intelligenceTier: "very-high",
    inputCostPer1M: 0.35,
    outputCostPer1M: 0.35,
    isEnabled: true,
    isDefault: false,
  },
  {
    id: "llama-3.1-8b",
    provider: "nebius",
    apiModelId: "meta-llama/Llama-3.1-8B-Instruct",
    name: "Llama 3.1 8B",
    contextWindow: 128000,
    speedTier: "very-fast",
    intelligenceTier: "good",
    inputCostPer1M: 0.05,
    outputCostPer1M: 0.05,
    isEnabled: true,
    isDefault: false,
  },
  {
    id: "mistral-nemo",
    provider: "nebius",
    apiModelId: "mistralai/Mistral-Nemo-Instruct-2407",
    name: "Mistral Nemo",
    contextWindow: 128000,
    speedTier: "very-fast",
    intelligenceTier: "good",
    inputCostPer1M: 0.08,
    outputCostPer1M: 0.08,
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
  airplaneMode: false,
  airplaneModeModel: "mistral:7b-instruct-q5_K_M",
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

      // Returns models appropriate for current mode (airplane = local only, otherwise cloud)
      getEnabledModels: () => {
        const { settings, models, ollamaModels } = get();
        if (settings.airplaneMode) {
          return ollamaModels.filter((m) => m.isEnabled);
        }
        return models.filter((m) => m.isEnabled);
      },

      getDefaultModel: () => {
        const { settings, models, ollamaModels } = get();
        if (settings.airplaneMode) {
          // Return first enabled ollama model or the one matching airplaneModeModel
          const matchingModel = ollamaModels.find(
            (m) => m.apiModelId === settings.airplaneModeModel
          );
          return matchingModel || ollamaModels.find((m) => m.isEnabled);
        }
        return models.find((m) => m.id === settings.defaultModelId);
      },

      getModelById: (id) => {
        const { models, ollamaModels } = get();
        return models.find((m) => m.id === id) || ollamaModels.find((m) => m.id === id);
      },

      isAirplaneModeActive: () => get().settings.airplaneMode,

      getAllModels: () => [...get().models, ...get().ollamaModels],

      getLocalModels: () => get().ollamaModels.filter((m) => m.isEnabled),

      getCloudModels: () => get().models.filter((m) => m.isEnabled),
    }),
    {
      name: "assistant-settings",
      partialize: (state) => ({
        settings: state.settings,
        models: state.models,
        ollamaModels: state.ollamaModels,
      }),
    }
  )
);
