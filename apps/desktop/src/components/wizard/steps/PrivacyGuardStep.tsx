import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useWizardStore } from "@/stores/wizard";
import { useSettingsStore } from "@/stores/settings";
import { Shield, Zap, Scale, CheckCircle2, Download, Loader2, SkipForward } from "lucide-react";

interface GlinerModelStatus {
  id: string;
  name: string;
  is_downloaded: boolean;
}

const TIERS = [
  {
    id: "gliner-small",
    label: "Fast",
    tagline: "Quick & lightweight",
    description: "Catches the most common personal details — names, emails, phone numbers. Runs quickly on any machine.",
    icon: Zap,
    iconColor: "text-amber-500",
    borderColor: "border-amber-200 dark:border-amber-800",
    bgColor: "bg-amber-50 dark:bg-amber-950/20",
    size: "~600 MB",
    accuracy: "Good",
    speed: "Fast",
    recommended: false,
  },
  {
    id: "gliner-large-q8",
    label: "Balanced",
    tagline: "Best of both worlds",
    description: "High accuracy with a small footprint, thanks to smart compression. Detects a wide range of sensitive data. Best for most users.",
    icon: Scale,
    iconColor: "text-blue-500",
    borderColor: "border-blue-200 dark:border-blue-800",
    bgColor: "bg-blue-50 dark:bg-blue-950/20",
    size: "~650 MB",
    accuracy: "High",
    speed: "Good",
    recommended: true,
  },
  {
    id: "gliner-large",
    label: "Thorough",
    tagline: "Maximum detection",
    description: "The most comprehensive scanner. Catches subtle PII that other models miss. Best for highly sensitive use cases.",
    icon: Shield,
    iconColor: "text-green-600",
    borderColor: "border-green-200 dark:border-green-800",
    bgColor: "bg-green-50 dark:bg-green-950/20",
    size: "~1.8 GB",
    accuracy: "Best",
    speed: "Slower",
    recommended: false,
  },
];

