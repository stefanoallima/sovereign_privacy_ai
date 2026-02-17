/**
 * Persona Advanced Tab
 *
 * Advanced settings including backend routing, local model selection,
 * and detailed configuration options.
 */

import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Server,
  Cpu,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import type { Persona } from '@/types';
import {
  checkOllamaAvailability,
  getAvailableOllamaModels,
} from '@/services/backend-routing-service';

interface PersonaAdvancedTabProps {
  persona: Persona;
  onChange: (updates: Partial<Persona>) => void;
}

export const PersonaAdvancedTab: React.FC<PersonaAdvancedTabProps> = ({
  persona,
  onChange,
}) => {
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check Ollama status on mount and when refreshed
  const checkOllama = async () => {
    setIsRefreshing(true);
    try {
      const available = await checkOllamaAvailability();
      setOllamaStatus(available ? 'available' : 'unavailable');

      if (available) {
        const models = await getAvailableOllamaModels();
        setOllamaModels(models);
      } else {
        setOllamaModels([]);
      }
    } catch (error) {
      console.error('Failed to check Ollama:', error);
      setOllamaStatus('unavailable');
      setOllamaModels([]);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    checkOllama();
  }, []);

  const requiresOllama =
    persona.preferred_backend === 'ollama' ||
    (persona.preferred_backend === 'hybrid' && persona.enable_local_anonymizer);

  return (
    <div className="space-y-6">
      {/* Ollama Status */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] uppercase tracking-wider flex items-center gap-2">
            <Server size={16} className="text-[hsl(var(--primary))]" />
            Local AI Service (Built-in)
          </h3>
          <button
            onClick={checkOllama}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))] rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div
          className={`flex items-center gap-3 p-4 rounded-xl border ${
            ollamaStatus === 'available'
              ? 'border-green-500/30 bg-green-500/5'
              : ollamaStatus === 'unavailable'
              ? 'border-amber-500/30 bg-amber-500/5'
              : 'border-[hsl(var(--border))] bg-[hsl(var(--secondary)/0.2)]'
          }`}
        >
          {ollamaStatus === 'checking' ? (
            <>
              <RefreshCw size={18} className="animate-spin text-[hsl(var(--muted-foreground))]" />
              <span className="text-sm text-[hsl(var(--muted-foreground))]">
                Checking local model status...
              </span>
            </>
          ) : ollamaStatus === 'available' ? (
            <>
              <CheckCircle2 size={18} className="text-green-600" />
              <div className="flex-1">
                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                  Local model ready
                </span>
                <span className="text-xs text-green-600/70 ml-2">
                  {ollamaModels.length} models available
                </span>
              </div>
            </>
          ) : (
            <>
              <AlertCircle size={18} className="text-amber-600" />
              <div className="flex-1">
                <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  Local model not available
                </span>
                {requiresOllama && (
                  <p className="text-xs text-amber-600/80 mt-1">
                    Required for selected privacy mode. Download the privacy engine in Settings.
                  </p>
                )}
              </div>
              <span
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-amber-500/10 text-amber-700 rounded-lg"
              >
                Download in Settings
              </span>
            </>
          )}
        </div>
      </section>

      {/* Local Model Selection */}
      {(persona.preferred_backend === 'ollama' ||
        persona.preferred_backend === 'hybrid') && (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] uppercase tracking-wider flex items-center gap-2">
            <Cpu size={16} className="text-[hsl(var(--primary))]" />
            Local Model
          </h3>

          <div>
            <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1.5">
              Local Model
            </label>
            <select
              value={persona.local_ollama_model || ''}
              onChange={(e) =>
                onChange({ local_ollama_model: e.target.value || undefined })
              }
              disabled={ollamaStatus !== 'available'}
              className="w-full px-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Select a model...</option>
              {ollamaModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
            {ollamaStatus === 'available' && ollamaModels.length === 0 && (
              <p className="mt-2 text-xs text-amber-600">
                No models found. Run `ollama pull mistral:7b-instruct-q5_K_M` to download a model.
              </p>
            )}
          </div>

          {/* Recommended Models */}
          <div className="p-3 bg-[hsl(var(--secondary)/0.2)] rounded-lg">
            <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-2">
              Recommended models for local processing:
            </p>
            <ul className="text-xs text-[hsl(var(--muted-foreground))] space-y-1">
              <li>
                <code className="bg-[hsl(var(--secondary))] px-1 rounded">
                  mistral:7b-instruct-q5_K_M
                </code>
                {' - '}Fast, good quality (~5GB)
              </li>
              <li>
                <code className="bg-[hsl(var(--secondary))] px-1 rounded">
                  llama3.1:8b
                </code>
                {' - '}Good balance (~4.7GB)
              </li>
              <li>
                <code className="bg-[hsl(var(--secondary))] px-1 rounded">
                  qwen2:7b
                </code>
                {' - '}Multilingual support (~4.4GB)
              </li>
            </ul>
          </div>
        </section>
      )}

      {/* Advanced Configuration */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] uppercase tracking-wider flex items-center gap-2">
          <Sliders size={16} className="text-[hsl(var(--primary))]" />
          Advanced Configuration
        </h3>

        <div className="space-y-4">
          {/* Enable Local Anonymizer Toggle */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={persona.enable_local_anonymizer || false}
              onChange={(e) =>
                onChange({ enable_local_anonymizer: e.target.checked })
              }
              className="mt-1"
            />
            <div>
              <span className="font-medium text-sm text-[hsl(var(--foreground))]">
                Enable Local Anonymizer
              </span>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Extract and anonymize PII locally before sending to cloud services.
                Requires the local privacy engine.
              </p>
            </div>
          </label>

          {/* Requires PII Vault Toggle */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={persona.requiresPIIVault || false}
              onChange={(e) =>
                onChange({ requiresPIIVault: e.target.checked })
              }
              className="mt-1"
            />
            <div>
              <span className="font-medium text-sm text-[hsl(var(--foreground))]">
                Requires PII Vault
              </span>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Enable the Privacy Vault tab for storing personal information
                used in template re-hydration. Useful for tax, financial, or
                legal personas.
              </p>
            </div>
          </label>
        </div>
      </section>

      {/* Configuration Summary */}
      <section className="p-4 bg-[hsl(var(--secondary)/0.2)] rounded-xl border border-[hsl(var(--border))]">
        <h4 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-3">
          Configuration Summary
        </h4>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-[hsl(var(--muted-foreground))]">Backend:</dt>
            <dd className="font-medium capitalize">
              {persona.preferred_backend || 'nebius'}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[hsl(var(--muted-foreground))]">Anonymization:</dt>
            <dd className="font-medium">
              {persona.enable_local_anonymizer ? 'Enabled' : 'Disabled'}
              {persona.enable_local_anonymizer &&
                ` (${persona.anonymization_mode || 'none'})`}
            </dd>
          </div>
          {persona.local_ollama_model && (
            <div className="flex justify-between">
              <dt className="text-[hsl(var(--muted-foreground))]">Local Model:</dt>
              <dd className="font-mono text-xs">{persona.local_ollama_model}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-[hsl(var(--muted-foreground))]">PII Vault:</dt>
            <dd className="font-medium">
              {persona.requiresPIIVault ? 'Enabled' : 'Disabled'}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
};

export default PersonaAdvancedTab;
