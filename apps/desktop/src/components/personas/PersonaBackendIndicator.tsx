/**
 * Persona Backend Indicator
 * Shows privacy level indicator for a persona with backend configuration
 * Used in persona selectors, lists, and chat headers
 */

import React from 'react';
import { Lock, ShieldCheck, Zap } from 'lucide-react';
import {
  PreferredBackend,
  BACKEND_PRIVACY_INFO,
} from '@/services/backend-routing-service';

/** Map backend type to a Lucide SVG icon instead of emoji */
function getBackendIcon(backend: PreferredBackend, size: number = 16) {
  switch (backend) {
    case 'ollama':
      return <Lock size={size} />;
    case 'hybrid':
      return <ShieldCheck size={size} />;
    case 'nebius':
    default:
      return <Zap size={size} />;
  }
}

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
      <span className={`${
        backend === 'ollama' ? 'text-[hsl(var(--status-safe))]' :
        backend === 'hybrid' ? 'text-[hsl(var(--primary))]' :
        'text-[hsl(var(--status-caution))]'
      }`}>
        {getBackendIcon(backend, 16)}
      </span>
      {showLabel && (
        <span className="text-sm font-medium capitalize text-[hsl(var(--foreground))]">
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
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden whitespace-nowrap rounded-lg bg-[hsl(var(--foreground))] px-3 py-1 text-sm text-[hsl(var(--background))] group-hover:block z-10">
        {privacy.description}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[hsl(var(--foreground))]"></div>
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
        return 'bg-[hsl(var(--status-safe-bg))] border-[hsl(var(--status-safe-border))] text-[hsl(var(--status-safe))]';
      case 'medium':
        return 'bg-[hsl(var(--primary)/0.1)] border-[hsl(var(--primary)/0.2)] text-[hsl(var(--primary))]';
      case 'low':
        return 'bg-[hsl(var(--status-caution-bg))] border-[hsl(var(--status-caution-border))] text-[hsl(var(--status-caution))]';
    }
  };

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${getBackgroundColor()} ${className}`}
    >
      {getBackendIcon(backend, 14)}
      <span className="capitalize">{backend}</span>
      {anonymizationEnabled && (
        <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-[hsl(var(--foreground)/0.08)] px-2 py-0.5 text-xs">
          <ShieldCheck size={11} /> Anonymized
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
        hasWarning ? 'border-[hsl(var(--status-caution-border))] bg-[hsl(var(--status-caution-bg))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--secondary))]'
      } ${className}`}
    >
      <div className="flex items-start gap-3">
        <span className={`text-2xl ${
          backend === 'ollama' ? 'text-[hsl(var(--status-safe))]' :
          backend === 'hybrid' ? 'text-[hsl(var(--primary))]' :
          'text-[hsl(var(--status-caution))]'
        }`}>{getBackendIcon(backend, 24)}</span>
        <div className="flex-1">
          <div className="font-medium text-[hsl(var(--foreground))] capitalize">
            {backend} Backend
            {anonymizationEnabled && backend === 'hybrid' && ' (with anonymization)'}
          </div>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{privacy.description}</p>

          {hasWarning && (
            <div className="mt-2 rounded-lg bg-[hsl(var(--status-caution-bg))] border border-[hsl(var(--status-caution-border))] p-2 text-sm text-[hsl(var(--status-caution))]">
              <strong>Warning:</strong> Ollama service is not running. This backend requires Ollama to be active.
            </div>
          )}

          <div className="mt-2 flex gap-4 text-xs text-[hsl(var(--muted-foreground))]">
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
