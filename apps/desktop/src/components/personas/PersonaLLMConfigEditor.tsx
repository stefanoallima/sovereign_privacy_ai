/**
 * Persona LLM Configuration Editor
 * Allows users to configure backend selection and anonymization for each persona
 */

import React, { useState, useEffect } from 'react';
import {
  PreferredBackend,
  AnonymizationMode,
  PersonaLLMConfig,
  BackendConfigValidation,
  BACKEND_OPTIONS,
  ANONYMIZATION_MODE_INFO,
  BACKEND_PRIVACY_INFO,
  validatePersonaBackendConfig,
  checkOllamaAvailability,
  getAvailableOllamaModels,
} from '@/services/backend-routing-service';

interface PersonaLLMConfigEditorProps {
  /** Initial configuration */
  initialConfig?: PersonaLLMConfig;
  /** Callback when configuration changes */
  onConfigChange: (config: PersonaLLMConfig) => void;
  /** Callback when validation completes */
  onValidationChange?: (validation: BackendConfigValidation) => void;
  /** Whether to show advanced options */
  showAdvanced?: boolean;
  /** Custom CSS classes */
  className?: string;
}

export const PersonaLLMConfigEditor: React.FC<PersonaLLMConfigEditorProps> = ({
  initialConfig,
  onConfigChange,
  onValidationChange,
  className = '',
}) => {
  // State
  const [config, setConfig] = useState<PersonaLLMConfig>(
    initialConfig || {
      enable_local_anonymizer: false,
      preferred_backend: 'nebius',
      anonymization_mode: 'none',
    }
  );

  const [ollamaAvailable, setOllamaAvailable] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [validation, setValidation] = useState<BackendConfigValidation>({
    is_valid: true,
    errors: [],
    warnings: [],
  });
  const [, setLoading] = useState(false);

  // Check Ollama availability on mount
  useEffect(() => {
    checkOllamaAvailability()
      .then((available) => {
        setOllamaAvailable(available);
        if (available) {
          return getAvailableOllamaModels();
        }
        return [];
      })
      .then((models) => {
        setOllamaModels(models);
      })
      .catch((error) => {
        console.error('Failed to check Ollama availability:', error);
      });
  }, []);

  // Validate configuration whenever it changes
  useEffect(() => {
    const validateConfig = async () => {
      setLoading(true);
      try {
        const result = await validatePersonaBackendConfig(
          config.preferred_backend,
          config.enable_local_anonymizer,
          config.anonymization_mode,
          config.local_ollama_model
        );
        setValidation(result);
        onValidationChange?.(result);
      } catch (error) {
        console.error('Validation error:', error);
        setValidation({
          is_valid: false,
          errors: [`Validation error: ${error}`],
          warnings: [],
        });
      } finally {
        setLoading(false);
      }
    };

    validateConfig();
  }, [config, onValidationChange]);

  // Notify parent of changes
  useEffect(() => {
    onConfigChange(config);
  }, [config, onConfigChange]);

  // Handlers
  const handleBackendChange = (backend: PreferredBackend) => {
    const newConfig = { ...config, preferred_backend: backend };

    // Auto-enable anonymization for Ollama backend
    if (backend === 'ollama' && !newConfig.enable_local_anonymizer) {
      newConfig.enable_local_anonymizer = true;
    }

    setConfig(newConfig);
  };

  const handleAnonymizationToggle = () => {
    setConfig({
      ...config,
      enable_local_anonymizer: !config.enable_local_anonymizer,
    });
  };

  const handleAnonymizationModeChange = (mode: AnonymizationMode) => {
    setConfig({
      ...config,
      anonymization_mode: mode,
    });
  };

  const handleModelChange = (model: string) => {
    setConfig({
      ...config,
      local_ollama_model: model,
    });
  };

  const getPrivacyBadge = () => {
    const privacy = BACKEND_PRIVACY_INFO[config.preferred_backend];
    return {
      emoji: privacy.emoji,
      level: privacy.level,
      description: privacy.description,
    };
  };

  const privacyBadge = getPrivacyBadge();

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">LLM Backend Configuration</h3>
        <p className="mt-1 text-sm text-[hsl(var(--foreground-muted))]">
          Choose where your requests are processed and how PII is handled
        </p>
      </div>

      {/* Privacy Badge */}
      <div className="flex items-center gap-3 rounded-lg bg-[hsl(var(--primary)/0.05)] p-3 border border-[hsl(var(--primary)/0.2)]">
        <span className="text-2xl">{privacyBadge.emoji}</span>
        <div>
          <div className="font-medium text-[hsl(var(--primary))] capitalize">{privacyBadge.level} Privacy</div>
          <div className="text-sm text-[hsl(var(--primary))]">{privacyBadge.description}</div>
        </div>
      </div>

      {/* Backend Selection */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-[hsl(var(--foreground-muted))]">Backend Service</label>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BACKEND_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleBackendChange(option.value)}
              className={`relative rounded-lg border-2 p-4 text-left transition-all ${
                config.preferred_backend === option.value
                  ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)]'
                  : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--border)/0.8)]'
              }`}
            >
              <div className="font-medium text-[hsl(var(--foreground))]">{option.label}</div>
              <div className="mt-1 text-sm text-[hsl(var(--foreground-muted))]">{option.description}</div>
              <div className="mt-2 flex gap-3 text-xs">
                <div>
                  <span className="font-medium text-[hsl(var(--foreground-muted))]">Privacy:</span>{' '}
                  <span className="text-[hsl(var(--foreground-muted))]">{option.privacy}</span>
                </div>
                <div>
                  <span className="font-medium text-[hsl(var(--foreground-muted))]">Speed:</span>{' '}
                  <span className="text-[hsl(var(--foreground-muted))]">{option.speed}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Anonymization Settings */}
      {config.preferred_backend !== 'nebius' && (
        <div className="space-y-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/0.5)] p-4">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="enable-anonymizer"
              checked={config.enable_local_anonymizer}
              onChange={handleAnonymizationToggle}
              className="mt-1 h-4 w-4 rounded border-[hsl(var(--border))] text-[hsl(var(--primary))]"
            />
            <div className="flex-1">
              <label htmlFor="enable-anonymizer" className="font-medium text-[hsl(var(--foreground))]">
                Enable Local Anonymization
              </label>
              <p className="mt-1 text-sm text-[hsl(var(--foreground-muted))]">
                Extract and anonymize PII locally before sending requests to the cloud
              </p>
              {!ollamaAvailable && config.enable_local_anonymizer && (
                <div className="mt-2 rounded-lg bg-[hsl(var(--status-caution-bg))] border border-[hsl(var(--status-caution-border))] p-2 text-sm text-[hsl(var(--status-caution))]">
                  Local model is not downloaded. Download the privacy engine in Settings to enable this option.
                </div>
              )}
            </div>
          </div>

          {config.enable_local_anonymizer && (
            <div className="space-y-3 border-t border-[hsl(var(--border))] pt-4">
              {/* Anonymization Mode */}
              <div>
                <label className="block text-sm font-medium text-[hsl(var(--foreground-muted))] mb-3">
                  Anonymization Mode
                </label>
                <div className="space-y-2">
                  {(['none', 'optional', 'required'] as AnonymizationMode[]).map((mode) => (
                    <label
                      key={mode}
                      className="flex items-start gap-3 p-3 rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))] cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="anonymization-mode"
                        value={mode}
                        checked={config.anonymization_mode === mode}
                        onChange={() => handleAnonymizationModeChange(mode)}
                        className="mt-1 h-4 w-4 text-[hsl(var(--primary))]"
                      />
                      <div>
                        <div className="font-medium text-[hsl(var(--foreground))]">
                          {ANONYMIZATION_MODE_INFO[mode].label}
                        </div>
                        <div className="text-sm text-[hsl(var(--foreground-muted))]">
                          {ANONYMIZATION_MODE_INFO[mode].description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Ollama Model Selection */}
              {(config.preferred_backend === 'ollama' || config.preferred_backend === 'hybrid') && (
                <div>
                  <label htmlFor="ollama-model" className="block text-sm font-medium text-[hsl(var(--foreground-muted))] mb-2">
                    Local Model
                  </label>
                  <select
                    id="ollama-model"
                    value={config.local_ollama_model || ''}
                    onChange={(e) => handleModelChange(e.target.value)}
                    className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-[hsl(var(--foreground))] focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                  >
                    <option value="">Select a model...</option>
                    {ollamaModels.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                  {!ollamaAvailable && (
                    <p className="mt-2 text-sm text-[hsl(var(--status-caution))]">
                      Local model not downloaded yet
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Validation Feedback */}
      {!validation.is_valid && (
        <div className="rounded-lg bg-[hsl(var(--status-danger-bg))] border border-[hsl(var(--status-danger-border))] p-4">
          <h4 className="font-medium text-[hsl(var(--status-danger))]">Configuration Issues</h4>
          <ul className="mt-2 space-y-1 text-sm text-[hsl(var(--status-danger))]">
            {validation.errors.map((error, i) => (
              <li key={i}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {validation.warnings.length > 0 && (
        <div className="rounded-lg bg-[hsl(var(--status-caution-bg))] border border-[hsl(var(--status-caution-border))] p-4">
          <h4 className="font-medium text-[hsl(var(--status-caution))]">Warnings</h4>
          <ul className="mt-2 space-y-1 text-sm text-[hsl(var(--status-caution))]">
            {validation.warnings.map((warning, i) => (
              <li key={i}>⚠️ {warning}</li>
            ))}
          </ul>
        </div>
      )}

      {validation.is_valid && (
        <div className="rounded-lg bg-[hsl(var(--status-safe-bg))] border border-[hsl(var(--status-safe-border))] p-3 text-sm text-[hsl(var(--status-safe))]">
          ✓ Configuration is valid and ready to use
        </div>
      )}

      {/* Summary */}
      <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/0.5)] p-4">
        <h4 className="font-medium text-[hsl(var(--foreground))] mb-2">Configuration Summary</h4>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="font-medium text-[hsl(var(--foreground-muted))]">Backend:</dt>
            <dd className="text-[hsl(var(--foreground))] capitalize">{config.preferred_backend}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-[hsl(var(--foreground-muted))]">Anonymization:</dt>
            <dd className="text-[hsl(var(--foreground))]">
              {config.enable_local_anonymizer ? 'Enabled' : 'Disabled'} ({config.anonymization_mode})
            </dd>
          </div>
          {config.local_ollama_model && (
            <div className="flex justify-between">
              <dt className="font-medium text-[hsl(var(--foreground-muted))]">Model:</dt>
              <dd className="text-[hsl(var(--foreground))] font-mono text-xs">{config.local_ollama_model}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
};

export default PersonaLLMConfigEditor;
