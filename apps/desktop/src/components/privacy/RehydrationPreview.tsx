/**
 * Rehydration Preview Component
 *
 * Shows users what placeholders are in LLM responses and lets them
 * preview/approve the re-hydration (template filling) before finalizing.
 */

import React, { useState, useMemo } from 'react';
import {
  FileText,
  Check,
  X,
  AlertTriangle,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Lock,
  RefreshCw,
  Copy,
  CheckCircle2,
} from 'lucide-react';
import {
  useUserContextStore,
  selectCurrentPII,
} from '@/stores/userContext';
import {
  analyzeTemplate,
  rehydrateTemplate,
  type TemplateAnalysis,
  type RehydrationResult,
  type PIIValues,
} from '@/services/rehydration-service';

// ==================== Types ====================

interface RehydrationPreviewProps {
  /** The template content from LLM (with placeholders like [BSN], [NAME]) */
  template: string;
  /** Callback when user approves the re-hydrated content */
  onApprove?: (content: string) => void;
  /** Callback when user rejects (keeps placeholders) */
  onReject?: () => void;
  /** Optional custom PII values (defaults to UserContext store) */
  customPIIValues?: PIIValues;
  /** Whether to show the full analysis */
  showAnalysis?: boolean;
  /** Compact mode for inline use */
  compact?: boolean;
  className?: string;
}

interface PlaceholderBadgeProps {
  placeholder: string;
  hasValue: boolean;
  isSensitive: boolean;
  maskedValue?: string;
  showValue: boolean;
  onToggleVisibility: () => void;
}

// ==================== Placeholder Badge ====================

const PlaceholderBadge: React.FC<PlaceholderBadgeProps> = ({
  placeholder,
  hasValue,
  isSensitive,
  maskedValue,
  showValue,
  onToggleVisibility,
}) => {
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${
        hasValue
          ? 'bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20'
          : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
      }`}
    >
      <code className="font-mono">{placeholder}</code>
      {isSensitive && <Lock size={10} className="opacity-60" />}
      {hasValue && maskedValue && (
        <>
          <span className="opacity-40">→</span>
          <span className="font-mono">{showValue ? maskedValue : '•••'}</span>
          <button
            onClick={onToggleVisibility}
            className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10"
          >
            {showValue ? <EyeOff size={10} /> : <Eye size={10} />}
          </button>
        </>
      )}
      {!hasValue && (
        <span className="text-[10px] opacity-60 uppercase tracking-wider">Missing</span>
      )}
    </div>
  );
};

// ==================== Content Diff View ====================

const ContentDiffView: React.FC<{
  template: string;
  rehydrated: string;
  showRehydrated: boolean;
}> = ({ template, rehydrated, showRehydrated }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(showRehydrated ? rehydrated : template);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const content = showRehydrated ? rehydrated : template;

  // Highlight placeholders in template view
  const highlightedContent = useMemo(() => {
    if (showRehydrated) return content;

    // Replace placeholders with highlighted versions
    return content.replace(/\[([A-Z_]+)\]/g, (match) => {
      return `<mark class="bg-amber-200 dark:bg-amber-900/50 px-0.5 rounded">${match}</mark>`;
    });
  }, [content, showRehydrated]);

  return (
    <div className="relative">
      <div className="absolute top-2 right-2 flex items-center gap-2">
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
            showRehydrated
              ? 'bg-green-500/10 text-green-600'
              : 'bg-amber-500/10 text-amber-600'
          }`}
        >
          {showRehydrated ? 'Filled' : 'Template'}
        </span>
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-lg hover:bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] transition-colors"
          title="Copy to clipboard"
        >
          {copied ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
        </button>
      </div>

      <div
        className="p-4 bg-[hsl(var(--secondary)/0.3)] rounded-xl font-mono text-sm whitespace-pre-wrap break-words leading-relaxed max-h-80 overflow-y-auto"
        dangerouslySetInnerHTML={{ __html: highlightedContent }}
      />
    </div>
  );
};

// ==================== Main Component ====================

