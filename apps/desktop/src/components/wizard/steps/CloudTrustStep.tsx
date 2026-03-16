import { useWizardStore } from "@/stores/wizard";
import { useWizardAI } from "../useWizardAI";
import { ExternalLink, ShieldCheck, Shield, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import type { CloudTrustLevel } from "@/stores/wizard";

function openExternal(url: string) {
  import("@tauri-apps/plugin-opener")
    .then(({ openUrl }) => openUrl(url))
    .catch(() => window.open(url, "_blank"));
}

const TRUST_OPTIONS: {
  id: CloudTrustLevel;
  label: string;
  tagline: string;
  description: string;
  icon: typeof ShieldCheck;
  iconColor: string;
  borderColor: string;
  bgColor: string;
  zdrRequired: boolean;
}[] = [
  {
    id: "trusted",
    label: "Trusted",
    tagline: "Zero data retention confirmed",
    description:
      "You have enabled zero data retention on your cloud provider. Sovereign AI will trust it accordingly and won't add extra reminders.",
    icon: ShieldCheck,
    iconColor: "text-green-500",
    borderColor: "border-green-200 dark:border-green-800",
    bgColor: "bg-green-50 dark:bg-green-950/20",
    zdrRequired: true,
  },
  {
    id: "partial",
    label: "Partial trust",
    tagline: "I'm aware of the trade-offs",
    description:
      "You understand that prompts may be logged by the provider. Sovereign AI will still apply Smart Shield anonymisation before any cloud request.",
    icon: Shield,
    iconColor: "text-[hsl(var(--primary))]",
    borderColor: "border-[hsl(var(--primary)/0.2)] dark:border-[hsl(var(--primary)/0.3)]",
    bgColor: "bg-[hsl(var(--primary)/0.05)] dark:bg-[hsl(var(--primary)/0.08)]",
    zdrRequired: false,
  },
  {
    id: "minimal",
    label: "Minimal trust",
    tagline: "Always remind me",
    description:
      "Sovereign AI will show a notice each time a message is routed to a cloud provider, so you stay in control of what leaves your device.",
    icon: AlertTriangle,
    iconColor: "text-amber-500",
    borderColor: "border-amber-200 dark:border-amber-800",
    bgColor: "bg-amber-50 dark:bg-amber-950/20",
    zdrRequired: false,
  },
];

export function CloudTrustStep() {
  const { choices, updateChoices, nextStep } = useWizardStore();
  const { generateCommentary } = useWizardAI();

  const selected = choices.cloudTrustLevel;

  const handleSelect = (level: CloudTrustLevel) => {
    updateChoices({ cloudTrustLevel: level });
  };

  const handleContinue = async () => {
    const level = choices.cloudTrustLevel ?? "partial";
    updateChoices({ cloudTrustLevel: level });

    if (level === "trusted") {
      await generateCommentary(
        "The user confirmed they have zero data retention enabled on their cloud provider. Briefly acknowledge this and reassure them.",
        "Great — with zero data retention enabled, your sanitised prompts won't be stored after processing. You're set up for the best balance of privacy and capability."
      );
    } else if (level === "minimal") {
      await generateCommentary(
        "The user chose 'minimal trust' for the cloud provider, meaning they want reminders before cloud requests. Acknowledge this briefly.",
        "Understood — Sovereign AI will remind you whenever a message is about to leave your device, so you're always in the loop."
      );
    }

    nextStep();
  };

  const handleSkip = () => {
    updateChoices({ cloudTrustLevel: "partial" });
    nextStep();
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-3">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--violet))] flex items-center justify-center shadow-lg">
            <ShieldCheck className="h-7 w-7 text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-bold mb-2">Trust Your Cloud Provider</h2>
        <p className="text-[hsl(var(--muted-foreground))] max-w-sm mx-auto text-sm leading-relaxed">
          In <strong>Smart Shield mode</strong> your personal details are replaced before any cloud
          request. Tell us how much you trust your provider — this controls whether Sovereign AI
          shows privacy reminders.
        </p>
      </div>

      {/* ZDR callout */}
      <div className="rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))] p-4 mb-5 text-sm">
        <p className="font-medium mb-1 flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-green-500" />
          Zero Data Retention (ZDR)
        </p>
        <p className="text-[hsl(var(--muted-foreground))] text-xs leading-relaxed mb-2">
          By default most cloud providers <strong>log your API requests</strong>. Zero data retention
          is a separate account setting that must be enabled explicitly. Without it, even anonymised
          prompts may be stored.
        </p>
        <button
          type="button"
          onClick={() => openExternal("https://ailocalmind.com/docs/zero-data-retention")}
          className="flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--primary))] hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          How to enable ZDR on Nebius (our guide)
        </button>
      </div>

      {/* Trust level cards */}
      <div className="space-y-3 mb-6">
        {TRUST_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = selected === opt.id;

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelect(opt.id)}
              className={`w-full text-left rounded-xl border-2 p-4 transition-all cursor-pointer ${
                isSelected
                  ? `${opt.borderColor} ${opt.bgColor}`
                  : "border-[hsl(var(--border)/0.5)] hover:border-[hsl(var(--border))]"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 ${opt.iconColor}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{opt.label}</span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{opt.tagline}</span>
                    {opt.zdrRequired && (
                      <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                        ZDR confirmed
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 leading-relaxed">
                    {opt.description}
                  </p>
                </div>
                <div
                  className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 transition-colors ${
                    isSelected
                      ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]"
                      : "border-[hsl(var(--border))]"
                  }`}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* ZDR confirmation checkbox (only shown for "trusted") */}
      {selected === "trusted" && (
        <div
          className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 p-4 mb-5 flex items-start gap-3 cursor-pointer"
          onClick={() => updateChoices({ zdrConfirmed: !choices.zdrConfirmed })}
        >
          <div
            className={`mt-0.5 h-5 w-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
              choices.zdrConfirmed
                ? "border-green-500 bg-green-500"
                : "border-[hsl(var(--border))]"
            }`}
          >
            {choices.zdrConfirmed && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
          </div>
          <p className="text-sm text-[hsl(var(--foreground))]">
            I confirm that zero data retention is enabled on my Nebius account (or chosen
            cloud provider).
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <button
          onClick={handleContinue}
          disabled={selected === "trusted" && !choices.zdrConfirmed}
          className="w-full py-3 rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <ArrowRight className="h-4 w-4" />
          {selected ? "Continue" : "Continue"}
        </button>

        <button
          onClick={handleSkip}
          className="w-full py-2 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          Skip — decide later in Settings
        </button>
      </div>
    </div>
  );
}
