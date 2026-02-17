import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, Shield, X, Send } from 'lucide-react';

export interface PromptReviewPanelProps {
  originalMessage: string;
  processedPrompt: string;
  contentMode: string;
  attributesCount?: number;
  privacyInfo?: string;
  onApprove: (editedPrompt: string) => void;
  onCancel: () => void;
}

export function PromptReviewPanel({
  originalMessage,
  processedPrompt,
  contentMode,
  attributesCount,
  privacyInfo,
  onApprove,
  onCancel,
}: PromptReviewPanelProps) {
  const [editedPrompt, setEditedPrompt] = useState(processedPrompt);
  const [showOriginal, setShowOriginal] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 240)}px`;
    }
  }, [editedPrompt]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onApprove(editedPrompt);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    },
    [editedPrompt, onApprove, onCancel]
  );

  // Calculate word diff
  const originalWords = originalMessage.trim().split(/\s+/).length;
  const processedWords = processedPrompt.trim().split(/\s+/).length;
  const reductionPercent = originalWords > 0
    ? Math.round(((originalWords - processedWords) / originalWords) * 100)
    : 0;

  const isEdited = editedPrompt !== processedPrompt;

  return (
    <div className="rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))] shadow-xl overflow-hidden animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border)/0.3)] bg-[hsl(var(--secondary)/0.3)]">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-green-500" />
          <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
            Privacy Review
          </span>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            — What will be sent to cloud
          </span>
        </div>
        <button
          onClick={onCancel}
          className="flex items-center justify-center h-7 w-7 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))] transition-colors"
          title="Cancel (Esc)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Original message (collapsible) */}
        <button
          onClick={() => setShowOriginal(!showOriginal)}
          className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors w-full text-left"
        >
          {showOriginal ? (
            <ChevronDown className="h-3 w-3 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 flex-shrink-0" />
          )}
          <span className="font-medium">Your original message</span>
          {!showOriginal && (
            <span className="truncate opacity-60 flex-1">
              "{originalMessage.slice(0, 80)}{originalMessage.length > 80 ? '...' : ''}"
            </span>
          )}
        </button>

        {showOriginal && (
          <div className="rounded-lg bg-[hsl(var(--secondary)/0.5)] p-3 text-sm text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border)/0.3)]">
            {originalMessage}
          </div>
        )}

        {/* Editable sanitized prompt */}
        <div>
          <label className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1.5 block">
            What the cloud will see {isEdited && <span className="text-amber-500">(edited)</span>}
          </label>
          <textarea
            ref={textareaRef}
            value={editedPrompt}
            onChange={(e) => setEditedPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--background))] px-3 py-2.5 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:border-[hsl(var(--ring)/0.5)] focus:ring-1 focus:ring-[hsl(var(--ring)/0.3)] resize-none transition-colors"
            rows={3}
            style={{ minHeight: '72px', maxHeight: '240px' }}
          />
        </div>

        {/* Info badges */}
        <div className="flex items-center gap-3 flex-wrap">
          {attributesCount != null && attributesCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-[10px] font-medium">
              {attributesCount} attribute{attributesCount !== 1 ? 's' : ''} extracted
            </span>
          )}
          {contentMode === 'attributes_only' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-[10px] font-medium">
              No PII in prompt
            </span>
          )}
          {reductionPercent > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-medium">
              {reductionPercent}% reduced
            </span>
          )}
          {privacyInfo && (
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
              {privacyInfo}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-[hsl(var(--muted-foreground)/0.5)]">
            Ctrl+Enter to approve · Esc to cancel
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onApprove(editedPrompt)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-500 text-white shadow-md shadow-green-600/25 transition-colors active:scale-95"
            >
              <Send className="h-3.5 w-3.5" />
              Approve & Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
