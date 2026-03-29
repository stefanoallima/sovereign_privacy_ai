import { useState, useEffect, useCallback } from "react";
import { useSettingsStore } from "@/stores";
import { useUserContextStore, selectActiveProfile } from "@/stores/userContext";
import { invoke } from "@tauri-apps/api/core";
import { openUrl, openPath } from "@tauri-apps/plugin-opener";

interface GlinerModelInfo {
  id: string;
  name: string;
  description: string;
  languages: string;
  size_bytes: number;
  repo: string;
  files: { remote_path: string; local_name: string; size_bytes: number }[];
  is_downloaded: boolean;
  local_path: string | null;
  source_url: string;
}

export function PrivacySettings() {
  const { settings, updateSettings, setPrivacyMode, models, ollamaModels } = useSettingsStore();
  const activeProfile = useUserContextStore(selectActiveProfile);
  const {
    addCustomRedactTerm,
    removeCustomRedactTerm,
    importCustomRedactTerms,
    clearCustomRedactTerms,
    createProfile,
  } = useUserContextStore();

  // Custom redaction UI state
  const [bulkText, setBulkText] = useState("");
  const [quickInput, setQuickInput] = useState("");
  const [importCount, setImportCount] = useState<number | null>(null);
  const [hoveredTermIdx, setHoveredTermIdx] = useState<number | null>(null);

  // Auto-create a default profile if none exists
  useEffect(() => {
    const profiles = useUserContextStore.getState().profiles;
    if (profiles.length === 0) {
      createProfile("My Profile", "Default privacy profile");
    }
  }, [createProfile]);

  const customTerms = activeProfile?.customRedactTerms || [];

  const handleBulkImport = () => {
    if (!bulkText.trim()) return;
    const count = importCustomRedactTerms(bulkText);
    setImportCount(count);
    setBulkText("");
    setTimeout(() => setImportCount(null), 3000);
  };

  const handleQuickAdd = () => {
    const commaIdx = quickInput.indexOf(",");
    if (commaIdx === -1) return;
    const label = quickInput.substring(0, commaIdx).trim();
    const value = quickInput.substring(commaIdx + 1).trim();
    if (label && value) {
      addCustomRedactTerm(label, value);
      setQuickInput("");
    }
  };

  // GLiNER state
  const [glinerModels, setGlinerModels] = useState<GlinerModelInfo[]>([]);
  const [glinerDownloadingId, setGlinerDownloadingId] = useState<string | null>(null);
  const [glinerProgress, setGlinerProgress] = useState(0);
  const [glinerModelsDir, setGlinerModelsDir] = useState<string>("");

  const loadGlinerModels = useCallback(async () => {
    try {
      const models = await invoke<GlinerModelInfo[]>('list_gliner_models');
      setGlinerModels(models);
      const dir = await invoke<string>('get_gliner_models_dir');
      setGlinerModelsDir(dir);
    } catch (error) {
      console.error('Failed to load GLiNER models:', error);
    }
  }, []);

  useEffect(() => {
    loadGlinerModels();
  }, [settings.airplaneMode, loadGlinerModels]);

  // Poll during GLiNER download
  useEffect(() => {
    if (!glinerDownloadingId) return;
    const interval = setInterval(async () => {
      try {
        const progress = await invoke<number>('get_gliner_download_progress');
        setGlinerProgress(progress);
        if (progress >= 100) {
          setGlinerDownloadingId(null);
          setGlinerProgress(0);
          await loadGlinerModels();
        }
      } catch { /* ignore */ }
    }, 1000);
    return () => clearInterval(interval);
  }, [glinerDownloadingId, loadGlinerModels]);

  const handleGlinerDownload = async (modelId: string) => {
    setGlinerDownloadingId(modelId);
    setGlinerProgress(0);
    try {
      await invoke('download_gliner_model', { modelId });
      await loadGlinerModels();
    } catch (error) {
      console.error('GLiNER download failed:', error);
    } finally {
      setGlinerDownloadingId(null);
      setGlinerProgress(0);
    }
  };

  const handleGlinerDelete = async (modelId: string) => {
    try {
      await invoke('delete_gliner_model', { modelId });
      await loadGlinerModels();
    } catch (error) {
      console.error('GLiNER delete failed:', error);
    }
  };

  const openFolder = async (path: string) => {
    try { await openPath(path); } catch (error) { console.error('Failed to open folder:', error); }
  };

  const openLink = async (url: string) => {
    try { await openUrl(url); } catch (error) { console.error('Failed to open URL:', error); }
  };

  const formatSize = (bytes: number) => {
    if (bytes >= 1_000_000_000) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    return (bytes / (1024 * 1024)).toFixed(0) + ' MB';
  };

  const [hasAnyLocalModel, setHasAnyLocalModel] = useState(false);

  // Check if any local model is downloaded (for privacy mode selector)
  useEffect(() => {
    invoke<{ id: string; is_downloaded: boolean }[]>('list_local_models')
      .then((list) => {
        setHasAnyLocalModel(list.some(m => m.is_downloaded));
      })
      .catch(() => {});
  }, []);

  const hasAnyGlinerModel = glinerModels.some(m => m.is_downloaded);

  return (
    <div className="space-y-6">
      {/* Privacy Engine — Reference to Models tab */}
      <div className="rounded-xl border-2 border-[hsl(var(--border))] overflow-hidden">
        <div className="p-4 bg-[hsl(var(--muted)/0.3)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]">
              <EngineIcon />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Privacy Engine</h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Manage local models in the <strong>Models</strong> tab.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Privacy Guard (GLiNER PII Anonymization) Section */}
      <div className="rounded-xl border-2 border-[hsl(var(--border))] overflow-hidden">
        <div className={`p-4 ${hasAnyGlinerModel ? 'bg-[hsl(var(--violet)/0.1)]' : 'bg-[hsl(var(--muted)/0.3)]'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${hasAnyGlinerModel ? 'bg-[hsl(var(--violet)/0.2)] text-[hsl(var(--violet))]' : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]'}`}>
                <ShieldIcon />
              </div>
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  Privacy Guard (PII Anonymization)
                  {hasAnyGlinerModel && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[hsl(var(--violet))] text-white">
                      ACTIVE
                    </span>
                  )}
                </h3>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Detects and redacts personal data before cloud sends
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[hsl(var(--border)/0.5)]">
          <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2">
            Models are downloaded from HuggingFace and stored locally at:
          </p>
          <div className="flex items-center gap-2 mb-4">
            <code className="text-xs font-mono bg-[hsl(var(--muted)/0.5)] px-2 py-1 rounded truncate flex-1">
              {glinerModelsDir || '...'}
            </code>
            <button
              onClick={() => openFolder(glinerModelsDir)}
              className="text-xs text-[hsl(var(--primary))] hover:underline flex items-center gap-1 shrink-0"
            >
              <FolderIcon /> Open Folder
            </button>
          </div>

          <div className="space-y-2">
            {glinerModels.map((model) => (
              <div
                key={model.id}
                className={`rounded-lg border p-3 ${
                  model.is_downloaded
                    ? 'border-[hsl(var(--violet-muted))] dark:border-[hsl(var(--violet))] bg-[hsl(var(--violet)/0.05)] dark:bg-[hsl(var(--violet)/0.1)]'
                    : 'border-[hsl(var(--border))]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{model.name}</span>
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        {formatSize(model.size_bytes)}
                      </span>
                      {model.is_downloaded && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-[hsl(var(--status-safe))] text-white">
                          READY
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                      {model.languages} &middot; {model.description}
                    </p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                      Source:{' '}
                      <a
                        href={model.source_url}
                        onClick={(e) => { e.preventDefault(); openLink(model.source_url); }}
                        className="text-[hsl(var(--primary))] hover:underline cursor-pointer"
                      >
                        {model.source_url.replace('https://', '')}
                      </a>
                    </p>
                    {model.is_downloaded && model.local_path && (
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 font-mono truncate">
                        Stored: {model.local_path}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0">
                    {!model.is_downloaded && glinerDownloadingId !== model.id && (
                      <button
                        onClick={() => handleGlinerDownload(model.id)}
                        disabled={glinerDownloadingId !== null}
                        className="px-3 py-1.5 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        Download
                      </button>
                    )}
                    {model.is_downloaded && (
                      <button
                        onClick={() => handleGlinerDelete(model.id)}
                        className="px-3 py-1.5 rounded-lg bg-[hsl(var(--status-danger-bg))] text-[hsl(var(--status-danger))] text-xs font-medium hover:opacity-80 transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {glinerDownloadingId === model.id && (
                  <div className="mt-2 space-y-1">
                    <div className="w-full h-1.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[hsl(var(--violet))] transition-all duration-500"
                        style={{ width: `${glinerProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] text-center">
                      Downloading... {glinerProgress}%
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Custom Redaction Terms Section */}
      <div className="rounded-xl border-2 border-[hsl(var(--border))] overflow-hidden">
        <div className={`p-4 ${customTerms.length > 0 ? 'bg-pink-500/10' : 'bg-[hsl(var(--muted)/0.3)]'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${customTerms.length > 0 ? 'bg-pink-500/20 text-pink-600' : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]'}`}>
                <ShieldIcon />
              </div>
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  Custom Redaction Terms
                  {customTerms.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-pink-500 text-white">
                      {customTerms.length} TERM{customTerms.length !== 1 ? 'S' : ''}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Strings to always redact before sending to cloud (names, IDs, etc.)
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[hsl(var(--border)/0.5)] space-y-4">
          {/* Format guide — always visible */}
          <div className="rounded-lg bg-[hsl(var(--muted)/0.3)] border border-[hsl(var(--border)/0.5)] p-3">
            <p className="text-xs font-semibold text-[hsl(var(--foreground))] mb-1">Format: one entry per line</p>
            <code className="text-[11px] font-mono text-[hsl(var(--muted-foreground))] leading-relaxed block">
              label,string_to_redact<br />
              <br />
              Company Name,Acme Corp<br />
              Partner BSN,123456789<br />
              Home Address,123 Main Street
            </code>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-2">
              A same-length replacement is auto-generated for each term (e.g. "Acme Corp" &rarr; "_cmpny_1_") so text structure is preserved and the original can be restored in responses.
            </p>
          </div>

          {/* Bulk paste textarea */}
          <div>
            <label className="text-xs font-semibold text-[hsl(var(--foreground))] block mb-1.5">
              Bulk Import
            </label>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-sm bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.5)] font-mono resize-y"
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleBulkImport}
                disabled={!bulkText.trim()}
                className="px-3 py-1.5 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Import All
              </button>
              {importCount !== null && (
                <span className="text-xs text-[hsl(var(--status-safe))] font-medium">
                  {importCount} term{importCount !== 1 ? 's' : ''} imported
                </span>
              )}
            </div>
          </div>

          {/* Quick add single term */}
          <div>
            <label className="text-xs font-semibold text-[hsl(var(--foreground))] block mb-1.5">
              Quick Add
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleQuickAdd(); }}
                placeholder="label,string_to_redact"
                className="flex-1 px-3 py-2 text-sm bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.5)] font-mono"
              />
              <button
                onClick={handleQuickAdd}
                disabled={!quickInput.includes(',')}
                className="px-3 py-1.5 rounded-lg bg-[hsl(var(--status-safe-bg))] text-[hsl(var(--status-safe))] text-xs font-medium hover:opacity-80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          </div>

          {/* Current terms table */}
          {customTerms.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[hsl(var(--foreground))]">
                  Active Terms ({customTerms.length})
                </span>
                <button
                  onClick={clearCustomRedactTerms}
                  className="text-xs text-[hsl(var(--status-danger))] hover:opacity-80 hover:underline"
                >
                  Clear All
                </button>
              </div>
              <div className="rounded-lg border border-[hsl(var(--border)/0.5)] overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[hsl(var(--secondary)/0.4)] text-[hsl(var(--muted-foreground))]">
                      <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider">Label</th>
                      <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider">Original</th>
                      <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider">Replacement</th>
                      <th className="w-8 px-1 py-2"></th>
                    </tr>
                  </thead>
                </table>
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-[hsl(var(--border)/0.3)]">
                      {customTerms.map((term, index) => (
                        <tr
                          key={index}
                          className="hover:bg-[hsl(var(--secondary)/0.3)] transition-colors group"
                          onMouseEnter={() => setHoveredTermIdx(index)}
                          onMouseLeave={() => setHoveredTermIdx(null)}
                        >
                          <td className="px-3 py-2 font-medium text-[hsl(var(--foreground))]">
                            {term.label}
                          </td>
                          <td className="px-3 py-2">
                            <code className="font-mono text-[hsl(var(--foreground))] bg-[hsl(var(--secondary)/0.5)] px-1.5 py-0.5 rounded">
                              {hoveredTermIdx === index ? term.value : term.value.length > 2 ? term.value.substring(0, 2) + '***' : '***'}
                            </code>
                          </td>
                          <td className="px-3 py-2">
                            <code className="font-mono text-pink-600 dark:text-pink-400 bg-pink-500/10 px-1.5 py-0.5 rounded">
                              {term.replacement || '???'}
                            </code>
                          </td>
                          <td className="px-1 py-2">
                            <button
                              onClick={() => removeCustomRedactTerm(index)}
                              className="p-1 rounded hover:bg-[hsl(var(--status-danger-bg))] text-[hsl(var(--status-danger))] opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Remove"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {customTerms.length === 0 && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-2">
              No custom redaction terms yet. Add strings above — each will get a same-length replacement for safe cloud sends.
            </p>
          )}
        </div>
      </div>

      {/* Default Privacy Mode Section */}
      <div className="rounded-xl border-2 border-[hsl(var(--border))] overflow-hidden">
        <div className="p-4 bg-[hsl(var(--muted)/0.3)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))]">
              <ShieldIcon />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Default Privacy Mode</h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Choose how your data is processed and select a default model for each mode
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[hsl(var(--border)/0.5)] space-y-3">
          {/* Local Mode Card */}
          <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
            settings.privacyMode === 'local'
              ? 'border-[hsl(var(--status-safe-border))] bg-[hsl(var(--status-safe-bg))]'
              : 'border-[hsl(var(--border)/0.5)] hover:border-[hsl(var(--border))]'
          }`}>
            <input
              type="radio"
              name="privacyMode"
              checked={settings.privacyMode === 'local'}
              onChange={() => setPrivacyMode('local')}
              disabled={!hasAnyLocalModel}
              className="mt-1"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">🔒 Local</span>
                {settings.privacyMode === 'local' && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-[hsl(var(--status-safe))] text-white">ACTIVE</span>
                )}
                {!hasAnyLocalModel && (
                  <span className="text-xs text-[hsl(var(--status-caution))]">No model downloaded</span>
                )}
              </div>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                All processing on your device. No data leaves your machine. Works offline.
              </p>
              <div className="mt-2">
                <select
                  value={settings.localModeModel}
                  onChange={(e) => updateSettings({ localModeModel: e.target.value })}
                  className="w-full text-xs rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1.5"
                >
                  {ollamaModels.filter(m => m.isEnabled).map((m) => (
                    <option key={m.id} value={m.apiModelId}>🖥️ {m.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </label>

          {/* Hybrid Mode Card */}
          <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
            settings.privacyMode === 'hybrid'
              ? 'border-[hsl(var(--primary)/0.5)] bg-[hsl(var(--primary)/0.05)]'
              : 'border-[hsl(var(--border)/0.5)] hover:border-[hsl(var(--border))]'
          }`}>
            <input
              type="radio"
              name="privacyMode"
              checked={settings.privacyMode === 'hybrid'}
              onChange={() => setPrivacyMode('hybrid')}
              className="mt-1"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">🛡️ Hybrid</span>
                {settings.privacyMode === 'hybrid' && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">ACTIVE</span>
                )}
              </div>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                PII is redacted locally by the Privacy Guard, then the sanitized prompt is sent to a cloud LLM. Best balance of privacy and quality.
              </p>
              <div className="mt-2">
                <select
                  value={settings.hybridModeModel}
                  onChange={(e) => updateSettings({ hybridModeModel: e.target.value })}
                  className="w-full text-xs rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1.5"
                >
                  {models.filter(m => m.isEnabled).map((m) => (
                    <option key={m.id} value={m.id}>☁️ {m.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </label>

          {/* Cloud Mode Card */}
          <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
            settings.privacyMode === 'cloud'
              ? 'border-[hsl(var(--status-caution-border))] bg-[hsl(var(--status-caution-bg))]'
              : 'border-[hsl(var(--border)/0.5)] hover:border-[hsl(var(--border))]'
          }`}>
            <input
              type="radio"
              name="privacyMode"
              checked={settings.privacyMode === 'cloud'}
              onChange={() => setPrivacyMode('cloud')}
              className="mt-1"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">⚡ Cloud</span>
                {settings.privacyMode === 'cloud' && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-[hsl(var(--status-caution))] text-white">ACTIVE</span>
                )}
              </div>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                Direct to cloud API. Fastest responses, best model quality. Custom redaction terms still apply.
              </p>
              <div className="mt-2">
                <select
                  value={settings.cloudModeModel}
                  onChange={(e) => updateSettings({ cloudModeModel: e.target.value })}
                  className="w-full text-xs rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1.5"
                >
                  {models.filter(m => m.isEnabled).map((m) => (
                    <option key={m.id} value={m.id}>☁️ {m.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Other Privacy Settings */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ShieldIcon />
          Other Privacy Settings
        </h3>

        <div className="flex items-center justify-between py-2">
          <div>
            <div className="font-medium text-sm">Encrypt Local Data</div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">
              Encrypt conversations and PII stored on your device
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.encryptLocalData}
            onChange={(e) =>
              useSettingsStore.getState().updateSettings({ encryptLocalData: e.target.checked })
            }
            className="h-4 w-4 rounded"
          />
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <div className="font-medium text-sm">Save Audio Recordings</div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">
              Keep voice recordings after transcription
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.saveAudioRecordings}
            onChange={(e) =>
              useSettingsStore.getState().updateSettings({ saveAudioRecordings: e.target.checked })
            }
            className="h-4 w-4 rounded"
          />
        </div>
      </div>
    </div>
  );
}

function EngineIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[hsl(var(--primary))]"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
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
