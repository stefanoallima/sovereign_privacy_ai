import React, { useState, useCallback, useEffect } from 'react';
import { useFormFillStore } from '../../stores/formFill';
import { useFormFill } from '../../hooks/useFormFill';
import { useCanvasStore } from '../../stores/canvas';
import { Download, FileText, Edit3, Check, X, Loader2, User, Cpu, Keyboard } from 'lucide-react';
import type { FormField } from '../../types';

/** Small badge showing the source of a field value. */
function SourceBadge({ source }: { source?: FormField['source'] }) {
  if (!source) return null;

  const config: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
    profile: {
      label: 'auto',
      cls: 'bg-green-500/12 text-green-700 dark:text-green-400 border-green-600/30',
      Icon: User,
    },
    'user-input': {
      label: 'you',
      cls: 'bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] border-[hsl(var(--primary)/0.3)]',
      Icon: Keyboard,
    },
    'llm-composed': {
      label: 'AI',
      cls: 'bg-[hsl(var(--violet)/0.1)] text-[hsl(var(--violet))] border-[hsl(var(--violet)/0.3)]',
      Icon: Cpu,
    },
    skipped: {
      label: 'skipped',
      cls: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30',
      Icon: X,
    },
  };

  const c = config[source];
  if (!c) return null;
  const { label, cls, Icon } = c;

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border leading-none ${cls}`}
    >
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

/** A single form field row with inline editing capability. */
function FieldRow({
  field,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
}: {
  field: FormField;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (value: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(field.value ?? '');

  useEffect(() => {
    if (!isEditing) {
      setDraft(field.value ?? '');
    }
  }, [field.value, isEditing]);

  const handleSave = useCallback(() => {
    onSave(draft);
  }, [draft, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        onCancel();
      }
    },
    [handleSave, onCancel],
  );

  const hasValue = field.value && field.value.trim().length > 0;

  return (
    <div className="group rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2)/0.5)] hover:bg-[hsl(var(--surface-2))] transition-colors p-3">
      {/* Label row */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[12px] font-semibold text-[hsl(var(--foreground-muted))] uppercase tracking-wide">
          {field.label}
        </span>
        {field.category && (
          <span className="text-[10px] text-[hsl(var(--foreground-subtle))]">
            {field.category}
          </span>
        )}
        <SourceBadge source={field.source} />
      </div>

      {/* Value row */}
      {isEditing ? (
        <div className="flex items-start gap-2">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={Math.max(1, Math.ceil((draft?.length ?? 0) / 60))}
            className="flex-1 rounded-lg border border-[hsl(var(--primary)/0.4)] bg-[hsl(var(--surface-1))] px-3 py-1.5 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] resize-none"
            placeholder={field.placeholder || 'Enter value...'}
          />
          <div className="flex flex-col gap-1">
            <button
              onClick={handleSave}
              className="p-1.5 rounded-lg bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.25)] transition-colors"
              title="Save"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onCancel}
              className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] transition-colors"
              title="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={onStartEdit}
          className="w-full text-left group/value flex items-center gap-2"
        >
          <span
            className={`flex-1 text-sm leading-relaxed rounded-lg px-3 py-1.5 transition-colors ${
              hasValue
                ? 'text-[hsl(var(--foreground))] bg-[hsl(var(--primary)/0.06)]'
                : 'text-[hsl(var(--foreground-subtle))] italic bg-[hsl(var(--surface-1)/0.5)]'
            }`}
          >
            {hasValue ? field.value : field.placeholder || '[not filled]'}
          </span>
          <Edit3 className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] opacity-0 group-hover/value:opacity-100 transition-opacity flex-shrink-0" />
        </button>
      )}

      {/* Hint */}
      {field.hint && !isEditing && (
        <p className="mt-1 text-[11px] text-[hsl(var(--foreground-subtle))] pl-3">
          {field.hint}
        </p>
      )}
    </div>
  );
}

/**
 * FormFillCanvas -- specialized canvas view for filled forms with export capability.
 * Renders as a complete self-contained component within CanvasPanel.
 */
export function FormFillCanvas({ onClose }: { onClose: () => void }) {
  const { currentFormFill, updateFieldValue } = useFormFillStore();
  const { exportDocx } = useFormFill();
  const { closePanel } = useCanvasStore();

  const [editingField, setEditingField] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const fields = currentFormFill?.fieldMap ?? [];
  const filledCount = fields.filter((f) => f.value && f.value.trim().length > 0).length;
  const totalCount = fields.length;

  const handleFieldSave = useCallback(
    (label: string, value: string) => {
      updateFieldValue(label, value, false);
      setEditingField(null);
    },
    [updateFieldValue],
  );

  const handleExportDocx = useCallback(async () => {
    setIsExporting(true);
    try {
      await exportDocx();
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  }, [exportDocx]);

  const handleClose = useCallback(() => {
    onClose();
    closePanel();
  }, [onClose, closePanel]);

  if (!currentFormFill) {
    return null;
  }

  return (
    <div className="flex flex-col h-full bg-[hsl(var(--surface-1))] border-l border-[hsl(var(--border))] panel-slide-enter">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))] flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FileText className="h-4 w-4 text-[hsl(var(--violet))] flex-shrink-0" />
          <span className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">
            {currentFormFill.templateFilename}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Field count badge */}
          <span className="text-[11px] font-medium text-[hsl(var(--foreground-subtle))] bg-[hsl(var(--surface-2))] rounded-lg px-2 py-1">
            {filledCount}/{totalCount} fields filled
          </span>

          {/* Export DOCX button */}
          <button
            onClick={handleExportDocx}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.25)] disabled:opacity-50 transition-colors"
          >
            {isExporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {isExporting ? 'Exporting...' : 'Download DOCX'}
          </button>

          {/* Close button */}
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Form preview body */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        <div className="space-y-2 max-w-2xl mx-auto">
          {fields.map((field) => (
            <FieldRow
              key={field.id}
              field={field}
              isEditing={editingField === field.label}
              onStartEdit={() => setEditingField(field.label)}
              onSave={(value) => handleFieldSave(field.label, value)}
              onCancel={() => setEditingField(null)}
            />
          ))}

          {fields.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-8 w-8 text-[hsl(var(--foreground-subtle))] mb-3" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                No fields extracted yet
              </p>
              <p className="text-[11px] text-[hsl(var(--foreground-subtle))] mt-1">
                The form-fill pipeline is still processing
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-[hsl(var(--border))] flex items-center justify-between flex-shrink-0">
        <span className="text-[11px] text-[hsl(var(--foreground-subtle))]">
          Export preserves original template formatting
        </span>
        <span className="text-[11px] text-[hsl(var(--foreground-subtle))]">
          {currentFormFill.status === 'complete' ? 'Ready to export' : 'Processing...'}
        </span>
      </div>
    </div>
  );
}
