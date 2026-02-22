import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface WizardChoices {
  privacyMode: "maximum" | "balanced" | "performance" | null;
  apiKeyConfigured: boolean;
  apiKeyValue: string;
  defaultPersonaId: string | null;
  localModelDownloaded: boolean;
}

interface WizardChatMessage {
  role: "assistant" | "user";
  content: string;
}

interface WizardStore {
  // Persisted
  wizardCompleted: boolean;
  tourCompleted: boolean;

  // Transient
  showWizard: boolean;
  currentStep: number;
  choices: WizardChoices;
  chatMessages: WizardChatMessage[];
  isAiLoading: boolean;

  // Actions
  setShowWizard: (show: boolean) => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  updateChoices: (partial: Partial<WizardChoices>) => void;
  addChatMessage: (role: WizardChatMessage["role"], content: string) => void;
  clearChatMessages: () => void;
  setAiLoading: (loading: boolean) => void;
  setTourCompleted: (completed: boolean) => void;
  completeWizard: () => void;
  resetWizard: () => void;
}

export const useWizardStore = create<WizardStore>()(
  persist(
    (set) => ({
      // Persisted
      wizardCompleted: false,
      tourCompleted: false,

      // Transient (not persisted)
      showWizard: false,
      currentStep: 0,
      choices: {
        privacyMode: null,
        apiKeyConfigured: false,
        apiKeyValue: "",
        defaultPersonaId: null,
        localModelDownloaded: false,
      },
      chatMessages: [],
      isAiLoading: false,

      setShowWizard: (show) => set({ showWizard: show }),

      nextStep: () =>
        set((state) => ({ currentStep: state.currentStep + 1 })),

      prevStep: () =>
        set((state) => ({
          currentStep: Math.max(0, state.currentStep - 1),
        })),

      goToStep: (step) => set({ currentStep: step }),

      updateChoices: (partial) =>
        set((state) => ({
          choices: { ...state.choices, ...partial },
        })),

      addChatMessage: (role, content) =>
        set((state) => ({
          chatMessages: [...state.chatMessages, { role, content }],
        })),

      clearChatMessages: () => set({ chatMessages: [] }),

      setAiLoading: (loading) => set({ isAiLoading: loading }),

      setTourCompleted: (completed) => set({ tourCompleted: completed }),

      completeWizard: () =>
        set({
          wizardCompleted: true,
          showWizard: false,
          currentStep: 0,
          chatMessages: [],
        }),

      resetWizard: () =>
        set({
          showWizard: true,
          currentStep: 0,
          choices: {
            privacyMode: null,
            apiKeyConfigured: false,
            apiKeyValue: "",
            defaultPersonaId: null,
            localModelDownloaded: false,
          },
          chatMessages: [],
          isAiLoading: false,
        }),
    }),
    {
      name: "assistant-wizard",
      partialize: (state) => ({
        wizardCompleted: state.wizardCompleted,
        tourCompleted: state.tourCompleted,
      }),
    }
  )
);
