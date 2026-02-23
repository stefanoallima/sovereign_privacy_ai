import { useState } from "react";
import { useSettingsStore } from "@/stores";

export function ApiSettings() {
  const { settings, updateSettings } = useSettingsStore();
  const [apiKey, setApiKey] = useState(settings.nebiusApiKey);
  const [endpoint, setEndpoint] = useState(settings.nebiusApiEndpoint);
  const [mem0ApiKey, setMem0ApiKey] = useState(settings.mem0ApiKey);
  const [isValidating, setIsValidating] = useState(false);
  const [isValidatingMem0, setIsValidatingMem0] = useState(false);
  const [validationResult, setValidationResult] = useState<"valid" | "invalid" | null>(null);
  const [mem0ValidationResult, setMem0ValidationResult] = useState<"valid" | "invalid" | null>(null);

  const handleSaveEndpoint = () => {
    updateSettings({ nebiusApiEndpoint: endpoint.trim().replace(/\/+$/, '') });
  };

  const handleSaveApiKey = async () => {
    updateSettings({ nebiusApiKey: apiKey });
    setIsValidating(true);
    setValidationResult(null);

    try {
      const response = await fetch(`${settings.nebiusApiEndpoint}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      setValidationResult(response.ok ? "valid" : "invalid");
    } catch {
      setValidationResult("invalid");
    } finally {
      setIsValidating(false);
    }
  };

  const handleSaveMem0ApiKey = async () => {
    updateSettings({ mem0ApiKey: mem0ApiKey });
    setIsValidatingMem0(true);
    setMem0ValidationResult(null);

    try {
      const response = await fetch("https://api.mem0.ai/v1/memories/?user_id=test&limit=1", {
        headers: { Authorization: `Token ${mem0ApiKey}` },
      });
      setMem0ValidationResult(response.ok ? "valid" : "invalid");
    } catch {
      setMem0ValidationResult("invalid");
    } finally {
      setIsValidatingMem0(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="mb-2 block text-sm font-medium">
          Nebius API Key
        </label>
        <div className="flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your Nebius API key"
            className="flex-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2 text-sm focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          />
          <button
            onClick={handleSaveApiKey}
            disabled={isValidating}
            className="rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-sm text-[hsl(var(--primary-foreground))] disabled:opacity-50"
          >
            {isValidating ? "Validating..." : "Save"}
          </button>
        </div>
        {validationResult && (
          <p
            className={`mt-2 text-sm ${
              validationResult === "valid"
                ? "text-green-500"
                : "text-red-500"
            }`}
          >
            {validationResult === "valid"
              ? "✓ API key is valid"
              : "✗ Invalid API key"}
          </p>
        )}
        <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
          Get your API key from{" "}
          <a
            href="https://studio.nebius.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[hsl(var(--primary))] hover:underline"
          >
            Nebius AI Studio
          </a>
        </p>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">
          API Endpoint
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveEndpoint()}
            placeholder="https://api.studio.nebius.ai/v1"
            className="flex-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2 text-sm focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          />
          <button
            onClick={handleSaveEndpoint}
            className="rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-sm text-[hsl(var(--primary-foreground))]"
          >
            Save
          </button>
        </div>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          Saved: <span className="font-mono">{settings.nebiusApiEndpoint}</span>
        </p>
      </div>

      {/* Cloud Trust */}
      <div className="border-t border-[hsl(var(--border))] pt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-sm">Trust cloud provider</div>
            <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              Send messages directly without per-message privacy review
            </div>
          </div>
          <button
            role="switch"
            aria-checked={settings.skipCloudReview}
            onClick={() => updateSettings({ skipCloudReview: !settings.skipCloudReview })}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
              settings.skipCloudReview ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--border))]'
            }`}
          >
            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
              settings.skipCloudReview ? 'translate-x-4' : 'translate-x-0.5'
            }`} />
          </button>
        </div>
      </div>

      {/* Memory Configuration */}
      <div className="border-t border-[hsl(var(--border))] pt-6">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <BrainIcon />
          Memory (mem0)
        </h3>

        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-medium text-sm">Enable Memory</div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">
              Remember facts about you across conversations
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.enableMemory}
            onChange={(e) =>
              updateSettings({ enableMemory: e.target.checked })
            }
            className="h-4 w-4 rounded"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            mem0 API Key
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={mem0ApiKey}
              onChange={(e) => setMem0ApiKey(e.target.value)}
              placeholder="Enter your mem0 API key"
              className="flex-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2 text-sm focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
            <button
              onClick={handleSaveMem0ApiKey}
              disabled={isValidatingMem0}
              className="rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-sm text-[hsl(var(--primary-foreground))] disabled:opacity-50"
            >
              {isValidatingMem0 ? "Validating..." : "Save"}
            </button>
          </div>
          {mem0ValidationResult && (
            <p
              className={`mt-2 text-sm ${
                mem0ValidationResult === "valid"
                  ? "text-green-500"
                  : "text-red-500"
              }`}
            >
              {mem0ValidationResult === "valid"
                ? "✓ API key is valid"
                : "✗ Invalid API key"}
            </p>
          )}
          <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
            Get your API key from{" "}
            <a
              href="https://app.mem0.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[hsl(var(--primary))] hover:underline"
            >
              mem0 Dashboard
            </a>
          </p>
        </div>

        <div className="mt-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] p-4">
          <div className="flex items-start gap-3">
            <BrainIcon />
            <div className="flex-1">
              <div className="font-medium text-sm">How Memory Works</div>
              <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                When enabled, the assistant learns facts about you from conversations
                (preferences, habits, important dates) and uses this knowledge to provide
                more personalized responses.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BrainIcon() {
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
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
      <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
      <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
    </svg>
  );
}