export const RehydrationPreview: React.FC<RehydrationPreviewProps> = ({
  template,
  onApprove,
  onReject,
  customPIIValues,
  showAnalysis = true,
  className = '',
}) => {
  const storePII = useUserContextStore(selectCurrentPII);
  const piiValues = customPIIValues || storePII;

  const [showRehydrated, setShowRehydrated] = useState(false);
  const [visiblePlaceholders, setVisiblePlaceholders] = useState<Set<string>>(new Set());
  const [analysisExpanded, setAnalysisExpanded] = useState(true);

  // Analyze and rehydrate
  const analysis = useMemo<TemplateAnalysis | null>(() => {
    try {
      return analyzeTemplate(template, piiValues);
    } catch {
      return null;
    }
  }, [template, piiValues]);

  const result = useMemo<RehydrationResult | null>(() => {
    try {
      return rehydrateTemplate(template, piiValues);
    } catch {
      return null;
    }
  }, [template, piiValues]);

  const togglePlaceholderVisibility = (placeholder: string) => {
    setVisiblePlaceholders((prev) => {
      const next = new Set(prev);
      if (next.has(placeholder)) {
        next.delete(placeholder);
      } else {
        next.add(placeholder);
      }
      return next;
    });
  };

  if (!analysis || !result) {
    return (
      <div className={`p-4 bg-red-500/10 border border-red-500/20 rounded-xl ${className}`}>
        <div className="flex items-center gap-2 text-red-600">
          <AlertTriangle size={16} />
          <span className="text-sm font-medium">Failed to analyze template</span>
        </div>
      </div>
    );
  }

  const hasAllValues = analysis.canFullyHydrate;
  const filledCount = result.filledPlaceholders.length;
  const missingCount = result.unfilledPlaceholders.length;

  return (
    <div
      className={`bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl overflow-hidden ${className}`}
    >
      {/* Header */}
      <div
        className={`px-4 py-3 border-b border-[hsl(var(--border)/0.3)] ${
          hasAllValues
            ? 'bg-gradient-to-r from-green-500/10 to-emerald-500/10'
            : 'bg-gradient-to-r from-amber-500/10 to-orange-500/10'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-xl ${
                hasAllValues ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'
              }`}
            >
              <FileText size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[hsl(var(--foreground))]">
                Template Re-hydration
              </h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {hasAllValues
                  ? `All ${filledCount} placeholders can be filled`
                  : `${filledCount} of ${filledCount + missingCount} placeholders available`}
              </p>
            </div>
          </div>

          {/* Toggle Button */}
          <button
            onClick={() => setShowRehydrated(!showRehydrated)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              showRehydrated
                ? 'bg-green-500 text-white'
                : 'bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))]'
            }`}
          >
            <RefreshCw size={12} />
            {showRehydrated ? 'Show Template' : 'Preview Filled'}
          </button>
        </div>
      </div>

      {/* Analysis Section */}
      {showAnalysis && (
        <div className="border-b border-[hsl(var(--border)/0.3)]">
          <button
            onClick={() => setAnalysisExpanded(!analysisExpanded)}
            className="w-full flex items-center justify-between px-4 py-2 hover:bg-[hsl(var(--secondary)/0.2)] transition-colors"
          >
            <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
              Placeholders Found
            </span>
            {analysisExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          {analysisExpanded && (
            <div className="px-4 pb-3 flex flex-wrap gap-2">
              {analysis.placeholders.map((p, idx) => {
                const filled = result.filledPlaceholders.find(
                  (f: { placeholder: string }) => f.placeholder === p.placeholder
                );
                return (
                  <PlaceholderBadge
                    key={`${p.placeholder}-${idx}`}
                    placeholder={p.placeholder}
                    hasValue={p.hasValue}
                    isSensitive={filled?.isSensitive ?? false}
                    maskedValue={filled?.maskedValue}
                    showValue={visiblePlaceholders.has(p.placeholder)}
                    onToggleVisibility={() => togglePlaceholderVisibility(p.placeholder)}
                  />
                );
              })}

              {analysis.placeholders.length === 0 && (
                <span className="text-xs text-[hsl(var(--muted-foreground))] italic">
                  No placeholders detected in template
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Missing Values Warning */}
      {!hasAllValues && (
        <div className="px-4 py-2 bg-amber-500/5 border-b border-amber-500/20 flex items-start gap-2">
          <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
              Missing values:{' '}
            </span>
            <span className="text-xs text-amber-600 dark:text-amber-500">
              {analysis.missingValues.join(', ')}
            </span>
          </div>
        </div>
      )}

      {/* Content Preview */}
      <div className="p-4">
        <ContentDiffView
          template={template}
          rehydrated={result.content}
          showRehydrated={showRehydrated}
        />
      </div>

      {/* Actions */}
      {(onApprove || onReject) && (
        <div className="px-4 py-3 bg-[hsl(var(--secondary)/0.1)] border-t border-[hsl(var(--border)/0.3)] flex items-center justify-between">
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            {showRehydrated
              ? 'Review the filled content before approving'
              : 'Toggle preview to see filled values'}
          </p>
          <div className="flex gap-2">
            {onReject && (
              <button
                onClick={onReject}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--secondary)/0.8)] rounded-lg transition-colors"
              >
                <X size={14} />
                Keep Placeholders
              </button>
            )}
            {onApprove && (
              <button
                onClick={() => onApprove(result.content)}
                disabled={!hasAllValues}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check size={14} />
                Use Filled Content
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RehydrationPreview;
