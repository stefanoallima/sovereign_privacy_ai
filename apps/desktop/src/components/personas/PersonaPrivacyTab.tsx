/**
 * Persona Privacy Tab
 *
 * Privacy settings and PII Vault for personas that require it.
 * The PII Vault is shown for personas like Tax Advisor that need to store
 * sensitive user information locally.
 */

import React from 'react';
import {
  Shield,
  Lock,
  Cloud,
  Server,
  AlertTriangle,
  Info,
  CheckCircle2,
} from 'lucide-react';
import type { Persona } from '@/types';
import { PIIProfileEditor } from '@/components/privacy/PIIProfileEditor';

interface PersonaPrivacyTabProps {
  persona: Persona;
  onChange: (updates: Partial<Persona>) => void;
  showPIIVault: boolean;
}

// Privacy mode descriptions
const PRIVACY_MODES = [
  {
    id: 'nebius',
    label: 'Cloud (Nebius)',
    icon: <Cloud size={16} />,
    description: 'Direct cloud API - fastest response, standard privacy',
    privacy: 'Standard',
    color: 'amber',
  },
  {
    id: 'hybrid',
    label: 'Hybrid',
    icon: <Server size={16} />,
    description: 'Local anonymization before cloud - balanced privacy/speed',
    privacy: 'High',
    color: 'blue',
  },
  {
    id: 'ollama',
    label: 'Local (Built-in)',
    icon: <Lock size={16} />,
    description: 'Fully local processing - maximum privacy, built-in engine',
    privacy: 'Maximum',
    color: 'green',
  },
] as const;

