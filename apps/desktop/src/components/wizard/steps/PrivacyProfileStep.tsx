import { useWizardStore } from "@/stores/wizard";
import { useWizardAI } from "../useWizardAI";
import { Check, ShieldOff } from "lucide-react";

// ─── Volume bar component ────────────────────────────────────────
// Renders a horizontal bar with filled segments (like a volume meter)

function LevelBar({
  level,
  maxLevel = 5,
  color,
  label,
}: {
  level: number;
  maxLevel?: number;
  color: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] w-[72px] text-right shrink-0">
        {label}
      </span>
      <div className="flex gap-0.5 flex-1">
        {Array.from({ length: maxLevel }, (_, i) => (
          <div
            key={i}
            className={`h-3 flex-1 rounded-sm transition-colors ${
              i < level ? color : "bg-[hsl(var(--secondary))]"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Option definitions ──────────────────────────────────────────

const PRIVACY_OPTIONS = [
  {
    id: "maximum" as const,
    title: "Local Only",
    subtitle: "Maximum privacy",
    description: "All processing on your device. No data ever leaves your computer. Requires a downloaded local model.",
    example: "Like a personal diary — completely private, no one else sees it.",
    privacy: 5,
    intelligence: 2,
    privacyColor: "bg-green-500",
    intelligenceColor: "bg-blue-500",
    selectable: true,
    fallback: "Everything stays on your device — your conversations, your data, your AI. No internet connection is needed, and no data ever leaves your computer. The trade-off is that local models are smaller and less capable than cloud AI, but your privacy is absolute.",
    prompt: "The user chose Local Only mode — everything runs locally with no cloud. Give a brief encouraging comment about their privacy choice and mention the trade-off with intelligence.",
  },
  {
    id: "balanced" as const,
    title: "Smart Shield",
    subtitle: "High privacy + high intelligence",
    description: "Your personal data is stripped locally before anonymized prompts are sent to a cloud AI with zero data retention.",
    example: "Like sending a redacted letter — the recipient reads it but never sees your personal details.",
    privacy: 4,
    intelligence: 4,
    privacyColor: "bg-green-500",
    intelligenceColor: "bg-blue-500",
    selectable: true,
    fallback: "The best of both worlds — before your prompt leaves your device, the local Privacy Guard automatically removes personal details like names, addresses, and financial data. The anonymized prompt is then sent to a powerful cloud AI model for a high-quality response, which is re-enriched locally with your real information. You get strong AI intelligence without exposing your private data.",
    prompt: "The user chose Smart Shield — local anonymization with zero-retention cloud AI. Briefly explain how local PII stripping + cloud intelligence gives the best of both worlds.",
  },
  {
    id: "performance" as const,
    title: "Performance",
    subtitle: "Cloud AI with zero retention",
    description: "Direct cloud AI access using a provider with zero data retention enabled. Fast and capable, with provider-level privacy guarantees.",
    example: "Like a phone call — the operator helps you but doesn't record the conversation.",
    privacy: 3,
    intelligence: 5,
    privacyColor: "bg-yellow-500",
    intelligenceColor: "bg-blue-500",
    selectable: true,
    fallback: "You'll get the fastest and most capable AI responses by connecting directly to a cloud provider. With zero data retention enabled, your prompts are processed and immediately discarded — never stored, never used for training. Make sure to enable zero retention in your provider's settings.",
    prompt: "The user chose Performance mode — direct cloud AI with zero retention. Give a brief encouraging comment and remind them to enable zero data retention.",
  },
  {
    id: "no_privacy" as const,
    title: "Standard Cloud AI",
    subtitle: "Privacy defined by provider",
    description: "Privacy depends entirely on the inference provider's privacy policy and terms of service. Without zero retention, your data may be stored indefinitely.",
    example: "Possible usage: targeted advertising, training the provider's models for other users, or sharing aggregated data with third parties.",
    privacy: 1,
    intelligence: 5,
    privacyColor: "bg-red-500",
    intelligenceColor: "bg-blue-500",
    selectable: false,
    fallback: "",
    prompt: "",
  },
] as const;

type SelectableId = "maximum" | "balanced" | "performance";

// ─── Component ───────────────────────────────────────────────────

export function PrivacyProfileStep() {
  const { choices, updateChoices, nextStep } = useWizardStore();
  const { generateCommentary } = useWizardAI();

  const handleSelect = async (option: (typeof PRIVACY_OPTIONS)[number]) => {
    if (!option.selectable) return;
    updateChoices({ privacyMode: option.id as SelectableId });
    await generateCommentary(option.prompt, option.fallback);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Choose Your Privacy Level</h2>
        <p className="text-[hsl(var(--muted-foreground))]">
          Every choice is a trade-off between privacy and intelligence. Pick the balance that's right for you.
        </p>
      </div>

      {/* Options — horizontal grid */}
      <div className="grid grid-cols-4 gap-3">
        {PRIVACY_OPTIONS.map((option) => {
          const isSelected = choices.privacyMode === option.id;
          const disabled = !option.selectable;

          return (
            <button
              key={option.id}
              onClick={() => handleSelect(option)}
              disabled={disabled}
              className={`relative flex flex-col text-left p-4 rounded-2xl border-2 transition-all ${
                disabled
                  ? "border-red-500/20 bg-red-500/[0.02] opacity-60 cursor-not-allowed"
                  : isSelected
                    ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)] shadow-md"
                    : "border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))] hover:border-[hsl(var(--border))] hover:shadow-sm"
              }`}
            >
              {/* Selected indicator */}
              {isSelected && (
                <div className="absolute top-3 right-3">
                  <Check className="h-5 w-5 text-[hsl(var(--primary))]" />
                </div>
              )}

              {/* Not available badge */}
              {disabled && (
                <div className="absolute top-3 right-3">
                  <ShieldOff className="h-4 w-4 text-red-400" />
                </div>
              )}

              {/* Title */}
              <h3 className={`font-semibold text-sm mb-0.5 pr-6 ${disabled ? "text-[hsl(var(--muted-foreground))]" : ""}`}>
                {option.title}
              </h3>
              <p className={`text-[10px] font-medium mb-3 ${disabled ? "text-red-400" : "text-[hsl(var(--muted-foreground))]"}`}>
                {option.subtitle}
              </p>

              {/* Volume bars */}
              <div className="space-y-1.5 mb-3">
                <LevelBar
                  label="Privacy"
                  level={option.privacy}
                  color={option.privacyColor}
                />
                <LevelBar
                  label="Intelligence"
                  level={option.intelligence}
                  color={option.intelligenceColor}
                />
              </div>

              {/* Description */}
              <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-relaxed mb-2">
                {option.description}
              </p>

              {/* Example */}
              <p className={`text-[10px] leading-relaxed ${disabled ? "text-red-400/80 font-medium" : "italic text-[hsl(var(--muted-foreground)/0.6)]"}`}>
                {option.example}
              </p>
            </button>
          );
        })}
      </div>

      {/* Continue */}
      <div className="flex justify-end mt-6">
        <button
          onClick={() => nextStep()}
          disabled={!choices.privacyMode}
          className="px-8 py-3 rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
