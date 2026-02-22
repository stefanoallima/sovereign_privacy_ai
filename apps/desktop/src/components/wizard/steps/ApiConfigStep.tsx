import { useState } from "react";
import { useWizardStore } from "@/stores/wizard";
import { useWizardAI } from "../useWizardAI";
import {
  Key,
  CheckCircle,
  ExternalLink,
  SkipForward,
  AlertTriangle,
  Globe,
  AlertOctagon,
  Server,
  CircleDot,
} from "lucide-react";

function openExternal(url: string) {
  import("@tauri-apps/plugin-opener")
    .then(({ openUrl }) => openUrl(url))
    .catch(() => window.open(url, "_blank"));
}

// TODO: Replace with actual website URLs once published
const WEBSITE_TUTORIAL_URL = "https://ailocalmind.com/docs/nebius-setup";
const WEBSITE_ZERO_RETENTION_URL = "https://ailocalmind.com/docs/zero-data-retention";

export function ApiConfigStep() {
  const { updateChoices, nextStep, choices } = useWizardStore();
  const { generateCommentary } = useWizardAI();
  const [apiKey, setApiKey] = useState(choices.apiKeyValue);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<"valid" | "invalid" | null>(
    choices.apiKeyConfigured ? "valid" : null
  );

  const handleValidate = async () => {
    if (!apiKey.trim()) return;
    setIsValidating(true);
    setValidationResult(null);

    try {
      const trimmedKey = apiKey.trim();
      if (trimmedKey.length < 10) {
        setValidationResult("invalid");
        return;
      }

      const response = await fetch("https://api.studio.nebius.ai/v1/models", {
        headers: { Authorization: `Bearer ${trimmedKey}` },
      });

      if (response.ok || response.status === 200) {
        setValidationResult("valid");
        updateChoices({ apiKeyConfigured: true, apiKeyValue: trimmedKey });
        await generateCommentary(
          "The user configured their Nebius inference token. Strongly remind them to enable zero data retention in their Nebius account settings — without it, prompts may be stored. Keep it to 2 sentences.",
          "Your inference token is configured and working. Important reminder: make sure you have enabled zero data retention in your Nebius account settings — without it, your prompts and AI responses may be stored on Nebius servers according to their standard data policy."
        );
      } else {
        setValidationResult("invalid");
      }
    } catch {
      setValidationResult("valid");
      updateChoices({ apiKeyConfigured: true, apiKeyValue: apiKey.trim() });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSkip = async () => {
    await generateCommentary(
      "The user skipped cloud AI API setup. Reassure them they can add it later in Settings and that local models work without any cloud connection.",
      "No problem at all! You can always add a cloud AI provider later in the Settings panel. Your local models work entirely on your device without any internet connection — you'll still be able to chat and get AI assistance offline."
    );
    nextStep();
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Choose Your AI Inference Provider</h2>
        <p className="text-[hsl(var(--muted-foreground))]">
          {choices.privacyMode === "balanced"
            ? "Connect to a cloud AI provider for smarter responses. Your personal data is anonymized locally before anything is sent."
            : "Connect to a cloud AI provider for the fastest, most capable AI responses."}
        </p>
      </div>

      {/* ============================================================ */}
      {/* NEBIUS RECOMMENDATION */}
      {/* ============================================================ */}
      <div className="rounded-2xl border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.03)] p-5 mb-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)] px-2 py-0.5 rounded-full">
            Recommended
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            Privacy-safe AI inference
          </span>
        </div>
        <h3 className="font-semibold text-lg mb-2">Nebius AI</h3>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
          We recommend <strong>Nebius</strong> as your cloud inference provider because it is based in Europe, offers
          zero data retention, and aligns with our privacy-first philosophy.
        </p>

        {/* ── Zero Data Retention — ACTION REQUIRED warning inside Nebius card ── */}
        <div className="rounded-xl border-2 border-amber-500/50 bg-amber-500/5 p-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <AlertOctagon className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-bold text-amber-600 dark:text-amber-400">Zero Data Retention</p>
                <span className="text-[9px] font-bold uppercase tracking-widest text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded">
                  Action Required
                </span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                  Not enabled by default
                </span>
              </div>
              <p className="text-xs text-[hsl(var(--foreground))] mb-2">
                Zero data retention is available on Nebius but is <strong>not enabled by default</strong>. You can
                enable it in your Nebius account settings to ensure your prompts are discarded after processing.
                Without it, your prompts and AI responses <strong>may be stored</strong> on Nebius servers according to their standard policy.
              </p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">
                When enabled, your data is processed and <strong>immediately discarded</strong> — never stored, never
                logged, never used for training.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => openExternal(WEBSITE_ZERO_RETENTION_URL)}
                  className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  How to enable zero data retention (our guide)
                </button>
                <span className="text-[hsl(var(--border))]">|</span>
                <button
                  type="button"
                  onClick={() => openExternal("https://docs.nebius.com/studio/inference/api-key#data-logging")}
                  className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Nebius data logging documentation
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center mt-0.5">
              <Globe className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-medium">European Infrastructure</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Nebius operates from Europe with GDPR-level data protection standards.
              </p>
            </div>
          </div>
        </div>

        {/* Nebius products */}
        <div className="rounded-xl bg-[hsl(var(--background)/0.5)] p-4 mb-4">
          <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2">
            Which Nebius product should I use?
          </p>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <CircleDot className="h-4 w-4 text-[hsl(var(--primary))] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                <strong className="text-[hsl(var(--foreground))]">Nebius Inference Factory</strong> — Recommended for
                personal and non-corporate use. Optimized for cost-effective inference at scale.
                Supports zero data retention.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <CircleDot className="h-4 w-4 text-[hsl(var(--muted-foreground)/0.5)] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                <strong className="text-[hsl(var(--foreground))]">Nebius AI Studio</strong> — Full-featured platform
                for teams and enterprise use with additional tooling.
                Supports zero data retention.
              </p>
            </div>
          </div>
        </div>

        {/* Step-by-step setup guide */}
        <div className="rounded-xl border border-[hsl(var(--border)/0.3)] p-4 mb-4">
          <p className="text-sm font-semibold mb-3">Getting started with Nebius</p>
          <ol className="space-y-2">
            <li className="flex items-start gap-2.5">
              <span className="flex-shrink-0 h-5 w-5 rounded-full bg-[hsl(var(--primary))] text-white text-[10px] font-bold flex items-center justify-center mt-0.5">1</span>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Create a free account at <button type="button" onClick={() => openExternal("https://studio.nebius.ai/")} className="text-[hsl(var(--primary))] hover:underline font-medium">studio.nebius.ai</button>
              </p>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex-shrink-0 h-5 w-5 rounded-full bg-[hsl(var(--primary))] text-white text-[10px] font-bold flex items-center justify-center mt-0.5">2</span>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Go to your <strong>API Keys</strong> section and create a new inference token
              </p>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex-shrink-0 h-5 w-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">3</span>
              <p className="text-xs text-[hsl(var(--foreground))] font-medium">
                Enable <strong>zero data retention</strong> in your account or API key settings — this is critical for privacy
              </p>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex-shrink-0 h-5 w-5 rounded-full bg-[hsl(var(--primary))] text-white text-[10px] font-bold flex items-center justify-center mt-0.5">4</span>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Paste your inference token below
              </p>
            </li>
          </ol>
          <button
            type="button"
            onClick={() => openExternal(WEBSITE_TUTORIAL_URL)}
            className="flex items-center gap-1.5 mt-3 text-xs font-medium text-[hsl(var(--primary))] hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Full step-by-step tutorial on our website
          </button>
        </div>

        {/* Links */}
        <div className="flex flex-wrap gap-x-3 gap-y-2 pt-3 border-t border-[hsl(var(--border)/0.3)]">
          <button
            type="button"
            onClick={() => openExternal("https://studio.nebius.ai/")}
            className="flex items-center gap-1.5 text-xs text-[hsl(var(--primary))] hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Nebius AI Studio
          </button>
          <span className="text-[hsl(var(--border))]">|</span>
          <button
            type="button"
            onClick={() => openExternal("https://nebius.com/blog/posts/nebius-ai-studio")}
            className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            What is Nebius?
          </button>
          <span className="text-[hsl(var(--border))]">|</span>
          <button
            type="button"
            onClick={() => openExternal("https://nebius.com/legal/terms-of-service")}
            className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Nebius Terms & Conditions
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* OTHER PROVIDERS */}
      {/* ============================================================ */}
      <div className="rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))] p-4 mb-5">
        <div className="flex items-start gap-3">
          <Server className="h-5 w-5 text-[hsl(var(--muted-foreground))] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium mb-1">Other OpenAI-compatible providers</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              This app works with any OpenAI-compatible API endpoint. If you choose a different
              provider, we recommend reviewing their data usage policies, privacy terms,
              and retention settings so you can make an informed decision about how your data is handled.
              You can change the API endpoint later in Settings.
            </p>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* TOKEN INPUT */}
      {/* ============================================================ */}
      <div className="rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))] p-5 mb-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-[hsl(var(--secondary))] flex items-center justify-center">
            <Key className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
          </div>
          <div>
            <h3 className="font-semibold">Paste Your Inference Token</h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Your token is stored locally on your device and never shared with anyone
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setValidationResult(null);
            }}
            placeholder="Paste your inference token here..."
            className="w-full rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--background)/0.5)] px-4 py-3 text-sm placeholder:text-[hsl(var(--muted-foreground)/0.5)] focus:outline-none focus:border-[hsl(var(--ring)/0.5)] transition-all"
          />

          {validationResult === "valid" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-500 text-sm">
                <CheckCircle className="h-4 w-4" />
                <span>Token validated successfully</span>
              </div>
              {/* Repeat the zero retention warning post-validation */}
              <div className="rounded-xl border-2 border-amber-500/40 bg-amber-500/5 p-4">
                <div className="flex items-start gap-3">
                  <AlertOctagon className="h-6 w-6 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-amber-600 dark:text-amber-400 mb-1">
                      Have you enabled zero data retention?
                    </p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      Without zero data retention enabled in your Nebius account, your prompts <strong>may be stored</strong> by
                      Nebius according to their standard policy. You can enable it in your Nebius account settings.
                    </p>
                    <button
                      type="button"
                      onClick={() => openExternal(WEBSITE_ZERO_RETENTION_URL)}
                      className="flex items-center gap-1.5 mt-2 text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      See our step-by-step guide
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {validationResult === "invalid" && (
            <div className="flex items-center gap-2 text-red-500 text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>Invalid token. Please check and try again.</span>
            </div>
          )}

          <button
            onClick={handleValidate}
            disabled={!apiKey.trim() || isValidating}
            className="w-full py-3 rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isValidating ? "Validating..." : "Validate Token"}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSkip}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] transition-colors"
        >
          <SkipForward className="h-4 w-4" />
          Skip for now
        </button>
        <button
          onClick={() => nextStep()}
          disabled={!choices.apiKeyConfigured}
          className="flex-1 py-3 rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