export function PrivacyGuardStep() {
  const { choices, updateChoices, nextStep } = useWizardStore();
  const { updateSettings } = useSettingsStore();
  const [models, setModels] = useState<GlinerModelStatus[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedTierId, setSelectedTierId] = useState<string>(
    choices.glinerModelId ?? "gliner-large-q8"
  );
  const [downloadedId, setDownloadedId] = useState<string | null>(
    choices.glinerModelId ?? null
  );
  const [error, setError] = useState<string | null>(null);

  const loadModels = useCallback(async () => {
    try {
      const result = await invoke<GlinerModelStatus[]>("list_gliner_models");
      setModels(result);
      const tierIds = TIERS.map((t) => t.id);
      const downloaded = result.find(
        (m) => m.is_downloaded && tierIds.includes(m.id)
      );
      if (downloaded && !downloadedId) {
        setDownloadedId(downloaded.id);
        setSelectedTierId(downloaded.id);
      }
    } catch (e) {
      console.warn("Could not list GLiNER models:", e);
    }
  }, [downloadedId]);

  useEffect(() => {
    loadModels();
  }, []);

  useEffect(() => {
    if (!downloading) return;
    const interval = setInterval(async () => {
      try {
        const p = await invoke<number>("get_gliner_download_progress");
        setProgress(p);
        if (p >= 100) {
          setDownloading(false);
          setProgress(100);
          clearInterval(interval);
          setDownloadedId(selectedTierId);
          await loadModels();
        }
      } catch {
        clearInterval(interval);
      }
    }, 800);
    return () => clearInterval(interval);
  }, [downloading, selectedTierId, loadModels]);

  const handleDownload = async () => {
    setError(null);
    setDownloading(true);
    setProgress(0);
    try {
      await invoke("download_gliner_model", { modelId: selectedTierId });
    } catch (e) {
      setError(String(e));
      setDownloading(false);
    }
  };

  const handleContinue = () => {
    if (downloadedId) {
      updateChoices({ glinerModelId: downloadedId, glinerEnabled: true });
      updateSettings({ glinerEnabled: true, glinerModelId: downloadedId });
    } else {
      updateChoices({ glinerModelId: null, glinerEnabled: false });
    }
    nextStep();
  };

  const handleSkip = () => {
    updateChoices({ glinerModelId: null, glinerEnabled: false });
    nextStep();
  };

  const isAlreadyDownloaded = (tierId: string) =>
    models.find((m) => m.id === tierId)?.is_downloaded ?? false;

  const selectedTier = TIERS.find((t) => t.id === selectedTierId);

  return (
    <div className="max-w-lg mx-auto">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-3">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Shield className="h-7 w-7 text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-bold mb-2">Privacy Shield</h2>
        <p className="text-[hsl(var(--muted-foreground))] max-w-sm mx-auto text-sm leading-relaxed">
          An on-device AI scanner spots personal details in your messages before they leave your device — names, emails, phone numbers and more get replaced with safe placeholders automatically.
        </p>
      </div>

      {/* How it works */}
      <div className="rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))] p-4 mb-6 text-sm">
        <p className="font-medium mb-2">How it protects you</p>
        <div className="space-y-1.5 text-[hsl(var(--muted-foreground))]">
          <div className="flex gap-2">
            <span className="text-[hsl(var(--primary))] font-bold">1.</span>
            <span>You type: <em>"My email is john@example.com"</em></span>
          </div>
          <div className="flex gap-2">
            <span className="text-[hsl(var(--primary))] font-bold">2.</span>
            <span>Scanner detects PII on-device — nothing sent yet</span>
          </div>
          <div className="flex gap-2">
            <span className="text-[hsl(var(--primary))] font-bold">3.</span>
            <span>Cloud receives: <em>"My email is [EMAIL]"</em></span>
          </div>
          <div className="flex gap-2">
            <span className="text-[hsl(var(--primary))] font-bold">4.</span>
            <span>You see the real answer with your details restored</span>
          </div>
        </div>
      </div>

      {/* Tier cards */}
      <div className="space-y-3 mb-6">
        {TIERS.map((tier) => {
          const TierIcon = tier.icon;
          const isSelected = selectedTierId === tier.id;
          const isDownloaded = isAlreadyDownloaded(tier.id);

          return (
            <button
              key={tier.id}
              type="button"
              onClick={() => !downloading && setSelectedTierId(tier.id)}
              disabled={downloading}
              className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                isSelected
                  ? `${tier.borderColor} ${tier.bgColor}`
                  : "border-[hsl(var(--border)/0.5)] hover:border-[hsl(var(--border))]"
              } ${downloading ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 ${tier.iconColor}`}>
                  {isDownloaded ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <TierIcon className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{tier.label}</span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{tier.tagline}</span>
                    {tier.recommended && (
                      <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                        Recommended
                      </span>
                    )}
                    {isDownloaded && (
                      <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                        Ready
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 leading-relaxed">
                    {tier.description}
                  </p>
                  <div className="flex gap-4 mt-2">
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      <span className="font-medium">Size:</span> {tier.size}
                    </span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      <span className="font-medium">Accuracy:</span> {tier.accuracy}
                    </span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      <span className="font-medium">Speed:</span> {tier.speed}
                    </span>
                  </div>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 transition-colors ${
                  isSelected
                    ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]"
                    : "border-[hsl(var(--border))]"
                }`} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Download progress */}
      {downloading && (
        <div className="rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))] p-4 mb-4">
          <div className="flex items-center gap-3 mb-2">
            <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--primary))]" />
            <span className="text-sm font-medium">Downloading {selectedTier?.label} scanner…</span>
            <span className="text-sm text-[hsl(var(--muted-foreground))] ml-auto">{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-[hsl(var(--secondary))] overflow-hidden">
            <div
              className="h-full rounded-full bg-[hsl(var(--primary))] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
            You can continue the setup while downloading in the background.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-3 mb-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3">
        {downloadedId ? (
          <button
            onClick={handleContinue}
            className="w-full py-3 rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            Continue with Privacy Shield enabled
          </button>
        ) : (
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full py-3 rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {downloading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Downloading…</>
            ) : (
              <><Download className="h-4 w-4" />Download {selectedTier?.label ?? "scanner"}</>
            )}
          </button>
        )}

        {downloading && !downloadedId && (
          <button
            onClick={handleContinue}
            className="w-full py-3 rounded-xl border border-[hsl(var(--border))] font-medium text-sm hover:bg-[hsl(var(--secondary))] transition-colors flex items-center justify-center gap-2"
          >
            Continue — finish download in background
          </button>
        )}

        <button
          onClick={handleSkip}
          disabled={downloading}
          className="w-full py-2 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <SkipForward className="h-3.5 w-3.5" />
          Skip for now — add later in Settings
        </button>
      </div>
    </div>
  );
}
