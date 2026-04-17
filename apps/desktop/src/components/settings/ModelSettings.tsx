import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import { useSettingsStore } from "@/stores";

interface LocalModelInfo {
  id: string;
  name: string;
  filename: string;
  url: string;
  size_bytes: number;
  ctx_size: number;
  speed_tier: string;
  intelligence_tier: string;
  is_downloaded: boolean;
  local_path: string | null;
  description?: string;
}

interface HfModelMetadata {
  repo_id: string;
  filename: string;
  name: string;
  description: string;
  inferred_ctx_size: number;
}

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
        enabled ? "bg-[hsl(var(--primary))]" : "bg-[hsl(var(--muted))]"
      }`}
      role="switch"
      aria-checked={enabled}
    >
      <span
        className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
          enabled ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );
}

const SPEED_LABEL: Record<string, string> = {
  "very-fast": "Very fast",
  fast: "Fast",
  medium: "Medium",
  slow: "Slow",
};

const INTEL_LABEL: Record<string, string> = {
  "very-high": "Top intelligence",
  high: "High intelligence",
  good: "Good intelligence",
};

const formatSize = (bytes: number) => {
  if (bytes >= 1_000_000_000) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  return (bytes / (1024 * 1024)).toFixed(0) + ' MB';
};

export function ModelSettings() {
  const { models, ollamaModels, setDefaultModel, toggleModel, updateSettings } = useSettingsStore();

  // Local model management state
  const [localModels, setLocalModels] = useState<LocalModelInfo[]>([]);
  const [activeModelId, setActiveModelId] = useState<string>("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [modelsDir, setModelsDir] = useState("");
  const [gpuInfo, setGpuInfo] = useState<{ available: boolean; name: string; vram_mb: number; backend: string } | null>(null);
  const [gpuEnabled, setGpuEnabled] = useState(true);
  const [lastSpeed, setLastSpeed] = useState(0);

  // Custom model modal state
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [customMeta, setCustomMeta] = useState<HfModelMetadata | null>(null);
  const [customForm, setCustomForm] = useState({
    name: "",
    ctx_size: 8192,
    description: "",
    speed_tier: "medium",
    intelligence_tier: "high",
  });
  const [customError, setCustomError] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);

  const loadModels = useCallback(async () => {
    try {
      const models = await invoke<LocalModelInfo[]>('list_local_models');
      setLocalModels(models);
      const active = await invoke<string>('get_active_local_model');
      setActiveModelId(active);
      const dir = await invoke<string>('get_local_models_dir');
      setModelsDir(dir);
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  }, []);

  useEffect(() => {
    loadModels();
    invoke<{ available: boolean; name: string; vram_mb: number; backend: string }>('get_gpu_info')
      .then(setGpuInfo)
      .catch(() => {});
    invoke<boolean>('is_gpu_enabled')
      .then(setGpuEnabled)
      .catch(() => {});
    // Fetch last inference speed
    invoke<{ gpu_enabled: boolean; last_gen_speed_tps: number }>('get_model_status')
      .then((status) => {
        setLastSpeed(status.last_gen_speed_tps);
        setGpuEnabled(status.gpu_enabled);
      })
      .catch(() => {});
  }, [loadModels]);

  // Poll during local model download
  useEffect(() => {
    if (!downloadingId) return;
    const interval = setInterval(async () => {
      try {
        const progress = await invoke<number>('get_local_download_progress');
        setDownloadProgress(progress);
        if (progress >= 100) {
          setDownloadingId(null);
          setDownloadProgress(0);
          await loadModels();
        }
      } catch { /* ignore */ }
    }, 1000);
    return () => clearInterval(interval);
  }, [downloadingId, loadModels]);

  const handleDownload = async (modelId: string) => {
    try {
      setDownloadingId(modelId);
      setDownloadProgress(0);
      await invoke('download_local_model', { modelId });
      await loadModels();
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setDownloadingId(null);
      setDownloadProgress(0);
    }
  };

  const handleDelete = async (modelId: string) => {
    try {
      await invoke('delete_local_model', { modelId });
      await loadModels();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleSelectLocal = async (modelId: string) => {
    try {
      await invoke('set_active_local_model', { modelId });
      setActiveModelId(modelId);
      // Update settings store so chat pill shows correct model
      updateSettings({ localModeModel: modelId });
    } catch (error) {
      console.error('Failed to set active model:', error);
    }
  };

  const openFolder = async (path: string) => {
    try { await openPath(path); } catch (error) { console.error('Failed to open folder:', error); }
  };

  const handleGpuToggle = async () => {
    const newVal = !gpuEnabled;
    try {
      await invoke('set_gpu_enabled', { enabled: newVal });
      setGpuEnabled(newVal);
    } catch (error) {
      console.error('Failed to toggle GPU:', error);
    }
  };

  // Estimate VRAM usage for a model (65% of file size, same heuristic as Rust backend)
  const estimateVramMb = (sizeBytes: number) => Math.round((sizeBytes * 0.65) / (1024 * 1024));
  const gpuAvailableVramMb = gpuInfo ? gpuInfo.vram_mb - 512 : 0; // Reserve 512MB for OS

  const handleFetchMetadata = async () => {
    if (!customUrl.trim()) return;
    setFetchingMeta(true);
    setCustomError("");
    try {
      const meta = await invoke<HfModelMetadata>('fetch_hf_model_metadata', { url: customUrl });
      setCustomMeta(meta);
      setCustomForm({
        name: meta.name,
        ctx_size: meta.inferred_ctx_size,
        description: meta.description,
        speed_tier: "medium",
        intelligence_tier: "high",
      });
    } catch (error) {
      setCustomError(String(error));
      // Show form with defaults anyway
      setCustomMeta(null);
      setCustomForm({
        name: "",
        ctx_size: 8192,
        description: "",
        speed_tier: "medium",
        intelligence_tier: "high",
      });
    } finally {
      setFetchingMeta(false);
    }
  };

  const handleAddCustomModel = async () => {
    if (!customUrl.trim()) return;
    setAddingCustom(true);
    setCustomError("");
    try {
      await invoke<LocalModelInfo>('add_custom_model', {
        url: customUrl,
        name: customForm.name || null,
        ctxSize: customForm.ctx_size,
        description: customForm.description || null,
        speedTier: customForm.speed_tier,
        intelligenceTier: customForm.intelligence_tier,
      });
      setShowCustomModal(false);
      setCustomUrl("");
      setCustomMeta(null);
      setCustomForm({ name: "", ctx_size: 8192, description: "", speed_tier: "medium", intelligence_tier: "high" });
      await loadModels();
    } catch (error) {
      setCustomError(String(error));
    } finally {
      setAddingCustom(false);
    }
  };

  const handleRemoveCustomModel = async (modelId: string) => {
    try {
      await invoke('remove_custom_model', { id: modelId });
      await loadModels();
    } catch (error) {
      console.error('Failed to remove custom model:', error);
    }
  };

  const cloudModels = models;
  const hasAnyLocalModel = localModels.some(m => m.is_downloaded);

  return (
    <div className="space-y-6">
      {/* Cloud Models */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            Cloud Models
          </h3>
          <span className="rounded bg-[hsl(var(--primary)/0.1)] px-1.5 py-0.5 text-[11px] font-medium text-[hsl(var(--primary))]">
            Nebius AI
          </span>
        </div>
        <p className="mb-3 text-xs text-[hsl(var(--muted-foreground))]">
          Toggle which models appear in the chat selector. Requires a Nebius API key.
        </p>
        <div className="space-y-2">
          {cloudModels.map((model) => (
            <div
              key={model.id}
              className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                model.isEnabled
                  ? "border-[hsl(var(--border))] bg-[hsl(var(--card))]"
                  : "border-[hsl(var(--border))]/40 opacity-50"
              }`}
            >
              <Toggle enabled={model.isEnabled} onToggle={() => toggleModel(model.id)} />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-medium">{model.name}</span>
                  {model.isDefault && (
                    <span className="rounded bg-[hsl(var(--primary))]/10 px-1.5 py-0.5 text-[11px] font-semibold text-[hsl(var(--primary))]">
                      DEFAULT
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-[hsl(var(--muted-foreground))]">
                  <span>{model.contextWindow / 1000}K ctx</span>
                  <span>·</span>
                  <span>{SPEED_LABEL[model.speedTier] ?? model.speedTier}</span>
                  <span>·</span>
                  <span>{INTEL_LABEL[model.intelligenceTier] ?? model.intelligenceTier}</span>
                  <span>·</span>
                  <span>${model.inputCostPer1M}/1M tokens</span>
                </div>
              </div>

              {model.isEnabled && !model.isDefault && (
                <button
                  onClick={() => setDefaultModel(model.id)}
                  className="flex-shrink-0 rounded px-2 py-1 text-[11px] text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
                >
                  Set default
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Local Models */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Local Models
            </h3>
            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-medium text-emerald-600">
              Offline · Free
            </span>
            {hasAnyLocalModel && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[hsl(var(--status-safe))] text-white">
                READY
              </span>
            )}
          </div>
          {modelsDir && (
            <button
              onClick={() => openFolder(modelsDir)}
              className="text-xs text-[hsl(var(--primary))] hover:underline flex items-center gap-1 shrink-0"
            >
              <FolderIcon /> Open Folder
            </button>
          )}
        </div>
        <p className="mb-3 text-xs text-[hsl(var(--muted-foreground))]">
          Runs entirely on your machine. Download and manage local models below.
        </p>

        {/* GPU Status */}
        {gpuInfo && (
          <div className={`flex items-center gap-2 rounded-lg border p-2.5 mb-3 ${
            gpuInfo.available && gpuEnabled
              ? 'border-[hsl(var(--status-safe-border))] bg-[hsl(var(--status-safe-bg))]'
              : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'
          }`}>
            <GpuIcon available={gpuInfo.available && gpuEnabled} />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium">
                {gpuInfo.available
                  ? `GPU: ${gpuInfo.name} (${gpuInfo.vram_mb >= 1024 ? (gpuInfo.vram_mb / 1024).toFixed(0) + 'GB' : gpuInfo.vram_mb + 'MB'} VRAM) · ${gpuInfo.backend.toUpperCase()}`
                  : 'CPU Only · No compatible GPU detected'
                }
              </span>
              {lastSpeed > 0 && (
                <span className="ml-2 text-[11px] text-[hsl(var(--muted-foreground))]">
                  Last: {lastSpeed.toFixed(1)} tok/s
                </span>
              )}
            </div>
            {gpuInfo.available && (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
                  {gpuEnabled ? 'GPU On' : 'CPU Only'}
                </span>
                <Toggle enabled={gpuEnabled} onToggle={handleGpuToggle} />
              </div>
            )}
          </div>
        )}

        {!hasAnyLocalModel && (
          <div className="rounded-lg bg-[hsl(var(--status-caution-bg))] border border-[hsl(var(--status-caution-border))] p-3 mb-3">
            <p className="text-xs text-[hsl(var(--status-caution))] font-medium">
              No local model downloaded yet
            </p>
            <p className="text-xs text-[hsl(var(--status-caution))] mt-1">
              Download a model below to enable local AI. We recommend starting with the <strong>1.7B Light</strong> model (~1.1 GB) for the best balance of speed and quality.
            </p>
          </div>
        )}

        {/* Add Custom Model Button */}
        <div className="mb-3">
          <button
            onClick={() => setShowCustomModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-dashed border-[hsl(var(--border))] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] transition-colors"
          >
            <PlusIcon /> Add Custom Model (HuggingFace)
          </button>
        </div>

        <div className="space-y-2">
          {localModels.map((model) => {
            const isActive = model.id === activeModelId;
            const isDownloading = downloadingId === model.id;
            const isCustom = model.id.startsWith("custom-");

            return (
              <div
                key={model.id}
                className={`rounded-lg border p-3 transition-colors ${
                  isActive && model.is_downloaded
                    ? 'border-[hsl(var(--status-safe-border))] bg-[hsl(var(--status-safe-bg))]'
                    : model.is_downloaded
                      ? 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'
                      : 'border-[hsl(var(--border)/0.5)]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{model.name}</span>
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        {formatSize(model.size_bytes)}
                      </span>
                      {model.is_downloaded && isActive && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-[hsl(var(--status-safe))] text-white">
                          ACTIVE
                        </span>
                      )}
                      {model.is_downloaded && !isActive && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
                          DOWNLOADED
                        </span>
                      )}
                      {isCustom && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600">
                          CUSTOM
                        </span>
                      )}
                      {(model.id === 'gemma4-e4b' || (model.id === 'qwen3-1.7b' && !localModels.some(m => m.id === 'gemma4-e4b'))) && !model.is_downloaded && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]">
                          RECOMMENDED
                        </span>
                      )}
                      {gpuInfo?.available && gpuEnabled && model.size_bytes > 0 && (() => {
                        const vramNeeded = estimateVramMb(model.size_bytes);
                        if (vramNeeded > gpuAvailableVramMb) {
                          return (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600" title={`Needs ~${(vramNeeded / 1024).toFixed(1)}GB VRAM, ${(gpuAvailableVramMb / 1024).toFixed(1)}GB available`}>
                              PARTIAL GPU
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    {model.description && (
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                        {model.description}
                      </p>
                    )}
                    <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-[hsl(var(--muted-foreground))]">
                      <span>{SPEED_LABEL[model.speed_tier] ?? model.speed_tier}</span>
                      <span>&middot;</span>
                      <span>{INTEL_LABEL[model.intelligence_tier] ?? model.intelligence_tier}</span>
                      <span>&middot;</span>
                      <span>{model.ctx_size / 1000}K ctx</span>
                      <span>&middot;</span>
                      <span>Free</span>
                    </div>
                    {model.is_downloaded && model.local_path && (
                      <p className="text-[11px] text-[hsl(var(--muted-foreground)/0.6)] mt-1 font-mono truncate">
                        {model.local_path}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 flex flex-col gap-1">
                    {!model.is_downloaded && !isDownloading && (
                      <button
                        onClick={() => handleDownload(model.id)}
                        disabled={downloadingId !== null}
                        className="px-3 py-1.5 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        Download
                      </button>
                    )}
                    {model.is_downloaded && !isActive && (
                      <button
                        onClick={() => handleSelectLocal(model.id)}
                        className="px-3 py-1.5 rounded-lg bg-[hsl(var(--status-safe-bg))] text-[hsl(var(--status-safe))] text-xs font-medium hover:opacity-80 transition-colors"
                      >
                        Use This
                      </button>
                    )}
                    {model.is_downloaded && (
                      <button
                        onClick={() => handleDelete(model.id)}
                        className="px-3 py-1.5 rounded-lg bg-[hsl(var(--status-danger-bg))] text-[hsl(var(--status-danger))] text-xs font-medium hover:opacity-80 transition-colors"
                      >
                        Delete
                      </button>
                    )}
                    {isCustom && !model.is_downloaded && (
                      <button
                        onClick={() => handleRemoveCustomModel(model.id)}
                        className="px-3 py-1.5 rounded-lg bg-[hsl(var(--status-danger-bg))] text-[hsl(var(--status-danger))] text-xs font-medium hover:opacity-80 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                {/* Download Progress */}
                {isDownloading && (
                  <div className="mt-2 space-y-1">
                    <div className="w-full h-1.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[hsl(var(--status-safe))] transition-all duration-500"
                        style={{ width: `${downloadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] text-center">
                      Downloading... {downloadProgress}% of {formatSize(model.size_bytes)}
                    </p>
                  </div>
                )}
              </div>
            );
          })}

          {/* Fallback: show ollamaModels if Rust backend has not returned yet */}
          {localModels.length === 0 && ollamaModels.map((model) => (
            <div
              key={model.id}
              className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))]/40 p-3 opacity-50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-medium">{model.name}</span>
                  <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-amber-600">
                    LOADING...
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-[hsl(var(--muted-foreground))]">
                  <span>{model.contextWindow / 1000}K ctx</span>
                  <span>·</span>
                  <span>{SPEED_LABEL[model.speedTier] ?? model.speedTier}</span>
                  <span>·</span>
                  <span>{INTEL_LABEL[model.intelligenceTier] ?? model.intelligenceTier}</span>
                  <span>·</span>
                  <span>Free</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Custom Model Modal */}
        {showCustomModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCustomModal(false)}>
            <div
              className="w-full max-w-md rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h4 className="text-sm font-semibold mb-3">Add Custom Model</h4>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">
                Paste a HuggingFace GGUF model URL or repo ID (e.g., <code className="bg-[hsl(var(--muted))] px-1 rounded">ggml-org/gemma-4-E4B-it-GGUF</code>).
              </p>

              {/* URL Input */}
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://huggingface.co/owner/repo/resolve/main/model.gguf"
                  className="flex-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                  onKeyDown={(e) => e.key === 'Enter' && handleFetchMetadata()}
                />
                <button
                  onClick={handleFetchMetadata}
                  disabled={fetchingMeta || !customUrl.trim()}
                  className="shrink-0 rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-xs font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50"
                >
                  {fetchingMeta ? "Fetching..." : "Fetch"}
                </button>
              </div>

              {/* Error */}
              {customError && (
                <div className="rounded-lg bg-[hsl(var(--status-danger-bg))] border border-[hsl(var(--status-danger-border))] p-2 mb-3">
                  <p className="text-xs text-[hsl(var(--status-danger))]">{customError}</p>
                </div>
              )}

              {/* Form (shown after fetch or on error with defaults) */}
              {(customMeta || customError) && (
                <div className="space-y-2 mb-4">
                  <div>
                    <label className="block text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-1">Model Name</label>
                    <input
                      type="text"
                      value={customForm.name}
                      onChange={(e) => setCustomForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-1">Context Size</label>
                      <input
                        type="number"
                        value={customForm.ctx_size}
                        onChange={(e) => setCustomForm(f => ({ ...f, ctx_size: Number(e.target.value) }))}
                        className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-1">Speed</label>
                      <select
                        value={customForm.speed_tier}
                        onChange={(e) => setCustomForm(f => ({ ...f, speed_tier: e.target.value }))}
                        className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                      >
                        <option value="very-fast">Very Fast</option>
                        <option value="fast">Fast</option>
                        <option value="medium">Medium</option>
                        <option value="slow">Slow</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-1">Description</label>
                    <input
                      type="text"
                      value={customForm.description}
                      onChange={(e) => setCustomForm(f => ({ ...f, description: e.target.value }))}
                      className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setShowCustomModal(false); setCustomUrl(""); setCustomMeta(null); setCustomError(""); }}
                  className="rounded-lg px-3 py-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]"
                >
                  Cancel
                </button>
                {(customMeta || customError) && (
                  <button
                    onClick={handleAddCustomModel}
                    disabled={addingCustom || !customUrl.trim()}
                    className="rounded-lg bg-[hsl(var(--primary))] px-4 py-1.5 text-xs font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50"
                  >
                    {addingCustom ? "Adding..." : "Add Model"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function GpuIcon({ available }: { available: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={available ? "hsl(var(--status-safe))" : "currentColor"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" />
      <line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" />
      <line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" />
      <line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" />
      <line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}
