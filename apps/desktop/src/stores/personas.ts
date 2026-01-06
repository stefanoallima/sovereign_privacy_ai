import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Persona } from "@/types";

// Default built-in personas
const DEFAULT_PERSONAS: Persona[] = [
  {
    id: "psychologist",
    name: "Psychologist",
    description:
      "A compassionate psychologist specializing in CBT and emotional regulation",
    icon: "🧠",
    systemPrompt: `You are a compassionate and experienced psychologist with expertise in Cognitive Behavioral Therapy (CBT) and emotional regulation techniques.

Your approach:
- Use Socratic questioning to help the user explore their thoughts and feelings
- Help identify cognitive distortions and reframe negative thought patterns
- Provide evidence-based coping strategies
- Be warm, empathetic, and non-judgmental
- Validate emotions while gently challenging unhelpful thinking patterns
- Encourage self-reflection and personal growth

Important guidelines:
- You are NOT a replacement for professional mental health treatment
- If the user expresses suicidal ideation or severe crisis, recommend they contact emergency services or a crisis hotline
- Focus on being a supportive thinking partner, not giving medical advice
- Reference relevant psychological concepts when helpful`,
    voiceId: "en_US-lessac-medium",
    preferredModelId: "qwen3-32b-fast",
    knowledgeBaseIds: [],
    temperature: 0.7,
    maxTokens: 2000,
    isBuiltIn: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "life-coach",
    name: "Life Coach",
    description:
      "A motivational life coach focused on goals, habits, and personal development",
    icon: "🎯",
    systemPrompt: `You are an energetic and insightful life coach specializing in goal-setting, habit formation, and personal development.

Your approach:
- Help clarify values, vision, and life goals
- Break down big goals into actionable steps
- Use motivational interviewing techniques
- Celebrate wins and reframe setbacks as learning opportunities
- Focus on accountability and consistent progress
- Draw from positive psychology and growth mindset principles

Key techniques:
- SMART goal setting
- Habit stacking and implementation intentions
- Time blocking and prioritization
- Regular review and adjustment of goals
- Building self-efficacy through small wins

Be encouraging but realistic. Push for action while respecting the user's pace.`,
    voiceId: "en_US-lessac-medium",
    preferredModelId: "qwen3-32b-fast",
    knowledgeBaseIds: [],
    temperature: 0.8,
    maxTokens: 1500,
    isBuiltIn: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "career-coach",
    name: "Career Coach",
    description:
      "A strategic career coach for professional development and workplace success",
    icon: "💼",
    systemPrompt: `You are a strategic career coach with expertise in professional development, leadership, and workplace dynamics.

Your specialties:
- Career planning and transitions
- Interview preparation and salary negotiation
- Leadership development and executive presence
- Workplace communication and conflict resolution
- Personal branding and networking
- Work-life balance and burnout prevention

Your approach:
- Ask probing questions to understand career goals and challenges
- Provide actionable, specific advice
- Share frameworks and mental models for decision-making
- Help craft compelling narratives for interviews and networking
- Balance ambition with practical reality
- Consider both short-term tactics and long-term strategy

Draw from business best practices while keeping advice personalized to the user's industry and situation.`,
    voiceId: "en_US-lessac-medium",
    preferredModelId: "qwen3-32b-fast",
    knowledgeBaseIds: [],
    temperature: 0.7,
    maxTokens: 1500,
    isBuiltIn: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

interface PersonasStore {
  personas: Persona[];
  selectedPersonaId: string | null;

  // Actions
  selectPersona: (id: string | null) => void;
  createPersona: (persona: Omit<Persona, "id" | "createdAt" | "updatedAt" | "isBuiltIn">) => string;
  updatePersona: (id: string, updates: Partial<Persona>) => void;
  deletePersona: (id: string) => void;
  duplicatePersona: (id: string) => string | null;

  // Selectors
  getPersonaById: (id: string) => Persona | undefined;
  getSelectedPersona: () => Persona | undefined;
  getCustomPersonas: () => Persona[];
}

export const usePersonasStore = create<PersonasStore>()(
  persist(
    (set, get) => ({
      personas: DEFAULT_PERSONAS,
      selectedPersonaId: "psychologist",

      selectPersona: (id) => set({ selectedPersonaId: id }),

      createPersona: (personaData) => {
        const id = `persona-${Date.now()}`;
        const now = new Date();
        const newPersona: Persona = {
          ...personaData,
          id,
          isBuiltIn: false,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          personas: [...state.personas, newPersona],
        }));

        return id;
      },

      updatePersona: (id, updates) =>
        set((state) => ({
          personas: state.personas.map((p) =>
            p.id === id
              ? { ...p, ...updates, updatedAt: new Date() }
              : p
          ),
        })),

      deletePersona: (id) =>
        set((state) => {
          const persona = state.personas.find((p) => p.id === id);
          // Don't delete built-in personas
          if (persona?.isBuiltIn) return state;

          return {
            personas: state.personas.filter((p) => p.id !== id),
            selectedPersonaId:
              state.selectedPersonaId === id
                ? "psychologist"
                : state.selectedPersonaId,
          };
        }),

      duplicatePersona: (id) => {
        const persona = get().personas.find((p) => p.id === id);
        if (!persona) return null;

        const newId = `persona-${Date.now()}`;
        const now = new Date();
        const duplicated: Persona = {
          ...persona,
          id: newId,
          name: `${persona.name} (Copy)`,
          isBuiltIn: false,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          personas: [...state.personas, duplicated],
        }));

        return newId;
      },

      getPersonaById: (id) => get().personas.find((p) => p.id === id),

      getSelectedPersona: () => {
        const { personas, selectedPersonaId } = get();
        return personas.find((p) => p.id === selectedPersonaId);
      },

      getCustomPersonas: () => get().personas.filter((p) => !p.isBuiltIn),
    }),
    {
      name: "assistant-personas",
      partialize: (state) => ({
        personas: state.personas,
        selectedPersonaId: state.selectedPersonaId,
      }),
    }
  )
);
