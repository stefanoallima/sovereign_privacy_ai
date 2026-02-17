import { useState, useEffect, useCallback } from "react";
import { useSettingsStore } from "@/stores";
import { invoke } from "@tauri-apps/api/core";

interface ModelStatus {
  is_downloaded: boolean;
  is_loaded: boolean;
  download_progress: number;
  model_name: string;
  model_size_bytes: number;
}

export function PrivacySettings() {
  const { settings, toggleAirplaneMode } = useSettingsStore();
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [statusChecking, setStatusChecking] = useState(true);

  const checkModelStatus = useCallback(async () => {
    setStatusChecking(true);
    try {
      const status = await invoke<ModelStatus>('get_model_status');
      setModelStatus(status);
    } catch (error) {
      console.error('Failed to get model status:', error);
    } finally {
      setStatusChecking(false);
    }
  }, []);

  // Check model status on mount and when airplane mode changes
  useEffect(() => {
    checkModelStatus();
  }, [settings.airplaneMode, checkModelStatus]);

  // Poll during download
  useEffect(() => {
    if (!isDownloading) return;
    const interval = setInterval(async () => {
      try {
        const status = await invoke<ModelStatus>('get_model_status');
        setModelStatus(status);
        if (status.is_downloaded) {
          setIsDownloading(false);
        }
      } catch {
        // ignore polling errors
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isDownloading]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await invoke('download_default_model');
      await checkModelStatus();
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const isModelReady = modelStatus?.is_downloaded ?? false;
  const formatSize = (bytes: number) => {
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  return (
    <div className="space-y-6">
      {/* Privacy Engine Section */}
      <div className="rounded-xl border-2 border-[hsl(var(--border))] overflow-hidden">
        <div className={`p-4 ${isModelReady ? 'bg-green-500/10' : 'bg-[hsl(var(--muted)/0.3)]'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isModelReady ? 'bg-green-500/20 text-green-600' : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]'}`}>
                <EngineIcon />
              </div>
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  Privacy Engine
                  {isModelReady && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500 text-white">
                      READY
                    </span>
                  )}
                </h3>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Built-in local AI for privacy-first processing
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[hsl(var(--border)/0.5)]">
          {/* Model Status */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Model Status:
            </span>
            {statusChecking && (
              <span className="text-xs text-yellow-600 flex items-center gap-1">
                <span className="animate-spin">&#x23F3;</span> Checking...
              </span>
            )}
            {!statusChecking && isModelReady && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Downloaded
                {modelStatus?.is_loaded && ' & Loaded'}
              </span>
            )}
            {!statusChecking && !isModelReady && !isDownloading && (
              <span className="text-xs text-amber-600 flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Not downloaded
              </span>
            )}
            {isDownloading && (
              <span className="text-xs text-blue-600 flex items-center gap-1">
                <span className="animate-spin">&#x23F3;</span>
                Downloading... {modelStatus?.download_progress ?? 0}%
              </span>
            )}
            <button
              onClick={checkModelStatus}
              className="text-xs text-[hsl(var(--primary))] hover:underline ml-2"
            >
              Refresh
            </button>
          </div>

          {/* Download Button / Progress */}
          {!isModelReady && !isDownloading && (
            <button
              onClick={handleDownload}
              className="w-full py-3 px-4 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium text-sm hover:opacity-90 transition-opacity"
            >
              Download Privacy Engine (~{modelStatus ? formatSize(modelStatus.model_size_bytes) : '5.0 GB'})
            </button>
          )}

          {isDownloading && modelStatus && (
            <div className="space-y-2">
              <div className="w-full h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${modelStatus.download_progress}%` }}
                />
              </div>
              <p className="text-xs text-[hsl(var(--muted-foreground))] text-center">
                {modelStatus.download_progress}% of {formatSize(modelStatus.model_size_bytes)}
              </p>
            </div>
          )}

          {isModelReady && modelStatus && (
            <div className="text-xs text-[hsl(var(--muted-foreground))] space-y-1">
              <p>Model: <span className="font-mono">{modelStatus.model_name}</span></p>
              <p>Size: {formatSize(modelStatus.model_size_bytes)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Airplane Mode Section */}
      <div className="rounded-xl border-2 border-[hsl(var(--border))] overflow-hidden">
        <div className={`p-4 ${settings.airplaneMode ? 'bg-blue-500/10' : 'bg-[hsl(var(--muted)/0.3)]'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${settings.airplaneMode ? 'bg-blue-500/20 text-blue-600' : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]'}`}>
                <AirplaneIcon />
              </div>
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  Airplane Mode
                  {settings.airplaneMode && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500 text-white">
                      ACTIVE
                    </span>
                  )}
                </h3>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Force all processing to stay on your machine
                </p>
              </div>
            </div>
            <button
              onClick={toggleAirplaneMode}
              disabled={!isModelReady}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.airplaneMode
                  ? 'bg-blue-500'
                  : 'bg-[hsl(var(--muted))]'
              } ${!isModelReady ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  settings.airplaneMode ? 'translate-x-6' : ''
                }`}
              />
            </button>
          </div>
        </div>

        {/* Benefits Info */}
        <div className="p-4 border-t border-[hsl(var(--border)/0.5)] bg-[hsl(var(--muted)/0.2)]">
          {!isModelReady && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 mb-4">
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                Privacy engine not downloaded
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                Download the privacy engine above to enable Airplane Mode.
              </p>
            </div>
          )}

          <h4 className="text-xs font-semibold text-[hsl(var(--foreground))] mb-2">
            When Airplane Mode is active:
          </h4>
          <ul className="space-y-1.5">
            <li className="text-xs text-[hsl(var(--muted-foreground))] flex items-start gap-2">
              <span className="text-green-500 mt-0.5">&#x2713;</span>
              No data leaves your machine
            </li>
            <li className="text-xs text-[hsl(var(--muted-foreground))] flex items-start gap-2">
              <span className="text-green-500 mt-0.5">&#x2713;</span>
              Works without internet connection
            </li>
            <li className="text-xs text-[hsl(var(--muted-foreground))] flex items-start gap-2">
              <span className="text-green-500 mt-0.5">&#x2713;</span>
              Maximum privacy for sensitive conversations
            </li>
            <li className="text-xs text-[hsl(var(--muted-foreground))] flex items-start gap-2">
              <span className="text-yellow-500 mt-0.5">&#x26A0;</span>
              Responses may be slower than cloud models
            </li>
          </ul>
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

function AirplaneIcon() {
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
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
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
