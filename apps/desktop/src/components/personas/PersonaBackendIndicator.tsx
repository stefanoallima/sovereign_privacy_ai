/**
 * Persona Backend Indicator
 * Shows privacy level indicator for a persona with backend configuration
 * Used in persona selectors, lists, and chat headers
 */

import React from 'react';
import {
  PreferredBackend,
  BACKEND_PRIVACY_INFO,
} from '@/services/backend-routing-service';

interface PersonaBackendIndicatorProps {
  /** Backend type */
  backend: PreferredBackend;
  /** Show text label in addition to emoji */
  showLabel?: boolean;
  /** Show tooltip on hover */
  showTooltip?: boolean;
  /** Custom CSS classes */
  className?: string;
}

export const PersonaBackendIndicator: React.FC<PersonaBackendIndicatorProps> = ({
  backend,
  showLabel = false,
  showTooltip = true,
  className = '',
}) => {
  const privacy = BACKEND_PRIVACY_INFO[backend];

  const content = (
    <div
      className={`inline-flex items-center gap-2 ${className}`}
      title={showTooltip ? privacy.description : undefined}
    >
      <span className="text-lg">{privacy.emoji}</span>
      {showLabel && (
        <span className="text-sm font-medium capitalize text-gray-700">
          {backend === 'ollama' ? 'Local' : backend === 'hybrid' ? 'Hybrid' : 'Cloud'}
        </span>
      )}
    </div>
  );

  if (!showTooltip) {
    return content;
  }

  return (
    <div className="group relative inline-block">
      {content}
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1 text-sm text-white group-hover:block z-10">
        {privacy.description}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
      </div>
    </div>
  );
};

interface PersonaBackendBadgeProps {
  /** Backend type */
  backend: PreferredBackend;
  /** Whether anonymization is enabled */
  anonymizationEnabled?: boolean;
  /** Custom CSS classes */
  className?: string;
}

/**
 * Privacy badge for detailed display
 * Shows emoji, backend name, and privacy level
 */
export const PersonaBackendBadge: React.FC<PersonaBackendBadgeProps> = ({
  backend,
  anonymizationEnabled = false,
  className = '',
}) => {
  const privacy = BACKEND_PRIVACY_INFO[backend];

  const getBackgroundColor = () => {
    switch (privacy.level) {
      case 'high':
        return 'bg-green-100 border-green-200 text-green-900';
      case 'medium':
        return 'bg-blue-100 border-blue-200 text-blue-900';
      case 'low':
        return 'bg-yellow-100 border-yellow-200 text-yellow-900';
    }
  };

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${getBackgroundColor()} ${className}`}
    >
      <span>{privacy.emoji}</span>
      <span className="capitalize">{backend}</span>
      {anonymizationEnabled && (
        <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-black/10 px-2 py-0.5 text-xs">
          🔐 Anonymized
        </span>
      )}
    </div>
  );
};

interface PersonaBackendStatusProps {
  /** Backend type */
  backend: PreferredBackend;
  /** Whether Ollama is available (if needed) */
  ollamaAvailable?: boolean;
  /** Whether anonymization is enabled */
  anonymizationEnabled?: boolean;
  /** Custom CSS classes */
  className?: string;
}

/**
 * Backend status display
 * Shows backend info with availability warnings
 */
export const PersonaBackendStatus: React.FC<PersonaBackendStatusProps> = ({
  backend,
  ollamaAvailable = true,
  anonymizationEnabled = false,
  className = '',
}) => {
  const privacy = BACKEND_PRIVACY_INFO[backend];
  const needsOllama = backend === 'ollama' || (backend === 'hybrid' && anonymizationEnabled);
  const hasWarning = needsOllama && !ollamaAvailable;

  return (
    <div
      className={`rounded-lg border p-3 ${
        hasWarning ? 'border-yellow-200 bg-yellow-50' : 'border-gray-200 bg-gray-50'
      } ${className}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{privacy.emoji}</span>
        <div className="flex-1">
          <div className="font-medium text-gray-900 capitalize">
            {backend} Backend
            {anonymizationEnabled && backend === 'hybrid' && ' (with anonymization)'}
          </div>
          <p className="mt-1 text-sm text-gray-600">{privacy.description}</p>

          {hasWarning && (
            <div className="mt-2 rounded-lg bg-yellow-100 border border-yellow-300 p-2 text-sm text-yellow-800">
              <strong>⚠️ Warning:</strong> Ollama service is not running. This backend requires Ollama to be active.
            </div>
          )}

          <div className="mt-2 flex gap-4 text-xs text-gray-600">
            <div>
              Cloud:{' '}
              <span className="font-medium">
                {privacy.sendsToCloud ? '✓ Yes' : '✗ No'}
              </span>
            </div>
            <div>
              Local:{' '}
              <span className="font-medium">
                {privacy.localProcessing ? '✓ Yes' : '✗ No'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonaBackendIndicator;
