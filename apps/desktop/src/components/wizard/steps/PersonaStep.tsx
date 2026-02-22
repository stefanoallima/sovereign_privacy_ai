import { usePersonasStore } from "@/stores";
import { useWizardStore } from "@/stores/wizard";
import { useWizardAI } from "../useWizardAI";
import { Check } from "lucide-react";

export function PersonaStep() {
  const { personas } = usePersonasStore();
  const { choices, updateChoices, nextStep } = useWizardStore();
  const { generateCommentary } = useWizardAI();

  const handleSelect = async (personaId: string) => {
    updateChoices({ defaultPersonaId: personaId });
    const persona = personas.find((p) => p.id === personaId);
    if (persona) {
      // Pre-built contextual fallbacks per persona type for instant feedback
      const fallbackMap: Record<string, string> = {
        psychologist: `${persona.name} can help you explore your thoughts and emotions in a safe, private space. Since everything stays on your device, you can be completely open without worrying about your personal reflections being stored anywhere.`,
        "life-coach": `${persona.name} will help you set goals, build habits, and navigate life transitions. Having a private AI coach means you can discuss your ambitions and challenges honestly, without any of it leaving your device.`,
        "career-coach": `${persona.name} can guide you through career decisions, interview prep, and professional growth. Sensitive career topics like salary negotiations or workplace issues stay completely private.`,
        "tax-advisor": `${persona.name} is great for understanding tax concepts and planning — especially useful since tax questions involve highly sensitive financial data that you'd want to keep private.`,
      };

      const fallback = fallbackMap[persona.id] || `${persona.name} is a great choice! ${persona.description}. You can switch between personas anytime during your conversations.`;

      await generateCommentary(
        `The user chose the "${persona.name}" persona: ${persona.description}. Give a brief encouraging comment about this choice, mentioning how privacy helps with this topic.`,
        fallback
      );
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Choose Your Default Persona</h2>
        <p className="text-[hsl(var(--muted-foreground))]">
          Pick who you'd like to chat with first. You can switch personas anytime.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {personas.map((persona) => {
          const isSelected = choices.defaultPersonaId === persona.id;

          return (
            <button
              key={persona.id}
              onClick={() => handleSelect(persona.id)}
              className={`relative flex flex-col items-center text-center p-5 rounded-2xl border-2 transition-all hover:shadow-md ${
                isSelected
                  ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)] shadow-sm"
                  : "border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))] hover:border-[hsl(var(--border))]"
              }`}
            >
              {isSelected && (
                <div className="absolute top-3 right-3">
                  <Check className="h-5 w-5 text-[hsl(var(--primary))]" />
                </div>
              )}
              <span className="text-3xl mb-2">{persona.icon}</span>
              <h3 className="font-semibold text-sm">{persona.name}</h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 line-clamp-2">
                {persona.description}
              </p>
            </button>
          );
        })}
      </div>

      <div className="flex justify-end mt-6">
        <button
          onClick={() => nextStep()}
          disabled={!choices.defaultPersonaId}
          className="px-8 py-3 rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
