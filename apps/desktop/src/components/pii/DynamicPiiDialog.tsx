/**
 * Dynamic PII Extraction Dialog
 * Supports arbitrary columns and multiple records extracted from documents.
 * Shows each record as a selectable card with editable fields.
 */

import React, { useState } from 'react';
import { Shield, Lock, CheckSquare, Square } from 'lucide-react';
import type { DynamicPIIExtraction } from '@/services/pii-service';

interface DynamicPiiDialogProps {
  data: DynamicPIIExtraction;
  documentName: string;
  onConfirm: (selectedRecords: Record<string, string>[]) => void;
  onCancel: () => void;
}

export const DynamicPiiDialog: React.FC<DynamicPiiDialogProps> = ({
  data,
  documentName,
  onConfirm,
  onCancel,
}) => {
  const [editedRecords, setEditedRecords] = useState<Record<string, string>[]>(
    () => data.records.map((r) => ({ ...r }))
  );
  const [selected, setSelected] = useState<boolean[]>(
    () => data.records.map(() => true)
  );

  const toggleRecord = (index: number) => {
    setSelected((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const toggleAll = () => {
    const allSelected = selected.every(Boolean);
    setSelected(selected.map(() => !allSelected));
  };

  const handleFieldChange = (recordIdx: number, column: string, value: string) => {
    setEditedRecords((prev) => {
      const next = [...prev];
      next[recordIdx] = { ...next[recordIdx], [column]: value };
      return next;
    });
  };

  const handleConfirm = () => {
    const result = editedRecords.filter((_, i) => selected[i]);
    onConfirm(result);
  };

  const selectedCount = selected.filter(Boolean).length;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-[hsl(var(--background)/0.4)] backdrop-blur-md"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card)/0.9)] shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="bg-[hsl(var(--primary)/0.05)] p-8 border-b border-[hsl(var(--border)/0.3)]">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-12 w-12 rounded-2xl bg-[hsl(var(--primary))] flex items-center justify-center text-[hsl(var(--primary-foreground))] shadow-lg shadow-[hsl(var(--primary)/0.25)]">
              <Shield size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[hsl(var(--foreground))] tracking-tight">
                Review Extracted Records
              </h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))] font-medium opacity-80">
                {documentName} &bull; {data.columns.length} column{data.columns.length !== 1 ? 's' : ''} &bull;{' '}
                {data.records.length} record{data.records.length !== 1 ? 's' : ''} found
              </p>
            </div>
          </div>

          {/* Column tags */}
          <div className="flex flex-wrap gap-2 mt-2">
            {data.columns.map((col) => (
              <span
                key={col}
                className="px-2.5 py-1 rounded-lg bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] text-xs font-semibold"
              >
                {col}
              </span>
            ))}
          </div>
        </div>

        {/* Select all */}
        <div className="px-8 pt-4 flex items-center gap-2">
          <button
            onClick={toggleAll}
            className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            {selected.every(Boolean) ? (
              <CheckSquare size={18} className="text-[hsl(var(--primary))]" />
            ) : (
              <Square size={18} />
            )}
            <span className="font-medium">
              {selected.every(Boolean) ? 'Deselect All' : 'Select All'}
            </span>
          </button>
          <span className="text-xs text-[hsl(var(--muted-foreground))] ml-auto">
            {selectedCount} of {data.records.length} selected
          </span>
        </div>
        {/* Record cards */}
        <div className="max-h-[50vh] overflow-y-auto p-8 pt-4 space-y-4 custom-scrollbar">
          {editedRecords.map((record, rIdx) => {
            const isSelected = selected[rIdx];
            return (
              <div
                key={rIdx}
                className={`rounded-2xl border transition-all duration-300 ${
                  isSelected
                    ? 'bg-[hsl(var(--secondary)/0.3)] border-[hsl(var(--primary)/0.3)]'
                    : 'bg-[hsl(var(--secondary)/0.1)] border-[hsl(var(--border)/0.3)] opacity-60'
                }`}
              >
                {/* Card header with checkbox */}
                <div className="flex items-center gap-3 px-4 pt-3 pb-1">
                  <button
                    onClick={() => toggleRecord(rIdx)}
                    className="flex-shrink-0"
                  >
                    {isSelected ? (
                      <CheckSquare
                        size={20}
                        className="text-[hsl(var(--primary))]"
                      />
                    ) : (
                      <Square
                        size={20}
                        className="text-[hsl(var(--muted-foreground))]"
                      />
                    )}
                  </button>
                  <span className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    Record {rIdx + 1}
                  </span>
                </div>

                {/* Fields */}
                <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                  {data.columns.map((col) => (
                    <div key={col}>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))] block mb-1">
                        {col}
                      </label>
                      <input
                        type="text"
                        value={record[col] || ''}
                        onChange={(e) =>
                          handleFieldChange(rIdx, col, e.target.value)
                        }
                        disabled={!isSelected}
                        className="w-full bg-[hsl(var(--background)/0.5)] border border-[hsl(var(--border)/0.5)] rounded-lg px-3 py-1.5 text-sm font-medium text-[hsl(var(--foreground))] focus:outline-none focus:border-[hsl(var(--primary)/0.5)] transition-colors disabled:opacity-40"
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {/* Local Security Banner */}
        <div className="px-8 py-4 bg-gradient-to-r from-[hsl(var(--primary)/0.03)] to-transparent flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-[hsl(var(--status-safe-bg))] text-[hsl(var(--status-safe))]">
            <Lock size={14} />
          </div>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-tight">
            <span className="font-bold text-[hsl(var(--status-safe))]">
              Privacy Shield Active:
            </span>{' '}
            Extracted data is stored 100% locally. No sensitive information
            leaves your device.
          </p>
        </div>

        {/* Footer */}
        <div className="flex gap-4 p-8 border-t border-[hsl(var(--border)/0.1)] bg-[hsl(var(--card))]">
          <button
            onClick={onCancel}
            className="flex-1 px-6 py-3 rounded-2xl font-semibold text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] transition-all active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedCount === 0}
            className="flex-[2] px-6 py-3 rounded-2xl font-bold text-sm bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-lg shadow-[hsl(var(--primary)/0.2)] hover:shadow-xl hover:shadow-[hsl(var(--primary)/0.3)] hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
          >
            Import {selectedCount} Record{selectedCount !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DynamicPiiDialog;
