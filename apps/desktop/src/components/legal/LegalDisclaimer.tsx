import { useEffect, useRef } from "react";
import { useSettingsStore } from "@/stores";
import { IS_NORMATTIVA, BRAND } from "@/config/branding";
import { BRAND_DEFAULTS } from "@/config/defaults";

export function LegalDisclaimer() {
  const { settings, updateSettings } = useSettingsStore();
  const dialogRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  if (!IS_NORMATTIVA) return null;
  if (settings.legalDisclaimerAcknowledged) return null;

  const defaults = BRAND_DEFAULTS[BRAND];
  const text = defaults.legalDisclaimerText;
  if (!text) return null;

  // Focus management: move focus into the dialog on mount, trap Tab/Shift+Tab
  // within the dialog, and restore focus to the previously-focused element on
  // unmount. Without this, screen-reader users land on the chat behind the
  // modal, and keyboard users can Tab onto the chat input underneath.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    buttonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-disclaimer-title"
      className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-[hsl(var(--foreground)/0.2)]"
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-lg rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-lg"
      >
        <h2 id="legal-disclaimer-title" className="text-lg font-bold mb-4">
          Avviso Legale · Legal Disclaimer
        </h2>

        <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed mb-6">
          {text}
        </p>

        <button
          ref={buttonRef}
          onClick={() => updateSettings({ legalDisclaimerAcknowledged: true })}
          className="w-full rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
        >
          Ho capito · I Understand
        </button>
      </div>
    </div>
  );
}