export const PersonaPrivacyTab: React.FC<PersonaPrivacyTabProps> = ({
  persona,
  onChange,
  showPIIVault,
}) => {
  const currentBackend = persona.preferred_backend || 'nebius';

  return (
    <div className="space-y-6">
      {/* Privacy Mode Selection */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] uppercase tracking-wider flex items-center gap-2">
          <Shield size={16} className="text-[hsl(var(--primary))]" />
          Privacy Mode
        </h3>

        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Choose how your messages are processed for this persona.
        </p>

        <div className="grid gap-3">
          {PRIVACY_MODES.map((mode) => {
            const isSelected = currentBackend === mode.id;
            const colorClasses = {
              amber: 'border-[hsl(var(--status-caution-border))] bg-[hsl(var(--status-caution-bg))]',
              blue: 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)]',
              green: 'border-[hsl(var(--status-safe-border))] bg-[hsl(var(--status-safe-bg))]',
            };

            return (
              <button
                key={mode.id}
                onClick={() => {
                  onChange({
                    preferred_backend: mode.id as 'nebius' | 'ollama' | 'hybrid',
                    // Auto-enable anonymizer for hybrid/ollama
                    enable_local_anonymizer: mode.id !== 'nebius',
                  });
                }}
                className={`flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                  isSelected
                    ? colorClasses[mode.color]
                    : 'border-[hsl(var(--border))] hover:border-[hsl(var(--border)/0.8)] hover:bg-[hsl(var(--secondary)/0.2)]'
                }`}
              >
                <div
                  className={`p-2 rounded-lg ${
                    isSelected
                      ? mode.color === 'green'
                        ? 'bg-[hsl(var(--status-safe-bg))] text-[hsl(var(--status-safe))]'
                        : mode.color === 'blue'
                        ? 'bg-[hsl(var(--primary)/0.2)] text-[hsl(var(--primary))]'
                        : 'bg-[hsl(var(--status-caution-bg))] text-[hsl(var(--status-caution))]'
                      : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]'
                  }`}
                >
                  {mode.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[hsl(var(--foreground))]">
                      {mode.label}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        mode.color === 'green'
                          ? 'bg-[hsl(var(--status-safe-bg))] text-[hsl(var(--status-safe))]'
                          : mode.color === 'blue'
                          ? 'bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]'
                          : 'bg-[hsl(var(--status-caution-bg))] text-[hsl(var(--status-caution))]'
                      }`}
                    >
                      {mode.privacy} Privacy
                    </span>
                  </div>
                  <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                    {mode.description}
                  </p>
                </div>
                {isSelected && (
                  <CheckCircle2
                    size={20}
                    className={
                      mode.color === 'green'
                        ? 'text-[hsl(var(--status-safe))]'
                        : mode.color === 'blue'
                        ? 'text-[hsl(var(--primary))]'
                        : 'text-[hsl(var(--status-caution))]'
                    }
                  />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Anonymization Settings - shown for hybrid mode */}
      {currentBackend === 'hybrid' && (
        <section className="space-y-4 p-4 bg-[hsl(var(--secondary)/0.2)] rounded-xl border border-[hsl(var(--border))]">
          <h4 className="text-sm font-semibold text-[hsl(var(--foreground))] flex items-center gap-2">
            <Lock size={14} />
            Anonymization Settings
          </h4>

          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="anonymization_mode"
                checked={persona.anonymization_mode === 'optional'}
                onChange={() => onChange({ anonymization_mode: 'optional' })}
                className="mt-1"
              />
              <div>
                <span className="font-medium text-sm">Optional</span>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Anonymize if possible, continue without if it fails
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="anonymization_mode"
                checked={persona.anonymization_mode === 'required'}
                onChange={() => onChange({ anonymization_mode: 'required' })}
                className="mt-1"
              />
              <div>
                <span className="font-medium text-sm">Required</span>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Block requests if anonymization fails (recommended for sensitive data)
                </p>
              </div>
            </label>
          </div>
        </section>
      )}

      {/* Privacy Shield Info */}
      <section className="p-4 bg-[hsl(var(--status-safe-bg))] border border-[hsl(var(--status-safe-border))] rounded-xl">
        <div className="flex items-start gap-3">
          <Info size={18} className="text-[hsl(var(--status-safe))] mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-[hsl(var(--status-safe))]">
              Privacy Shield Active
            </p>
            <p className="text-[hsl(var(--status-safe))] mt-1">
              {currentBackend === 'ollama'
                ? 'All processing happens on your device. No data leaves your computer.'
                : currentBackend === 'hybrid'
                ? 'Personal information is anonymized locally before sending to cloud. Your BSN, exact income, and address never leave your device.'
                : 'Standard cloud processing. For sensitive data, consider using Hybrid or Local mode.'}
            </p>
          </div>
        </div>
      </section>

      {/* PII Vault Section - only shown for personas that require it */}
      {showPIIVault && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] uppercase tracking-wider flex items-center gap-2">
              <Shield size={16} className="text-[hsl(var(--status-safe))]" />
              PII Vault
            </h3>
            <span className="text-xs bg-[hsl(var(--status-safe-bg))] text-[hsl(var(--status-safe))] px-2 py-1 rounded-full">
              Local & Encrypted
            </span>
          </div>

          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Store your personal information securely. This data is used for template
            re-hydration and never sent to cloud services.
          </p>

          {/* Embedded PII Profile Editor */}
          <div className="border border-[hsl(var(--border))] rounded-xl overflow-hidden">
            <PIIProfileEditor compact />
          </div>
        </section>
      )}

      {/* Warning for non-vault personas */}
      {!showPIIVault && (
        <section className="p-4 bg-[hsl(var(--secondary)/0.3)] rounded-xl border border-[hsl(var(--border))]">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-[hsl(var(--muted-foreground))] mt-0.5 shrink-0" />
            <div className="text-sm text-[hsl(var(--muted-foreground))]">
              <p className="font-medium">No PII Vault Required</p>
              <p className="mt-1">
                This persona doesn't require storing personal information.
                To access the PII Vault, use the Tax Advisor persona.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default PersonaPrivacyTab;
