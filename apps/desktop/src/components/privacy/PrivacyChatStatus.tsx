/**
 * Privacy Chat Status Component
 *
 * Compact status indicator for showing the current privacy mode
 * during chat. Can be placed in the chat input area or header.
 */

import React from 'react';
import {
  Lock,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Ban,
  Zap,
  Info,
} from 'lucide-react';
import type { PrivacyStatus } from '@/hooks/usePrivacyChat';

// ==================== Types ====================

interface PrivacyChatStatusProps {
  status: PrivacyStatus;
  showDetails?: boolean;
  compact?: boolean;
  className?: string;
  onClick?: () => void;
}

// ==================== Mode Configurations ====================

const MODE_CONFIG: Record<
  PrivacyStatus['mode'],
  {
    icon: React.ReactNode;
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  idle: {
    icon: <Shield size={14} />,
    label: 'Ready',
    color: 'text-[hsl(var(--muted-foreground))]',
    bgColor: 'bg-[hsl(var(--muted)/0.5)]',
    borderColor: 'border-[hsl(var(--border)/0.5)]',
  },
  processing: {
    icon: <Loader2 size={14} className="animate-spin" />,
    label: 'Processing',
    color: 'text-[hsl(var(--primary))]',
    bgColor: 'bg-[hsl(var(--primary)/0.1)]',
    borderColor: 'border-[hsl(var(--primary)/0.2)]',
  },
  local: {
    icon: <Lock size={14} />,
    label: 'Local Only',
    color: 'text-[hsl(var(--status-safe))]',
    bgColor: 'bg-[hsl(var(--status-safe-bg))]',
    borderColor: 'border-[hsl(var(--status-safe-border))]',
  },
  attributes_only: {
    icon: <ShieldCheck size={14} />,
    label: 'Attributes Only',
    color: 'text-[hsl(var(--status-safe))]',
    bgColor: 'bg-[hsl(var(--status-safe-bg))]',
    borderColor: 'border-[hsl(var(--status-safe-border))]',
  },
  anonymized: {
    icon: <ShieldCheck size={14} />,
    label: 'Anonymized',
    color: 'text-[hsl(var(--primary))]',
    bgColor: 'bg-[hsl(var(--primary)/0.1)]',
    borderColor: 'border-[hsl(var(--primary)/0.2)]',
  },
  blocked: {
    icon: <Ban size={14} />,
    label: 'Blocked',
    color: 'text-[hsl(var(--status-danger))]',
    bgColor: 'bg-[hsl(var(--status-danger-bg))]',
    borderColor: 'border-[hsl(var(--status-danger-border))]',
  },
  direct: {
    icon: <Zap size={14} />,
    label: 'Direct',
    color: 'text-[hsl(var(--status-caution))]',
    bgColor: 'bg-[hsl(var(--status-caution-bg))]',
    borderColor: 'border-[hsl(var(--status-caution-border))]',
  },
  pending_review: {
    icon: <Shield size={14} />,
    label: 'Review',
    color: 'text-[hsl(var(--status-caution))]',
    bgColor: 'bg-[hsl(var(--status-caution-bg))]',
    borderColor: 'border-[hsl(var(--status-caution-border))]',
  },
};

// ==================== Main Component ====================

export const PrivacyChatStatus: React.FC<PrivacyChatStatusProps> = ({
  status,
  showDetails = false,
  compact = false,
  className = '',
  onClick,
}) => {
  const config = MODE_CONFIG[status.mode];

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${config.bgColor} ${config.color} border ${config.borderColor} transition-colors hover:opacity-80 ${className}`}
        title={status.explanation}
      >
        {config.icon}
        {status.hadFallback && (
          <ShieldAlert size={10} className="text-orange-500" />
        )}
      </button>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold ${config.bgColor} ${config.color} border ${config.borderColor} transition-colors ${
        onClick ? 'cursor-pointer hover:opacity-80' : ''
      } ${className}`}
      title={status.explanation}
    >
      {config.icon}
      <span className="uppercase tracking-wider text-[11px]">{status.label}</span>

      {status.attributesCount !== undefined && status.attributesCount > 0 && (
        <span className="opacity-60 text-[11px]">
          ({status.attributesCount} attrs)
        </span>
      )}

      {status.hadFallback && (
        <span title="Fallback occurred">
          <ShieldAlert size={10} className="text-orange-500" />
        </span>
      )}

      {showDetails && status.explanation && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            alert(status.explanation);
          }}
          className="p-0.5 rounded hover:bg-[hsl(var(--foreground)/0.08)]"
        >
          <Info size={12} className="opacity-50" />
        </button>
      )}
    </div>
  );
};

// ==================== Privacy Mode Explanation ====================

export const PrivacyModeExplanation: React.FC<{ mode: PrivacyStatus['mode'] }> = ({
  mode,
}) => {
  const explanations: Record<PrivacyStatus['mode'], string> = {
    idle: 'Ready to process your message with privacy protection.',
    processing: 'Analyzing your message for sensitive information...',
    local: 'Your message will be processed entirely on your device using the built-in privacy engine.',
    attributes_only:
      'Only categorical information (income bracket, employment type) is sent to the cloud. Raw values stay local.',
    anonymized:
      'Personal information is replaced with placeholders before sending to the cloud.',
    blocked: 'This message contains highly sensitive data that should not be processed.',
    direct:
      'Message sent directly to cloud LLM. No sensitive information detected.',
    pending_review:
      'Review the sanitized prompt before it is sent to the cloud.',
  };

  return (
    <p className="text-xs text-[hsl(var(--muted-foreground))] italic">
      {explanations[mode]}
    </p>
  );
};

// ==================== Privacy Status Banner ====================

export const PrivacyStatusBanner: React.FC<{
  status: PrivacyStatus;
  onConfigure?: () => void;
  className?: string;
}> = ({ status, onConfigure, className = '' }) => {
  const config = MODE_CONFIG[status.mode];

  return (
    <div
      className={`flex items-center justify-between px-4 py-2 rounded-xl ${config.bgColor} border ${config.borderColor} ${className}`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-1.5 rounded-lg ${config.bgColor} ${config.color}`}>
          {config.icon}
        </div>
        <div>
          <span className={`text-xs font-semibold uppercase tracking-wider ${config.color}`}>
            {status.label}
          </span>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
            {status.explanation}
          </p>
        </div>
      </div>

      {onConfigure && (
        <button
          onClick={onConfigure}
          className="text-xs font-medium text-[hsl(var(--primary))] hover:underline"
        >
          Configure
        </button>
      )}
    </div>
  );
};

export default PrivacyChatStatus;
