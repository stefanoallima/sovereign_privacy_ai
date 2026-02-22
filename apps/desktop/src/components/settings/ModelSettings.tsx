import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "@/stores";

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

export function ModelSettings() {
  const { models, ollamaModels, setDefaultModel, toggleModel } = useSettingsStore();
  const [downloadedModelIds, setDownloadedModelIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Check which local models are actually downloaded
    invoke<{ id: string; is_downloaded: boolean }[]>("list_local_models")
      .then((list) => {
        const downloaded = new Set(
          list.filter((m) => m.is_downloaded).map((m) => `local-${m.id}`)
        );
        setDownloadedModelIds(downloaded);
      })
      .catch(() => {});
  }, []);

  const cloudModels = models;

  return (
    <div className="space-y-6">
      {/* Cloud Models — Nebius AI */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            Cloud Models
          </h3>
          <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-500">
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
                    <span className="rounded bg-[hsl(var(--primary))]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[hsl(var(--primary))]">
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

      {/* Local Models — Privacy Engine */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            Local Models
          </h3>
          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
            Offline · Free
          </span>
        </div>
        <p className="mb-3 text-xs text-[hsl(var(--muted-foreground))]">
          Runs entirely on your machine. Download models in the <strong>Privacy &amp; Local</strong> tab.
        </p>

        <div className="space-y-2">
          {ollamaModels.map((model) => {
            const isDownloaded = downloadedModelIds.has(model.id);
            return (
              <div
                key={model.id}
                className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                  isDownloaded
                    ? "border-[hsl(var(--border))] bg-[hsl(var(--card))]"
                    : "border-[hsl(var(--border))]/40 opacity-50"
                }`}
              >
                <span className="flex-shrink-0 text-lg">
                  {isDownloaded ? "✅" : "⬇️"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium">{model.name}</span>
                    {isDownloaded && (
                      <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">
                        READY
                      </span>
                    )}
                    {!isDownloaded && (
                      <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">
                        NOT DOWNLOADED
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
                    <span>Free</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {downloadedModelIds.size === 0 && (
          <p className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))]">
            Go to <strong>Privacy &amp; Local</strong> tab to download a local model.
          </p>
        )}
      </section>
    </div>
  );
}
