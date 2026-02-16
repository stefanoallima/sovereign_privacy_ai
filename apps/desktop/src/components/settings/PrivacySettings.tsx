import { useState, useEffect } from "react";
import { useSettingsStore } from "@/stores";
import { invoke } from "@tauri-apps/api/core";

export function PrivacySettings() {
  const { settings, toggleAirplaneMode, setAirplaneModeModel } = useSettingsStore();
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'running' | 'offline'>('checking');
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  // Check Ollama status on mount and when airplane mode changes
  useEffect(() => {
    checkOllamaStatus();
  }, [settings.airplaneMode]);

  const checkOllamaStatus = async () => {
    setOllamaStatus('checking');
    try {
      const isAvailable = await invoke<boolean>('ollama_is_available');
      setOllamaStatus(isAvailable ? 'running' : 'offline');

      if (isAvailable) {
        // Fetch available models
        try {
          const models = await invoke<string[]>('get_available_ollama_models');
          setAvailableModels(models);
        } catch {
          // If we can't get models, use defaults
          setAvailableModels(['mistral:7b-instruct-q5_K_M', 'llama3.2:3b', 'llama3.1:8b']);
        }
      }
    } catch {
      setOllamaStatus('offline');
    }
  };

  return (
    <div className="space-y-6">
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
              disabled={ollamaStatus === 'offline'}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.airplaneMode
                  ? 'bg-blue-500'
                  : 'bg-[hsl(var(--muted))]'
              } ${ollamaStatus === 'offline' ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  settings.airplaneMode ? 'translate-x-6' : ''
                }`}
              />
            </button>
          </div>
        </div>

        {/* Airplane Mode Details */}
        <div className="p-4 border-t border-[hsl(var(--border)/0.5)]">
          {/* Ollama Status */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Ollama Status:
            </span>
            {ollamaStatus === 'checking' && (
              <span className="text-xs text-yellow-600 flex items-center gap-1">
                <span className="animate-spin">⏳</span> Checking...
              </span>
            )}
            {ollamaStatus === 'running' && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Running
              </span>
            )}
            {ollamaStatus === 'offline' && (
              <span className="text-xs text-red-600 flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                Offline
              </span>
            )}
            <button
              onClick={checkOllamaStatus}
              className="text-xs text-[hsl(var(--primary))] hover:underline ml-2"
            >
              Refresh
            </button>
          </div>

          {ollamaStatus === 'offline' && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 mb-4">
              <p className="text-xs text-red-700 dark:text-red-400 font-medium">
                Ollama is not running
              </p>
              <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                Start Ollama with: <code className="px-1 py-0.5 rounded bg-red-100 dark:bg-red-900/50">ollama serve</code>
              </p>
            </div>
          )}

          {/* Model Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-[hsl(var(--foreground))]">
              Local Model
            </label>
            <select
              value={settings.airplaneModeModel}
              onChange={(e) => setAirplaneModeModel(e.target.value)}
              disabled={ollamaStatus !== 'running'}
              className="w-full text-sm px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))] disabled:opacity-50"
            >
              {availableModels.length > 0 ? (
                availableModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))
              ) : (
                <>
                  <option value="mistral:7b-instruct-q5_K_M">mistral:7b-instruct-q5_K_M (Recommended)</option>
                  <option value="llama3.2:3b">llama3.2:3b (Fast)</option>
                  <option value="llama3.1:8b">llama3.1:8b (Balanced)</option>
                  <option value="llama3.1:70b">llama3.1:70b (Powerful)</option>
                </>
              )}
            </select>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Pull models with: <code className="px-1 py-0.5 rounded bg-[hsl(var(--muted))]">ollama pull model-name</code>
            </p>
          </div>
        </div>

        {/* Benefits Info */}
        <div className="p-4 border-t border-[hsl(var(--border)/0.5)] bg-[hsl(var(--muted)/0.2)]">
          <h4 className="text-xs font-semibold text-[hsl(var(--foreground))] mb-2">
            When Airplane Mode is active:
          </h4>
          <ul className="space-y-1.5">
            <li className="text-xs text-[hsl(var(--muted-foreground))] flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              No data leaves your machine
            </li>
            <li className="text-xs text-[hsl(var(--muted-foreground))] flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              Works without internet connection
            </li>
            <li className="text-xs text-[hsl(var(--muted-foreground))] flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              Maximum privacy for sensitive conversations
            </li>
            <li className="text-xs text-[hsl(var(--muted-foreground))] flex items-start gap-2">
              <span className="text-yellow-500 mt-0.5">⚠</span>
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
