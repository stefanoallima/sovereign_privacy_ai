/**
 * PII Extraction Confirmation Dialog
 * Shows extracted PII fields and allows editing before storage
 */

import React, { useState } from 'react';
import { Shield, Plus, Trash2, Lock } from 'lucide-react';
import { PIIExtraction } from '@/services/pii-service';

interface PiiExtractionDialogProps {
  piiData: PIIExtraction;
  onConfirm: (piiData: PIIExtraction) => void;
  onCancel: () => void;
  loading?: boolean;
  documentName?: string;
}

interface EditedPii {
  bsn?: string;
  name?: string;
  surname?: string;
  phone?: string;
  address?: string;
  email?: string;
  income?: string;
}

export const PiiExtractionDialog: React.FC<PiiExtractionDialogProps> = ({
  piiData,
  onConfirm,
  onCancel,
  loading = false,
  documentName = 'Document',
}) => {
  const [edited, setEdited] = useState<EditedPii>({
    bsn: piiData.bsn || '',
    name: piiData.name || '',
    surname: piiData.surname || '',
    phone: piiData.phone || '',
    address: piiData.address || '',
    email: piiData.email || '',
    income: piiData.income || '',
  });

  const [deletedFields, setDeletedFields] = useState<Set<string>>(new Set());

  const handleFieldChange = (field: keyof EditedPii, value: string) => {
    setEdited(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleDelete = (field: string) => {
    const newDeleted = new Set(deletedFields);
    if (newDeleted.has(field)) {
      newDeleted.delete(field);
    } else {
      newDeleted.add(field);
    }
    setDeletedFields(newDeleted);
  };

  const handleConfirm = () => {
    const finalPii: PIIExtraction = {
      ...piiData,
      bsn: deletedFields.has('bsn') ? undefined : edited.bsn || undefined,
      name: deletedFields.has('name') ? undefined : edited.name || undefined,
      surname: deletedFields.has('surname') ? undefined : edited.surname || undefined,
      phone: deletedFields.has('phone') ? undefined : edited.phone || undefined,
      address: deletedFields.has('address') ? undefined : edited.address || undefined,
      email: deletedFields.has('email') ? undefined : edited.email || undefined,
      income: deletedFields.has('income') ? undefined : edited.income || undefined,
    };
    onConfirm(finalPii);
  };

  const fields = [
    { key: 'bsn', label: 'Tax ID (BSN)', type: 'text' },
    { key: 'name', label: 'First Name', type: 'text' },
    { key: 'surname', label: 'Last Name', type: 'text' },
    { key: 'phone', label: 'Phone Number', type: 'tel' },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'address', label: 'Address', type: 'text' },
    { key: 'income', label: 'Annual Income', type: 'text' },
  ];

  const extractedCount = Object.values(edited).filter(v => v && !deletedFields.has(Object.keys(edited)[Object.values(edited).indexOf(v)])).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-[hsl(var(--background)/0.4)] backdrop-blur-md" onClick={onCancel} />

      {/* Dialog Body */}
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card)/0.9)] shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="bg-gradient-to-br from-[hsl(var(--primary)/0.05)] to-[hsl(162_78%_55%/0.05)] p-8 border-b border-[hsl(var(--border)/0.3)]">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(162_78%_50% )] flex items-center justify-center text-white shadow-lg shadow-[hsl(var(--primary)/0.25)]">
              <Shield size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[hsl(var(--foreground))] tracking-tight">Review Private Information</h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))] font-medium opacity-80">
                {documentName} • {extractedCount} field{extractedCount !== 1 ? 's' : ''} identified locali
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[50vh] overflow-y-auto p-8 space-y-4 custom-scrollbar">
          {fields.map(field => {
            const fieldValue = edited[field.key as keyof EditedPii];
            const isDeleted = deletedFields.has(field.key);
            const confidence = piiData.confidence_scores[field.key as keyof typeof piiData.confidence_scores];

            return (
              <div
                key={field.key}
                className={`group relative rounded-2xl border transition-all duration-300 ${isDeleted
                    ? 'bg-red-500/5 border-red-500/20 opacity-60'
                    : 'bg-[hsl(var(--secondary)/0.3)] border-[hsl(var(--border)/0.5)] hover:border-[hsl(var(--primary)/0.3)] hover:bg-[hsl(var(--secondary)/0.5)]'
                  }`}
              >
                <div className="p-4 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className={`text-[11px] font-bold uppercase tracking-wider ${isDeleted ? 'text-red-400' : 'text-[hsl(var(--muted-foreground))]'}`}>
                        {field.label}
                      </label>
                      {confidence && !isDeleted && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${confidence >= 0.9
                            ? 'bg-green-500/10 text-green-600'
                            : confidence >= 0.85
                              ? 'bg-amber-500/10 text-amber-600'
                              : 'bg-orange-500/10 text-orange-600'
                          }`}>
                          {Math.round(confidence * 100)}% Match
                        </span>
                      )}
                    </div>

                    {fieldValue ? (
                      <div className="flex items-center gap-2">
                        <input
                          type={field.type}
                          value={fieldValue}
                          onChange={e => handleFieldChange(field.key as keyof EditedPii, e.target.value)}
                          disabled={isDeleted}
                          className={`w-full bg-transparent text-sm font-medium focus:outline-none transition-all ${isDeleted ? 'text-gray-400 line-through' : 'text-[hsl(var(--foreground))]'
                            }`}
                        />
                      </div>
                    ) : (
                      <div className="text-sm text-[hsl(var(--muted-foreground)/0.4)] italic">
                        Not detected in this document
                      </div>
                    )}
                  </div>

                  {fieldValue && (
                    <button
                      onClick={() => handleDelete(field.key)}
                      className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all ${isDeleted
                          ? 'bg-red-500/10 text-red-600 hover:bg-red-500/20'
                          : 'bg-[hsl(var(--muted)/0.5)] text-[hsl(var(--muted-foreground))] hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100'
                        }`}
                      title={isDeleted ? 'Restore' : 'Remove'}
                    >
                      {isDeleted ? <Plus size={16} /> : <Trash2 size={16} />}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Local Security Banner */}
        <div className="px-8 py-4 bg-gradient-to-r from-[hsl(var(--primary)/0.03)] to-transparent flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-green-500/10 text-green-600">
            <Lock size={14} />
          </div>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-tight">
            <span className="font-bold text-green-600">Privacy Shield Active:</span> Extracted data is encrypted and stored 100% locally. No sensitive information leaves your device during this step.
          </p>
        </div>

        {/* Footer */}
        <div className="flex gap-4 p-8 border-t border-[hsl(var(--border)/0.1)] bg-[hsl(var(--card))]">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-6 py-3 rounded-2xl font-semibold text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] transition-all active:scale-95 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || extractedCount === 0}
            className="flex-[2] px-6 py-3 rounded-2xl font-bold text-sm bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(162_78%_50% )] text-white shadow-lg shadow-[hsl(var(--primary)/0.2)] hover:shadow-xl hover:shadow-[hsl(var(--primary)/0.3)] hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
          >
            {loading ? 'Processing...' : 'Confirm & Secure Local Storage'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PiiExtractionDialog;
