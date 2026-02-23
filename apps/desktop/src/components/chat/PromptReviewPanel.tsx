import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, Shield, X, Send, History, FileText, Eye, EyeOff } from 'lucide-react';

export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CanvasDoc {
  id: string;
  title: string;
}

export interface SendOptions {
  includeHistory: boolean;
  includeCanvas: boolean;
}

export interface PromptReviewPanelProps {
  originalMessage: string;
  processedPrompt: string;
  contentMode: string;
  attributesCount?: number;
  privacyInfo?: string;
  historyMessages?: HistoryMessage[];
  canvasDocs?: CanvasDoc[];
  onApprove: (editedPrompt: string, opts: SendOptions) => void;
  onCancel: () => void;
}

export function PromptReviewPanel({
  originalMessage,
  processedPrompt,
  contentMode,
  attributesCount,
  privacyInfo,
  historyMessages = [],
  canvasDocs = [],
  onApprove,
  onCancel,
}: PromptReviewPanelProps) {
  const [editedPrompt, setEditedPrompt] = useState(processedPrompt);
  const [showOriginal, setShowOriginal] = useState(false);
  const [includeHistory, setIncludeHistory] = useState(true);
  const [includeCanvas, setIncludeCanvas] = useState(true);
  const [showHistoryPreview, setShowHistoryPreview] = useState(false);
  const [showCanvasPreview, setShowCanvasPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);

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
        onApprove(editedPrompt, { includeHistory, includeCanvas });
      }
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    },
    [editedPrompt, includeHistory, includeCanvas, onApprove, onCancel]
  );

  const originalWords = originalMessage.trim().split(/\s+/).length;
  const processedWords = processedPrompt.trim().split(/\s+/).length;
  const reductionPercent = originalWords > 0
    ? Math.round(((originalWords - processedWords) / originalWords) * 100) : 0;
  const isEdited = editedPrompt !== processedPrompt;

  return (
    <div className="rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))] shadow-xl overflow-hidden animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border)/0.3)] bg-[hsl(var(--secondary)/0.3)]">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-green-500" />
          <span className="text-sm font-semibold text-[hsl(var(--foreground))]">Privacy Review</span>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">— Review what will be sent to cloud</span>
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
          {showOriginal ? <ChevronDown className="h-3 w-3 flex-shrink-0" /> : <ChevronRight className="h-3 w-3 flex-shrink-0" />}
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
            Current message (cloud will see this) {isEdited && <span className="text-amber-500">(edited)</span>}
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

        {/* ── Context toggles ── */}
        <div className="rounded-xl border border-[hsl(var(--border)/0.4)] overflow-hidden divide-y divide-[hsl(var(--border)/0.3)]">
          {/* Conversation history */}
          <ContextToggleRow
            icon={<History className="h-3.5 w-3.5" />}
            label="Conversation history"
            count={historyMessages.length}
            unit="message"
            included={includeHistory}
            onToggle={() => setIncludeHistory(v => !v)}
            showPreview={showHistoryPreview}
            onTogglePreview={() => setShowHistoryPreview(v => !v)}
            disabled={historyMessages.length === 0}
          >
            {showHistoryPreview && historyMessages.length > 0 && (
              <div className="max-h-40 overflow-y-auto space-y-1.5 px-3 pb-2.5">
                {historyMessages.slice(-6).map((m, i) => (
                  <div key={i} className={`text-[11px] rounded-lg px-2.5 py-1.5 ${m.role === 'user'
                    ? 'bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--foreground-muted))]'
                    : 'bg-[hsl(var(--secondary)/0.5)] text-[hsl(var(--muted-foreground))]'}`}>
                    <span className="font-semibold uppercase tracking-wider text-[9px] opacity-60 mr-1.5">
                      {m.role === 'user' ? 'You' : 'AI'}
                    </span>
                    {m.content.slice(0, 120)}{m.content.length > 120 ? '…' : ''}
                  </div>
                ))}
                {historyMessages.length > 6 && (
                  <p className="text-[10px] text-center text-[hsl(var(--muted-foreground)/0.5)] pt-1">
                    + {historyMessages.length - 6} earlier messages
                  </p>
                )}
              </div>
            )}
          </ContextToggleRow>

          {/* Canvas documents */}
          <ContextToggleRow
            icon={<FileText className="h-3.5 w-3.5" />}
            label="Canvas documents"
            count={canvasDocs.length}
            unit="document"
            included={includeCanvas}
            onToggle={() => setIncludeCanvas(v => !v)}
            showPreview={showCanvasPreview}
            onTogglePreview={() => setShowCanvasPreview(v => !v)}
            disabled={canvasDocs.length === 0}
          >
            {showCanvasPreview && canvasDocs.length > 0 && (
              <div className="px-3 pb-2.5 space-y-1">
                {canvasDocs.map(doc => (
                  <div key={doc.id} className="flex items-center gap-2 text-[11px] text-[hsl(var(--muted-foreground))]">
                    <FileText className="h-3 w-3 flex-shrink-0 text-[hsl(var(--violet))]" />
                    <span className="truncate">{doc.title}</span>
                  </div>
                ))}
              </div>
            )}
          </ContextToggleRow>
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
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{privacyInfo}</span>
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
              onClick={() => onApprove(editedPrompt, { includeHistory, includeCanvas })}
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

// ── Subcomponent ──────────────────────────────────────────────────────────────

function ContextToggleRow({
  icon,
  label,
  count,
  unit,
  included,
  onToggle,
  showPreview,
  onTogglePreview,
  disabled,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  unit: string;
  included: boolean;
  onToggle: () => void;
  showPreview: boolean;
  onTogglePreview: () => void;
  disabled: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`bg-[hsl(var(--background)/0.4)] ${disabled ? 'opacity-40' : ''}`}>
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span className="text-[hsl(var(--muted-foreground))]">{icon}</span>
        <span className="flex-1 text-[12px] font-medium text-[hsl(var(--foreground-muted))]">
          {label}
          <span className="ml-1.5 text-[hsl(var(--muted-foreground)/0.6)] font-normal">
            ({count} {unit}{count !== 1 ? 's' : ''})
          </span>
        </span>
        {/* Preview toggle */}
        {!disabled && count > 0 && (
          <button
            onClick={onTogglePreview}
            className="flex items-center justify-center h-6 w-6 rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))] transition-colors"
            title={showPreview ? 'Hide preview' : 'Preview'}
          >
            {showPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </button>
        )}
        {/* Include toggle */}
        <button
          onClick={onToggle}
          disabled={disabled}
          title={included ? 'Exclude from cloud request' : 'Include in cloud request'}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
            included ? 'bg-green-500' : 'bg-[hsl(var(--border))]'
          } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
            included ? 'translate-x-4' : 'translate-x-0.5'
          }`} />
        </button>
      </div>
      {children}
    </div>
  );
}
