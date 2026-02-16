/**
 * Persona Knowledge Tab
 *
 * Knowledge base selection and document management for personas.
 */

import React, { useState } from 'react';
import {
  BookOpen,
  FileText,
  Upload,
  FolderOpen,
  Info,
  Plus,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { Persona } from '@/types';

interface PersonaKnowledgeTabProps {
  persona: Persona;
  onChange: (updates: Partial<Persona>) => void;
}

// Placeholder knowledge bases with documents
const MOCK_KNOWLEDGE_BASES = [
  {
    id: 'dutch-tax-law',
    name: 'Dutch Tax Law',
    description: 'Tax regulations, deductions, and filing requirements',
    documentCount: 12,
    isBuiltIn: true,
    documents: [
      { id: 'd1', name: 'Income Tax Basics (Box 1)', type: 'pdf', size: '245 KB' },
      { id: 'd2', name: 'Savings & Investments (Box 3)', type: 'pdf', size: '180 KB' },
      { id: 'd3', name: 'Mortgage Interest Deductions', type: 'pdf', size: '120 KB' },
      { id: 'd4', name: 'Healthcare Deductions Guide', type: 'md', size: '45 KB' },
      { id: 'd5', name: 'Self-Employment Tax Rules', type: 'pdf', size: '320 KB' },
    ],
  },
  {
    id: 'cbt-techniques',
    name: 'CBT Techniques',
    description: 'Cognitive Behavioral Therapy methods and exercises',
    documentCount: 8,
    isBuiltIn: true,
    documents: [
      { id: 'd6', name: 'Cognitive Distortions List', type: 'md', size: '28 KB' },
      { id: 'd7', name: 'Thought Record Template', type: 'pdf', size: '95 KB' },
      { id: 'd8', name: 'Behavioral Activation Guide', type: 'pdf', size: '150 KB' },
    ],
  },
  {
    id: 'goal-setting',
    name: 'Goal Setting & Habits',
    description: 'SMART goals, habit formation, productivity frameworks',
    documentCount: 5,
    isBuiltIn: true,
    documents: [
      { id: 'd9', name: 'SMART Goals Framework', type: 'md', size: '32 KB' },
      { id: 'd10', name: 'Habit Stacking Method', type: 'pdf', size: '88 KB' },
    ],
  },
];

export const PersonaKnowledgeTab: React.FC<PersonaKnowledgeTabProps> = ({
  persona,
  onChange,
}) => {
  const selectedKBs = persona.knowledgeBaseIds || [];
  const [expandedKB, setExpandedKB] = useState<string | null>(null);

  const toggleKnowledgeBase = (kbId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering expand
    const newIds = selectedKBs.includes(kbId)
      ? selectedKBs.filter((id) => id !== kbId)
      : [...selectedKBs, kbId];
    onChange({ knowledgeBaseIds: newIds });
  };

  const toggleExpand = (kbId: string) => {
    setExpandedKB(expandedKB === kbId ? null : kbId);
  };

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <section className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
        <div className="flex items-start gap-3">
          <Info size={18} className="text-blue-600 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-blue-700 dark:text-blue-400">
              RAG-Powered Knowledge
            </p>
            <p className="text-blue-600/80 dark:text-blue-400/80 mt-1">
              Selected knowledge bases are searched to provide context-aware responses.
              Documents are processed locally and stored in an embedded vector database.
            </p>
          </div>
        </div>
      </section>

      {/* Available Knowledge Bases */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] uppercase tracking-wider flex items-center gap-2">
            <BookOpen size={16} className="text-[hsl(var(--primary))]" />
            Knowledge Bases
          </h3>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            {selectedKBs.length} selected
          </span>
        </div>

        <div className="grid gap-3">
          {MOCK_KNOWLEDGE_BASES.map((kb) => {
            const isSelected = selectedKBs.includes(kb.id);
            const isExpanded = expandedKB === kb.id;

            return (
              <div
                key={kb.id}
                className={`rounded-xl border-2 transition-all overflow-hidden ${
                  isSelected
                    ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)]'
                    : 'border-[hsl(var(--border))] hover:border-[hsl(var(--border)/0.8)]'
                }`}
              >
                {/* Header - Click to expand */}
                <button
                  onClick={() => toggleExpand(kb.id)}
                  className="w-full flex items-start gap-4 p-4 text-left hover:bg-[hsl(var(--secondary)/0.2)] transition-colors"
                >
                  <div
                    className={`p-2 rounded-lg ${
                      isSelected
                        ? 'bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]'
                        : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]'
                    }`}
                  >
                    <FolderOpen size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[hsl(var(--foreground))]">
                        {kb.name}
                      </span>
                      {kb.isBuiltIn && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
                          Built-in
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                      {kb.description}
                    </p>
                    <div className="flex items-center gap-1 mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                      <FileText size={12} />
                      {kb.documentCount} documents
                      <span className="ml-2 text-[hsl(var(--primary))]">
                        {isExpanded ? 'Hide' : 'View'} details
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Expand indicator */}
                    <div className="text-[hsl(var(--muted-foreground))]">
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </div>
                    {/* Checkbox */}
                    <div
                      onClick={(e) => toggleKnowledgeBase(kb.id, e)}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors cursor-pointer hover:scale-110 ${
                        isSelected
                          ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]'
                          : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.5)]'
                      }`}
                    >
                      {isSelected && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="white"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded Document List */}
                {isExpanded && (
                  <div className="border-t border-[hsl(var(--border)/0.5)] bg-[hsl(var(--secondary)/0.1)] p-4 animate-fade-in">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                        Documents in this knowledge base
                      </span>
                    </div>
                    <div className="space-y-2">
                      {kb.documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center gap-3 p-2.5 rounded-lg bg-[hsl(var(--background))] border border-[hsl(var(--border)/0.5)] hover:border-[hsl(var(--border))] transition-colors"
                        >
                          <div className="p-1.5 rounded bg-[hsl(var(--secondary))]">
                            <FileText size={14} className="text-[hsl(var(--muted-foreground))]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">
                              {doc.name}
                            </p>
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">
                              {doc.type.toUpperCase()} • {doc.size}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-3 text-center">
                      {kb.documents.length} of {kb.documentCount} documents shown
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Upload Custom Documents */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] uppercase tracking-wider flex items-center gap-2">
          <Upload size={16} className="text-[hsl(var(--primary))]" />
          Custom Documents
        </h3>

        <div className="border-2 border-dashed border-[hsl(var(--border))] rounded-xl p-8 text-center hover:border-[hsl(var(--primary)/0.5)] hover:bg-[hsl(var(--secondary)/0.1)] transition-colors cursor-pointer">
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 rounded-full bg-[hsl(var(--secondary))]">
              <Plus size={24} className="text-[hsl(var(--muted-foreground))]" />
            </div>
            <div>
              <p className="font-medium text-[hsl(var(--foreground))]">
                Upload Documents
              </p>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                PDF, DOCX, TXT, or Markdown files
              </p>
            </div>
          </div>
        </div>

        <p className="text-xs text-[hsl(var(--muted-foreground))] text-center">
          Documents are processed locally and stored encrypted on your device.
        </p>
      </section>
    </div>
  );
};

export default PersonaKnowledgeTab;
