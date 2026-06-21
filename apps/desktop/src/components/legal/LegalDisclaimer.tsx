import { useSettingsStore } from "@/stores";
import { IS_NORMATTIVA, BRAND, type Brand } from "@/config/branding";
import { BRAND_DEFAULTS } from "@/config/defaults";

export function LegalDisclaimer() {
  const { settings, updateSettings } = useSettingsStore();

  if (!IS_NORMATTIVA) return null;
  if (settings.legalDisclaimerAcknowledged) return null;

  const defaults = BRAND_DEFAULTS[BRAND as Brand];
  const text = defaults.legalDisclaimerText;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-[hsl(var(--foreground)/0.2)]">
      <div className="relative w-full max-w-lg rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-lg">
        <h2 className="text-lg font-bold mb-4">Avviso Legale · Legal Disclaimer</h2>

        <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed mb-6">
          {text}
        </p>

        <button
          onClick={() => updateSettings({ legalDisclaimerAcknowledged: true })}
          className="w-full rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
        >
          Ho capito · I Understand
        </button>
      </div>
    </div>
  );
}
