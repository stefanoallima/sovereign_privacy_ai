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
        <h3 className="text-lg font-semibold text-gray-900">LLM Backend Configuration</h3>
        <p className="mt-1 text-sm text-gray-600">
          Choose where your requests are processed and how PII is handled
        </p>
      </div>

      {/* Privacy Badge */}
      <div className="flex items-center gap-3 rounded-lg bg-blue-50 p-3 border border-blue-200">
        <span className="text-2xl">{privacyBadge.emoji}</span>
        <div>
          <div className="font-medium text-blue-900 capitalize">{privacyBadge.level} Privacy</div>
          <div className="text-sm text-blue-700">{privacyBadge.description}</div>
        </div>
      </div>

      {/* Backend Selection */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">Backend Service</label>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BACKEND_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleBackendChange(option.value)}
              className={`relative rounded-lg border-2 p-4 text-left transition-all ${
                config.preferred_backend === option.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="font-medium text-gray-900">{option.label}</div>
              <div className="mt-1 text-sm text-gray-600">{option.description}</div>
              <div className="mt-2 flex gap-3 text-xs">
                <div>
                  <span className="font-medium text-gray-700">Privacy:</span>{' '}
                  <span className="text-gray-600">{option.privacy}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Speed:</span>{' '}
                  <span className="text-gray-600">{option.speed}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Anonymization Settings */}
      {config.preferred_backend !== 'nebius' && (
        <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="enable-anonymizer"
              checked={config.enable_local_anonymizer}
              onChange={handleAnonymizationToggle}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <div className="flex-1">
              <label htmlFor="enable-anonymizer" className="font-medium text-gray-900">
                Enable Local Anonymization
              </label>
              <p className="mt-1 text-sm text-gray-600">
                Extract and anonymize PII locally before sending requests to the cloud
              </p>
              {!ollamaAvailable && config.enable_local_anonymizer && (
                <div className="mt-2 rounded-lg bg-yellow-50 border border-yellow-200 p-2 text-sm text-yellow-800">
                  ⚠️ Ollama service is not running. This option requires Ollama to be started.
                </div>
              )}
            </div>
          </div>

          {config.enable_local_anonymizer && (
            <div className="space-y-3 border-t border-gray-200 pt-4">
              {/* Anonymization Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Anonymization Mode
                </label>
                <div className="space-y-2">
                  {(['none', 'optional', 'required'] as AnonymizationMode[]).map((mode) => (
                    <label
                      key={mode}
                      className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-100 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="anonymization-mode"
                        value={mode}
                        checked={config.anonymization_mode === mode}
                        onChange={() => handleAnonymizationModeChange(mode)}
                        className="mt-1 h-4 w-4 text-blue-600"
                      />
                      <div>
                        <div className="font-medium text-gray-900">
                          {ANONYMIZATION_MODE_INFO[mode].label}
                        </div>
                        <div className="text-sm text-gray-600">
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
                  <label htmlFor="ollama-model" className="block text-sm font-medium text-gray-700 mb-2">
                    Local Model
                  </label>
                  <select
                    id="ollama-model"
                    value={config.local_ollama_model || ''}
                    onChange={(e) => handleModelChange(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select a model...</option>
                    {ollamaModels.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                  {!ollamaAvailable && (
                    <p className="mt-2 text-sm text-yellow-700">
                      Models are unavailable - Ollama service is not running
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
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <h4 className="font-medium text-red-900">Configuration Issues</h4>
          <ul className="mt-2 space-y-1 text-sm text-red-700">
            {validation.errors.map((error, i) => (
              <li key={i}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {validation.warnings.length > 0 && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
          <h4 className="font-medium text-yellow-900">Warnings</h4>
          <ul className="mt-2 space-y-1 text-sm text-yellow-700">
            {validation.warnings.map((warning, i) => (
              <li key={i}>⚠️ {warning}</li>
            ))}
          </ul>
        </div>
      )}

      {validation.is_valid && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          ✓ Configuration is valid and ready to use
        </div>
      )}

      {/* Summary */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h4 className="font-medium text-gray-900 mb-2">Configuration Summary</h4>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="font-medium text-gray-600">Backend:</dt>
            <dd className="text-gray-900 capitalize">{config.preferred_backend}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-gray-600">Anonymization:</dt>
            <dd className="text-gray-900">
              {config.enable_local_anonymizer ? 'Enabled' : 'Disabled'} ({config.anonymization_mode})
            </dd>
          </div>
          {config.local_ollama_model && (
            <div className="flex justify-between">
              <dt className="font-medium text-gray-600">Model:</dt>
              <dd className="text-gray-900 font-mono text-xs">{config.local_ollama_model}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
};

export default PersonaLLMConfigEditor;
