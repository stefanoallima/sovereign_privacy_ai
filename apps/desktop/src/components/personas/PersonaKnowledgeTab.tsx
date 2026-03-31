/**
 * Persona Knowledge Tab
 *
 * Knowledge base selection for personas.
 * Fetches real knowledge bases from the Tauri backend via list_knowledge_bases
 * and lets the user toggle which KBs are attached to this persona.
 */

import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  BookOpen,
  FileText,
  FolderOpen,
  Info,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import type { Persona } from "@/types";

interface PersonaKnowledgeTabProps {
  persona: Persona;
  onChange: (updates: Partial<Persona>) => void;
}

/** Shape returned by the Rust list_knowledge_bases command (snake_case). */
interface RustKnowledgeBase {
  id: string;
  name: string;
  description: string;
  document_count: number;
  chunk_count: number;
  created_at: string;
}

export const PersonaKnowledgeTab: React.FC<PersonaKnowledgeTabProps> = ({
  persona,
  onChange,
}) => {
  const selectedKBs = persona.knowledgeBaseIds || [];

  const [knowledgeBases, setKnowledgeBases] = useState<RustKnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchKnowledgeBases = async () => {
    setLoading(true);
    setError(null);
    try {
      const kbs = await invoke<RustKnowledgeBase[]>("list_knowledge_bases");
      setKnowledgeBases(kbs);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKnowledgeBases();
  }, []);

  const toggleKnowledgeBase = (kbId: string) => {
    const newIds = selectedKBs.includes(kbId)
      ? selectedKBs.filter((id) => id !== kbId)
      : [...selectedKBs, kbId];
    onChange({ knowledgeBaseIds: newIds });
  };

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <section className="p-4 bg-[hsl(var(--primary)/0.05)] border border-[hsl(var(--primary)/0.2)] rounded-xl">
        <div className="flex items-start gap-3">
          <Info size={18} className="text-[hsl(var(--primary))] mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-[hsl(var(--primary))]">
              RAG-Powered Knowledge
            </p>
            <p className="text-[hsl(var(--primary)/0.8)] mt-1">
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
          <div className="flex items-center gap-3">
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              {selectedKBs.length} selected
            </span>
            <button
              onClick={fetchKnowledgeBases}
              disabled={loading}
              className="p-1 rounded hover:bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] transition-colors disabled:opacity-50"
              title="Refresh knowledge bases"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-[hsl(var(--muted-foreground))]">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">Loading knowledge bases...</span>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-red-500/30 bg-red-500/5">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-600">Failed to load knowledge bases</p>
              <p className="text-xs text-red-500/80 mt-1 truncate">{error}</p>
            </div>
            <button
              onClick={fetchKnowledgeBases}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && knowledgeBases.length === 0 && (
          <div className="py-8 text-center">
            <FolderOpen size={32} className="mx-auto text-[hsl(var(--muted-foreground)/0.4)] mb-3" />
            <p className="text-sm font-medium text-[hsl(var(--foreground))]">
              No knowledge bases yet
            </p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
              Create a knowledge base in Settings to attach documents to this persona.
            </p>
          </div>
        )}
        {/* KB list */}
        {!loading && !error && knowledgeBases.length > 0 && (
          <div className="grid gap-3">
            {knowledgeBases.map((kb) => {
              const isSelected = selectedKBs.includes(kb.id);

              return (
                <button
                  key={kb.id}
                  type="button"
                  onClick={() => toggleKnowledgeBase(kb.id)}
                  className={`w-full rounded-xl border-2 transition-all p-4 text-left flex items-start gap-4 hover:bg-[hsl(var(--secondary)/0.2)] ${
                    isSelected
                      ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)]"
                      : "border-[hsl(var(--border))] hover:border-[hsl(var(--border)/0.8)]"
                  }`}
                >
                  {/* Icon */}
                  <div
                    className={`p-2 rounded-lg shrink-0 ${
                      isSelected
                        ? "bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]"
                        : "bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]"
                    }`}
                  >
                    <FolderOpen size={16} />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-[hsl(var(--foreground))]">
                      {kb.name}
                    </span>
                    {kb.description && (
                      <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                        {kb.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                      <span className="flex items-center gap-1">
                        <FileText size={12} />
                        {kb.document_count} {kb.document_count === 1 ? "document" : "documents"}
                      </span>
                      <span>
                        {kb.chunk_count} {kb.chunk_count === 1 ? "chunk" : "chunks"}
                      </span>
                    </div>
                  </div>

                  {/* Checkbox */}
                  <div
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                      isSelected
                        ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]"
                        : "border-[hsl(var(--border))]"
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
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default PersonaKnowledgeTab;
