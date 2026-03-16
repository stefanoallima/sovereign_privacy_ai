import { useState } from "react";
import { Shield, X, Check, ChevronDown, ChevronUp } from "lucide-react";
import { usePiiVaultStore } from "@/stores/piiVault";

export interface DetectedPiiEntity {
  text: string;
  label: string;
  confidence: number;
}

interface PiiConfirmationPanelProps {
  entities: DetectedPiiEntity[];
  onDismiss: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  "person name": "Name",
  "phone number": "Phone",
  "email address": "Email",
  "physical address": "Address",
  "bank account": "Bank Account",
  "social security number": "SSN",
  "date of birth": "Date of Birth",
  "passport number": "Passport",
  "credit card number": "Credit Card",
  "tax identification number": "Tax ID",
  "income amount": "Income",
  "salary": "Salary",
  "medical condition": "Medical Info",
};

export function PiiConfirmationPanel({ entities, onDismiss }: PiiConfirmationPanelProps) {
  const { addEntry, hasEntry } = usePiiVaultStore();
  const [expanded, setExpanded] = useState(true);
  const [confirmed, setConfirmed] = useState<Set<number>>(new Set());
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  if (entities.length === 0) return null;

  const handleConfirm = (index: number, entity: DetectedPiiEntity) => {
    addEntry(entity.text, entity.label);
    setConfirmed((prev) => new Set([...prev, index]));
  };

  const handleDismissItem = (index: number) => {
    setDismissed((prev) => new Set([...prev, index]));
  };

  const visibleEntities = entities.filter((_, i) => !dismissed.has(i));
  const allHandled = entities.every((_, i) => confirmed.has(i) || dismissed.has(i));

  if (allHandled) {
    return (
      <div className="rounded-xl border border-[hsl(var(--status-safe-border))] bg-[hsl(var(--status-safe-bg))] p-3 flex items-center gap-3 text-sm">
        <Check className="h-4 w-4 text-[hsl(var(--status-safe))] flex-shrink-0" />
        <span className="text-[hsl(var(--status-safe))] flex-1">
          {confirmed.size > 0
            ? `${confirmed.size} item${confirmed.size > 1 ? "s" : ""} saved to your PII Vault — auto-protected in future messages.`
            : "Dismissed."}
        </span>
        <button onClick={onDismiss} className="text-[hsl(var(--status-safe))] hover:opacity-80 flex-shrink-0">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[hsl(var(--status-caution-border))] bg-[hsl(var(--status-caution-bg))] overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none"
        onClick={() => setExpanded((e) => !e)}
      >
        <Shield className="h-4 w-4 text-[hsl(var(--status-caution))] flex-shrink-0" />
        <span className="text-sm font-medium text-[hsl(var(--status-caution))] flex-1">
          Privacy Shield detected {visibleEntities.length} personal detail{visibleEntities.length !== 1 ? "s" : ""} — save to vault?
        </span>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-[hsl(var(--status-caution))] flex-shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-[hsl(var(--status-caution))] flex-shrink-0" />
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          className="text-[hsl(var(--status-caution))] hover:opacity-80 flex-shrink-0"
          title="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <p className="text-xs text-[hsl(var(--status-caution))] mb-2">
            Items added to your Vault will be automatically replaced with safe placeholders in future messages:
          </p>
          {entities.map((entity, i) => {
            if (dismissed.has(i)) return null;
            const isConfirmed = confirmed.has(i);
            const alreadyInVault = hasEntry(entity.text);
            const label = CATEGORY_LABELS[entity.label] ?? entity.label;

            return (
              <div
                key={i}
                className={`flex items-center gap-2 rounded-lg p-2 text-sm transition-colors ${
                  isConfirmed
                    ? "bg-[hsl(var(--status-safe-bg))]"
                    : "bg-[hsl(var(--card)/0.6)]"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <span className="font-medium truncate block text-[hsl(var(--foreground))]">
                    {entity.text}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[hsl(var(--status-caution))]">{label}</span>
                    {alreadyInVault && (
                      <span className="text-xs text-[hsl(var(--status-safe))]">· Already in vault</span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-[hsl(var(--status-caution))] tabular-nums flex-shrink-0">
                  {Math.round(entity.confidence * 100)}%
                </span>
                {!isConfirmed && !alreadyInVault && (
                  <>
                    <button
                      onClick={() => handleConfirm(i, entity)}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-[hsl(var(--status-caution))] text-white hover:opacity-90 transition-colors flex-shrink-0"
                      title="Save to vault"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => handleDismissItem(i)}
                      className="text-[hsl(var(--status-caution))] hover:opacity-80 flex-shrink-0"
                      title="Skip"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </>
                )}
                {(isConfirmed || alreadyInVault) && (
                  <Check className="h-4 w-4 text-[hsl(var(--status-safe))] flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
