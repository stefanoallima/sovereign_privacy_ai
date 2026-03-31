import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

// ---------------------------------------------------------------------------
// Types matching the Rust backend
// ---------------------------------------------------------------------------

interface KnowledgeBaseInfo {
  id: string;
  name: string;
  description: string;
  document_count: number;
  chunk_count: number;
  created_at: string;
}

interface KbDocumentInfo {
  id: string;
  kb_id: string;
  name: string;
  file_type: string;
  chunk_count: number;
  created_at: string;
}

interface IngestResult {
  doc_id: string;
  filename: string;
  chunk_count: number;
  total_chars: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateUUID(): string {
  return crypto.randomUUID();
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-lg">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-medium hover:bg-[hsl(var(--accent))] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-[hsl(var(--status-danger))] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function ChevronIcon({ open: isOpen }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={"transition-transform " + (isOpen ? "rotate-90" : "")}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function KnowledgeBaseSettings() {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create-form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // Per-KB expanded documents
  const [expandedKbId, setExpandedKbId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Record<string, KbDocumentInfo[]>>({});
  const [docsLoading, setDocsLoading] = useState<string | null>(null);

  // Ingestion state
  const [ingestingKbId, setIngestingKbId] = useState<string | null>(null);
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);

  // Confirm-delete state
  const [deleteKbConfirm, setDeleteKbConfirm] = useState<KnowledgeBaseInfo | null>(null);
  const [deleteDocConfirm, setDeleteDocConfirm] = useState<KbDocumentInfo | null>(null);

  const loadKnowledgeBases = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const kbs = await invoke<KnowledgeBaseInfo[]>("listKnowledgeBases");
      setKnowledgeBases(kbs);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDocuments = useCallback(async (kbId: string) => {
    try {
      setDocsLoading(kbId);
      const docs = await invoke<KbDocumentInfo[]>("listKbDocuments", { kbId });
      setDocuments((prev) => ({ ...prev, [kbId]: docs }));
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      setDocsLoading(null);
    }
  }, []);

  useEffect(() => {
    loadKnowledgeBases();
  }, [loadKnowledgeBases]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      setCreating(true);
      await invoke("createKnowledgeBase", {
        id: generateUUID(),
        name: newName.trim(),
        description: newDescription.trim(),
      });
      setNewName("");
      setNewDescription("");
      setShowCreateForm(false);
      await loadKnowledgeBases();
    } catch (err) {
      setError(String(err));
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteKb = async (kb: KnowledgeBaseInfo) => {
    try {
      await invoke("deleteKnowledgeBase", { id: kb.id });
      setDeleteKbConfirm(null);
      setDocuments((prev) => {
        const next = { ...prev };
        delete next[kb.id];
        return next;
      });
      if (expandedKbId === kb.id) setExpandedKbId(null);
      await loadKnowledgeBases();
    } catch (err) {
      setError(String(err));
    }
  };

  const handleDeleteDoc = async (doc: KbDocumentInfo) => {
    try {
      await invoke("deleteKbDocument", { docId: doc.id });
      setDeleteDocConfirm(null);
      await loadDocuments(doc.kb_id);
      await loadKnowledgeBases();
    } catch (err) {
      setError(String(err));
    }
  };

  const handleToggleExpand = async (kbId: string) => {
    if (expandedKbId === kbId) {
      setExpandedKbId(null);
    } else {
      setExpandedKbId(kbId);
      if (!documents[kbId]) {
        await loadDocuments(kbId);
      }
    }
  };

  const handleUploadDocument = async (kbId: string) => {
    try {
      const selected = await open({
        title: "Select document to ingest",
        multiple: false,
        filters: [
          {
            name: "Documents",
            extensions: ["pdf", "docx", "txt", "md"],
          },
        ],
      });

      if (!selected) return;

      setIngestingKbId(kbId);
      setIngestResult(null);

      const result = await invoke<IngestResult>("ingestDocument", {
        kbId,
        filePath: selected as string,
      });

      setIngestResult(result);
      await loadDocuments(kbId);
      await loadKnowledgeBases();

      setExpandedKbId(kbId);

      setTimeout(() => setIngestResult(null), 4000);
    } catch (err) {
      setError(String(err));
    } finally {
      setIngestingKbId(null);
    }
  };

  const pluralDocs = (n: number) => (n === 1 ? "doc" : "docs");
  const pluralChunks = (n: number) => (n === 1 ? "chunk" : "chunks");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            Knowledge Bases
          </h3>
          <span className="rounded bg-[hsl(var(--primary)/0.1)] px-1.5 py-0.5 text-[11px] font-medium text-[hsl(var(--primary))]">
            RAG
          </span>
        </div>
        <button
          onClick={() => setShowCreateForm((v) => !v)}
          className="flex items-center gap-1 rounded-lg bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
        >
          <PlusIcon /> New Collection
        </button>
      </div>

      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        Manage document collections for retrieval-augmented generation. Upload PDFs, DOCX, or text
        files to create searchable knowledge bases.
      </p>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-[hsl(var(--status-danger-border))] bg-[hsl(var(--status-danger-bg))] p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[hsl(var(--status-danger))]">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-xs text-[hsl(var(--status-danger))] hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Ingest success toast */}
      {ingestResult && (
        <div className="rounded-lg border border-[hsl(var(--status-safe-border))] bg-[hsl(var(--status-safe-bg))] p-3">
          <p className="text-xs font-medium text-[hsl(var(--status-safe))]">
            {"Ingested “" + ingestResult.filename + "” — " + ingestResult.chunk_count + " chunks, " + ingestResult.total_chars.toLocaleString() + " characters"}
          </p>
        </div>
      )}

      {/* Create form */}
      {showCreateForm && (
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 space-y-3">
          <h4 className="text-sm font-medium">Create New Knowledge Base</h4>
          <div>
            <label className="text-xs text-[hsl(var(--muted-foreground))]">Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., Project Documentation"
              className="mt-1 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setShowCreateForm(false);
              }}
            />
          </div>
          <div>
            <label className="text-xs text-[hsl(var(--muted-foreground))]">
              Description (optional)
            </label>
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="e.g., Internal project specs and design docs"
              className="mt-1 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setShowCreateForm(false);
              }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setShowCreateForm(false);
                setNewName("");
                setNewDescription("");
              }}
              className="rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-medium hover:bg-[hsl(var(--accent))] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
              className="rounded-lg bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Loading knowledge bases...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && knowledgeBases.length === 0 && (
        <div className="rounded-lg border border-dashed border-[hsl(var(--border))] p-8 text-center">
          <DatabaseIcon />
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            No knowledge bases yet
          </p>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            Create a collection and upload documents to enable RAG-powered answers.
          </p>
        </div>
      )}

      {/* Knowledge base cards */}
      {!loading && (
        <div className="space-y-2">
          {knowledgeBases.map((kb) => {
            const isExpanded = expandedKbId === kb.id;
            const kbDocs = documents[kb.id] || [];
            const isIngesting = ingestingKbId === kb.id;
            const isLoadingDocs = docsLoading === kb.id;

            return (
              <div
                key={kb.id}
                className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] transition-colors"
              >
                {/* KB header row */}
                <div className="flex items-center gap-3 p-3">
                  <button
                    onClick={() => handleToggleExpand(kb.id)}
                    className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                  >
                    <ChevronIcon open={isExpanded} />
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{kb.name}</span>
                      <span className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">
                        {kb.document_count} {pluralDocs(kb.document_count)}
                      </span>
                      <span className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">
                        {kb.chunk_count} {pluralChunks(kb.chunk_count)}
                      </span>
                    </div>
                    {kb.description && (
                      <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))] truncate">
                        {kb.description}
                      </p>
                    )}
                    <p className="mt-0.5 text-[11px] text-[hsl(var(--muted-foreground)/0.6)]">
                      {"Created " + formatDate(kb.created_at)}
                    </p>
                  </div>

                  <div className="shrink-0 flex items-center gap-1">
                    <button
                      onClick={() => handleUploadDocument(kb.id)}
                      disabled={isIngesting}
                      className="flex items-center gap-1 rounded-lg bg-[hsl(var(--status-safe-bg))] px-2.5 py-1.5 text-xs font-medium text-[hsl(var(--status-safe))] hover:opacity-80 transition-opacity disabled:opacity-50"
                    >
                      {isIngesting ? (
                        "Ingesting..."
                      ) : (
                        <>
                          <DocumentIcon /> Upload
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setDeleteKbConfirm(kb)}
                      className="rounded-lg bg-[hsl(var(--status-danger-bg))] px-2.5 py-1.5 text-xs font-medium text-[hsl(var(--status-danger))] hover:opacity-80 transition-opacity"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Expanded documents section */}
                {isExpanded && (
                  <div className="border-t border-[hsl(var(--border))] px-3 py-2">
                    {isLoadingDocs && (
                      <p className="text-xs text-[hsl(var(--muted-foreground))] py-2">
                        Loading documents...
                      </p>
                    )}

                    {!isLoadingDocs && kbDocs.length === 0 && (
                      <p className="text-xs text-[hsl(var(--muted-foreground))] py-2">
                        No documents yet. Upload a file to get started.
                      </p>
                    )}

                    {!isLoadingDocs && kbDocs.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 pb-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                            Documents
                          </span>
                        </div>
                        {kbDocs.map((doc) => (
                          <div
                            key={doc.id}
                            className="group flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-[hsl(var(--accent)/0.5)] transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <DocumentIcon />
                              <div className="min-w-0">
                                <span className="text-xs font-medium truncate block">
                                  {doc.name}
                                </span>
                                <div className="flex gap-2 text-[11px] text-[hsl(var(--muted-foreground))]">
                                  <span className="uppercase">{doc.file_type}</span>
                                  <span>{"·"}</span>
                                  <span>{doc.chunk_count + " chunks"}</span>
                                  <span>{"·"}</span>
                                  <span>{formatDate(doc.created_at)}</span>
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => setDeleteDocConfirm(doc)}
                              className="opacity-0 group-hover:opacity-100 rounded-md px-2 py-1 text-xs text-[hsl(var(--status-danger))] hover:bg-[hsl(var(--status-danger-bg))] transition-all"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm delete KB dialog */}
      {deleteKbConfirm && (
        <ConfirmDialog
          title="Delete Knowledge Base"
          message={"Are you sure you want to delete “" + deleteKbConfirm.name + "”? This will remove all " + deleteKbConfirm.document_count + " document(s) and " + deleteKbConfirm.chunk_count + " chunk(s). This action cannot be undone."}
          onConfirm={() => handleDeleteKb(deleteKbConfirm)}
          onCancel={() => setDeleteKbConfirm(null)}
        />
      )}

      {/* Confirm delete document dialog */}
      {deleteDocConfirm && (
        <ConfirmDialog
          title="Delete Document"
          message={"Are you sure you want to remove “" + deleteDocConfirm.name + "” (" + deleteDocConfirm.chunk_count + " chunks)? This action cannot be undone."}
          onConfirm={() => handleDeleteDoc(deleteDocConfirm)}
          onCancel={() => setDeleteDocConfirm(null)}
        />
      )}
    </div>
  );
}
