import { useWizardStore } from "@/stores/wizard";
import { WelcomeStep } from "./steps/WelcomeStep";
import { PrivacyProfileStep } from "./steps/PrivacyProfileStep";
import { PrivacyGuardStep } from "./steps/PrivacyGuardStep";
import { ApiConfigStep } from "./steps/ApiConfigStep";
import { CloudTrustStep } from "./steps/CloudTrustStep";
import { PersonaStep } from "./steps/PersonaStep";
import { SettingsPreview } from "./steps/SettingsPreview";
import { WizardChat } from "./WizardChat";
import { ArrowLeft, X } from "lucide-react";

// Steps 0-6: Welcome, Privacy, Privacy Shield, Cloud AI API, Cloud Trust, Persona, Review
const STEP_LABELS = ["Welcome", "Privacy", "Privacy Shield", "Cloud AI API", "Cloud Trust", "Persona", "Review"];

export function SetupWizard() {
  const { currentStep, prevStep, goToStep, choices, wizardCompleted, setShowWizard } = useWizardStore();

  // If user chose maximum privacy, skip API key step (3) and Cloud Trust step (4)
  const skipCloudSteps = choices.privacyMode === "maximum";

  // Map logical steps to actual steps, accounting for skipped cloud steps
  const getEffectiveStep = () => {
    if (skipCloudSteps && currentStep >= 3) {
      return currentStep + 2; // skip both step 3 (API) and step 4 (Trust)
    }
    return currentStep;
  };

  const effectiveStep = getEffectiveStep();

  // Determine which step labels to show
  const visibleSteps = skipCloudSteps
    ? STEP_LABELS.filter((_, i) => i !== 3 && i !== 4)
    : STEP_LABELS;

  // Convert a visible-step index back to a currentStep value
  const visibleIndexToCurrentStep = (visibleIndex: number) => {
    return visibleIndex;
  };

  const renderStep = () => {
    switch (effectiveStep) {
      case 0:
        return <WelcomeStep />;
      case 1:
        return <PrivacyProfileStep />;
      case 2:
        return <PrivacyGuardStep />;
      case 3:
        return <ApiConfigStep />;
      case 4:
        return <CloudTrustStep />;
      case 5:
        return <PersonaStep />;
      case 6:
        return <SettingsPreview />;
      default:
        return <SettingsPreview />;
    }
  };

  const canGoBack = currentStep > 0;
  const isRevisiting = wizardCompleted;

  // Welcome step (step 0) uses full width — no chat panel
  const showChatPanel = effectiveStep > 0;

  // A step is navigable if user has already been past it (i.e., it's completed)
  const isStepNavigable = (stepIndex: number) => {
    return effectiveStep > stepIndex;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[hsl(var(--background))]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border)/0.5)]">
        <div className="flex items-center gap-3">
          {canGoBack && (
            <button
              onClick={() => prevStep()}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors"
              title="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <h1 className="font-semibold text-lg">
            {isRevisiting ? "Settings" : "Set up your AI"}
          </h1>
        </div>

        {isRevisiting && (
          <button
            onClick={() => setShowWizard(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Progress — clickable steps */}
      <div className="px-6 py-3 flex items-center gap-2">
        {visibleSteps.map((label, i) => {
          const stepIndex = skipCloudSteps && i >= 3 ? i + 2 : i;
          const isActive = effectiveStep === stepIndex;
          const isCompleted = effectiveStep > stepIndex;
          const navigable = isStepNavigable(stepIndex);

          return (
            <button
              key={label}
              type="button"
              disabled={!navigable && !isActive}
              onClick={() => {
                if (navigable) {
                  goToStep(visibleIndexToCurrentStep(i));
                }
              }}
              className={`flex-1 group ${navigable ? "cursor-pointer" : isActive ? "cursor-default" : "cursor-not-allowed"}`}
              title={navigable ? `Go to ${label}` : label}
            >
              <div
                className={`h-2 rounded-full transition-colors ${
                  isCompleted
                    ? "bg-[hsl(var(--primary))] group-hover:bg-[hsl(var(--primary)/0.7)]"
                    : isActive
                      ? "bg-[hsl(var(--primary)/0.5)]"
                      : "bg-[hsl(var(--secondary))]"
                }`}
              />
            </button>
          );
        })}
      </div>
      <div className="px-6 pb-2 flex justify-between">
        {visibleSteps.map((label, i) => {
          const stepIndex = skipCloudSteps && i >= 3 ? i + 2 : i;
          const isActive = effectiveStep === stepIndex;
          const isCompleted = effectiveStep > stepIndex;

          return (
            <button
              key={label}
              type="button"
              disabled={!isCompleted}
              onClick={() => {
                if (isCompleted) {
                  goToStep(visibleIndexToCurrentStep(i));
                }
              }}
              className={`text-[11px] uppercase tracking-wider font-medium transition-colors ${
                isActive
                  ? "text-[hsl(var(--primary))]"
                  : isCompleted
                    ? "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] cursor-pointer"
                    : "text-[hsl(var(--muted-foreground)/0.5)] cursor-not-allowed"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Content: two-column layout (step content + chat panel) */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left: Step content */}
        <div className={`overflow-y-auto px-6 py-8 ${showChatPanel ? "flex-1 min-w-0" : "w-full"}`}>
          {renderStep()}
        </div>

        {/* Right: AI Chat panel */}
        {showChatPanel && (
          <div className="w-80 flex-shrink-0 border-l border-[hsl(var(--border)/0.5)] p-4">
            <WizardChat />
          </div>
        )}
      </div>
    </div>
  );
}
