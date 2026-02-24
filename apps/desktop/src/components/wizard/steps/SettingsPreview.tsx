import { useWizardStore } from "@/stores/wizard";
import { useSettingsStore, usePersonasStore } from "@/stores";
import { useWizardAI } from "../useWizardAI";
import { useEffect, useRef } from "react";
import {
  Shield,
  Lock,
  Zap,
  Brain,
  HardDrive,
  Pencil,
  CheckCircle,
  XCircle,
} from "lucide-react";


const PRIVACY_LABELS = {
  maximum: { label: "Maximum Privacy", icon: Shield, color: "text-green-500" },
  balanced: { label: "Balanced", icon: Lock, color: "text-blue-500" },
  performance: { label: "Performance", icon: Zap, color: "text-orange-500" },
} as const;

export function SettingsPreview() {
  const { choices, goToStep, completeWizard } = useWizardStore();
  const { updateSettings, setApiKey } = useSettingsStore();
  const { selectPersona, personas, updatePersona } = usePersonasStore();
  const { generateCommentary } = useWizardAI();
  const hasGeneratedSummary = useRef(false);

  const selectedPersona = personas.find((p) => p.id === choices.defaultPersonaId);
  const privacyInfo = choices.privacyMode ? PRIVACY_LABELS[choices.privacyMode] : null;

  // Generate summary on mount
  useEffect(() => {
    if (hasGeneratedSummary.current) return;
    hasGeneratedSummary.current = true;

    const parts = [
      `Privacy: ${choices.privacyMode || "not set"}`,
      `API key: ${choices.apiKeyConfigured ? "configured" : "not set"}`,
      `Persona: ${selectedPersona?.name || "not set"}`,
      `Local model: ${choices.localModelDownloaded ? "downloaded" : "not downloaded"}`,
    ].join(", ");

    generateCommentary(
      `The user has completed setup with these choices: ${parts}. Give a warm 2-3 sentence summary welcoming them and remind them they can adjust settings anytime.`,
      "Your setup is complete! Everything looks great — click 'Apply Settings' to save your choices and start using Sovereign AI. Remember, you can revisit these settings anytime using the Settings Assistant in the sidebar or the Settings panel."
    );
  }, []);

  const handleApply = () => {
    // Apply privacy mode settings
    if (choices.privacyMode === "maximum") {
      updateSettings({ airplaneMode: true });
    } else {
      updateSettings({ airplaneMode: false });
    }

    // Apply API key
    if (choices.apiKeyConfigured && choices.apiKeyValue) {
      setApiKey(choices.apiKeyValue);
    }

    // Apply default persona
    if (choices.defaultPersonaId) {
      selectPersona(choices.defaultPersonaId);
    }

    // Configure persona backends based on privacy mode
    if (choices.privacyMode === "balanced") {
      personas.forEach((persona) => {
        updatePersona(persona.id, {
          preferred_backend: "hybrid",
          enable_local_anonymizer: true,
        });
      });
    } else if (choices.privacyMode === "performance") {
      personas.forEach((persona) => {
        if (!persona.requiresPIIVault) {
          updatePersona(persona.id, {
            preferred_backend: "nebius",
          });
        }
      });
    }

    completeWizard();
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Review Your Settings</h2>
        <p className="text-[hsl(var(--muted-foreground))]">
          Here's a summary of your choices. Click "Change" to adjust any setting.
        </p>
      </div>

      {/* Settings Cards */}
      <div className="rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))] overflow-hidden mb-6">
        {/* Privacy Mode */}
        <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--border)/0.3)]">
          <div className="flex items-center gap-3">
            {privacyInfo ? (
              <privacyInfo.icon className={`h-5 w-5 ${privacyInfo.color}`} />
            ) : (
              <Shield className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
            )}
            <div>
              <p className="text-sm font-medium">Privacy Mode</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {privacyInfo?.label || "Not configured"}
              </p>
            </div>
          </div>
          <button
            onClick={() => goToStep(1)}
            className="flex items-center gap-1 text-xs text-[hsl(var(--primary))] hover:underline"
          >
            <Pencil className="h-3 w-3" />
            Change
          </button>
        </div>

        {/* Privacy Shield (GLiNER) */}
        <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--border)/0.3)]">
          <div className="flex items-center gap-3">
            <Shield className={`h-5 w-5 ${choices.glinerEnabled ? "text-blue-500" : "text-[hsl(var(--muted-foreground))]"}`} />
            <div>
              <p className="text-sm font-medium">Privacy Shield</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {choices.glinerEnabled && choices.glinerModelId
                  ? `Enabled — ${choices.glinerModelId}`
                  : "Not enabled"}
              </p>
            </div>
          </div>
          <button
            onClick={() => goToStep(2)}
            className="flex items-center gap-1 text-xs text-[hsl(var(--primary))] hover:underline"
          >
            <Pencil className="h-3 w-3" />
            Change
          </button>
        </div>

        {/* API Key */}
        {choices.privacyMode !== "maximum" && (
          <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--border)/0.3)]">
            <div className="flex items-center gap-3">
              {choices.apiKeyConfigured ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
              )}
              <div>
                <p className="text-sm font-medium">Cloud AI Provider</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {choices.apiKeyConfigured ? "Nebius AI Studio — configured" : "Not configured"}
                </p>
              </div>
            </div>
            <button
              onClick={() => goToStep(3)}
              className="flex items-center gap-1 text-xs text-[hsl(var(--primary))] hover:underline"
            >
              <Pencil className="h-3 w-3" />
              Change
            </button>
          </div>
        )}

        {/* Default Persona */}
        <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--border)/0.3)]">
          <div className="flex items-center gap-3">
            <Brain className="h-5 w-5 text-purple-500" />
            <div>
              <p className="text-sm font-medium">Default Persona</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {selectedPersona
                  ? `${selectedPersona.icon} ${selectedPersona.name}`
                  : "Not selected"}
              </p>
            </div>
          </div>
          <button
            onClick={() => goToStep(4)}
            className="flex items-center gap-1 text-xs text-[hsl(var(--primary))] hover:underline"
          >
            <Pencil className="h-3 w-3" />
            Change
          </button>
        </div>

        {/* Local Model */}
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <HardDrive className={`h-5 w-5 ${choices.localModelDownloaded ? "text-green-500" : "text-[hsl(var(--muted-foreground))]"}`} />
            <div>
              <p className="text-sm font-medium">Local Model</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {choices.localModelDownloaded ? "Qwen3 1.7B — Ready" : "Not downloaded"}
              </p>
            </div>
          </div>
          <button
            onClick={() => goToStep(0)}
            className="flex items-center gap-1 text-xs text-[hsl(var(--primary))] hover:underline"
          >
            <Pencil className="h-3 w-3" />
            Change
          </button>
        </div>
      </div>

      {/* Apply */}
      <button
        onClick={handleApply}
        className="w-full mt-6 py-4 rounded-xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(162_78%_50%)] text-white font-semibold text-lg hover:opacity-90 transition-opacity shadow-lg"
      >
        Apply Settings
      </button>
    </div>
  );
}
