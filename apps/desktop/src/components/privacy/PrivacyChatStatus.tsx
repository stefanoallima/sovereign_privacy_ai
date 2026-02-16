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
    color: 'text-gray-500 dark:text-gray-400',
    bgColor: 'bg-gray-500/10 dark:bg-gray-800/50',
    borderColor: 'border-gray-500/20',
  },
  processing: {
    icon: <Loader2 size={14} className="animate-spin" />,
    label: 'Processing',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/10 dark:bg-blue-900/30',
    borderColor: 'border-blue-500/20',
  },
  local: {
    icon: <Lock size={14} />,
    label: 'Local Only',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-500/10 dark:bg-green-900/30',
    borderColor: 'border-green-500/20',
  },
  attributes_only: {
    icon: <ShieldCheck size={14} />,
    label: 'Attributes Only',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-500/10 dark:bg-green-900/30',
    borderColor: 'border-green-500/20',
  },
  anonymized: {
    icon: <ShieldCheck size={14} />,
    label: 'Anonymized',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/10 dark:bg-blue-900/30',
    borderColor: 'border-blue-500/20',
  },
  blocked: {
    icon: <Ban size={14} />,
    label: 'Blocked',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500/10 dark:bg-red-900/30',
    borderColor: 'border-red-500/20',
  },
  direct: {
    icon: <Zap size={14} />,
    label: 'Direct',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500/10 dark:bg-amber-900/30',
    borderColor: 'border-amber-500/20',
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
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${config.bgColor} ${config.color} border ${config.borderColor} transition-all hover:opacity-80 ${className}`}
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
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold ${config.bgColor} ${config.color} border ${config.borderColor} transition-all ${
        onClick ? 'cursor-pointer hover:opacity-80' : ''
      } ${className}`}
      title={status.explanation}
    >
      {config.icon}
      <span className="uppercase tracking-wider text-[10px]">{status.label}</span>

      {status.attributesCount !== undefined && status.attributesCount > 0 && (
        <span className="opacity-60 text-[9px]">
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
          className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10"
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
    local: 'Your message will be processed entirely on your device using Ollama.',
    attributes_only:
      'Only categorical information (income bracket, employment type) is sent to the cloud. Raw values stay local.',
    anonymized:
      'Personal information is replaced with placeholders before sending to the cloud.',
    blocked: 'This message contains highly sensitive data that should not be processed.',
    direct:
      'Message sent directly to cloud LLM. No sensitive information detected.',
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
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
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
