import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useWizardStore } from "@/stores/wizard";
import { Download, CheckCircle, Loader2, SkipForward, Lock, ShieldCheck } from "lucide-react";

interface LocalModelStatus {
  model_id: string;
  downloaded: boolean;
  size_bytes: number | null;
}

export function WelcomeStep() {
  const { updateChoices, nextStep, choices } = useWizardStore();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [models, setModels] = useState<LocalModelStatus[]>([]);
  const [loaded, setLoaded] = useState(false);

  const targetModel = "qwen3-1.7b";

  const loadLocalModels = useCallback(async () => {
    try {
      const result = await invoke<LocalModelStatus[]>("list_local_models");
      setModels(result);
      const target = result.find((m) => m.model_id === targetModel);
      if (target?.downloaded) {
        updateChoices({ localModelDownloaded: true });
      }
    } catch {
      // Backend not available yet — continue without models
    } finally {
      setLoaded(true);
    }
  }, [updateChoices]);

  useEffect(() => {
    loadLocalModels();
  }, [loadLocalModels]);

  // Poll download progress
  useEffect(() => {
    if (!downloadingId) return;
    const interval = setInterval(async () => {
      try {
        const progress = await invoke<number>("get_local_download_progress");
        setDownloadProgress(progress);
        if (progress >= 100) {
          setDownloadingId(null);
          setDownloadProgress(0);
          updateChoices({ localModelDownloaded: true });
          await loadLocalModels();
        }
      } catch {
        /* ignore */
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [downloadingId, loadLocalModels, updateChoices]);

  const handleDownload = async () => {
    setDownloadingId(targetModel);
    setDownloadProgress(0);
    try {
      await invoke("download_local_model", { modelId: targetModel });
      updateChoices({ localModelDownloaded: true });
      await loadLocalModels();
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setDownloadingId(null);
      setDownloadProgress(0);
    }
  };

  const isDownloaded = choices.localModelDownloaded || models.find((m) => m.model_id === targetModel)?.downloaded;

  return (
    <div className="flex flex-col items-center text-center max-w-lg mx-auto">
      {/* Shield Emblem */}
      <div className="relative h-20 w-20 mb-6 animate-emblem-enter">
        <div className="absolute inset-0 rounded-2xl border-2 border-[hsl(var(--primary)/0.15)] animate-[pulse_3s_ease-in-out_infinite]" />
        <div className="absolute inset-1 rounded-xl bg-[hsl(var(--primary))] flex items-center justify-center shadow-lg shadow-[hsl(var(--primary)/0.3)]">
          <Lock className="h-9 w-9 text-[hsl(var(--primary-foreground))]" strokeWidth={1.8} />
        </div>
        <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-[hsl(var(--violet))] shadow-md flex items-center justify-center">
          <ShieldCheck className="h-3 w-3 text-[hsl(var(--primary-foreground))]" />
        </div>
      </div>

      <h1 className="text-3xl heading-display mb-2">Your AI, your rules</h1>
      <p className="text-[hsl(var(--muted-foreground))] mb-8">
        Set up your private AI assistant in under 2 minutes. Nothing leaves your device unless you choose.
      </p>

      {/* Model Download Card */}
      <div className="w-full rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))] p-6 mb-6">
        <h3 className="text-lg font-semibold mb-2">Local AI Model</h3>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
          Download a small AI model (~1.1 GB) to enable local AI features. This powers the wizard's commentary and offline chat.
        </p>

        {isDownloaded ? (
          <div className="flex items-center justify-center gap-2 text-green-500 py-3">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Qwen3 1.7B — Ready</span>
          </div>
        ) : downloadingId ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-[hsl(var(--muted-foreground))]">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Downloading Qwen3 1.7B...</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[hsl(var(--secondary))] overflow-hidden">
              <div
                className="h-full rounded-full bg-[hsl(var(--primary))] transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {downloadProgress.toFixed(0)}% complete
            </p>
          </div>
        ) : (
          <button
            onClick={handleDownload}
            disabled={!loaded}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Download Model (~1.1 GB)
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 w-full">
        <button
          onClick={() => nextStep()}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] transition-colors"
        >
          <SkipForward className="h-4 w-4" />
          Skip for now
        </button>
        <button
          onClick={() => nextStep()}
          disabled={!isDownloaded}
          className="flex-1 py-3 rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
