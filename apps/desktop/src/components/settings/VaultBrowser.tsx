import { useState, useCallback, useMemo } from "react";
import { usePiiVaultStore } from "@/stores/piiVault";
import type { PiiVaultEntry } from "@/types";

interface VaultBrowserProps {
  onOpenEntry?: (entry: PiiVaultEntry) => void;
}

export function VaultBrowser({ onOpenEntry }: VaultBrowserProps) {
  const { entries, addEntry, removeEntry, clear } = usePiiVaultStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newText, setNewText] = useState("");
  const [newCategory, setNewCategory] = useState("");

  const handleAddSubmit = useCallback(() => {
    const text = newText.trim();
    const category = newCategory.trim();
    if (!text || !category) return;
    addEntry(text, category);
    setNewText("");
    setNewCategory("");
    setShowAddForm(false);
  }, [newText, newCategory, addEntry]);

  // Debounced search filter
  const filteredEntries = useMemo(() => {
    if (!searchTerm.trim()) return entries;
    const term = searchTerm.toLowerCase();
    return entries.filter(
      (e) =>
        e.text.toLowerCase().includes(term) ||
        e.category.toLowerCase().includes(term) ||
        e.placeholder.toLowerCase().includes(term)
    );
  }, [entries, searchTerm]);

  const handleEdit = useCallback(
    (entry: PiiVaultEntry) => {
      onOpenEntry?.(entry);
    },
    [onOpenEntry]
  );

  const handleDelete = useCallback(
    (id: string) => {
      removeEntry(id);
    },
    [removeEntry]
  );

  const handleExport = useCallback(() => {
    const entriesToExport = usePiiVaultStore.getState().exportEntries();
    const json = JSON.stringify(entriesToExport, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vault-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleClearAll = useCallback(() => {
    clear();
    setShowClearConfirm(false);
  }, [clear]);

  return (
    <div className="space-y-4" data-testid="pii-vault">
      {/* Header with title and badge */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            PII Vault
            {entries.length > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-[hsl(var(--violet))] text-white font-medium">
                {entries.length} {entries.length === 1 ? "entry" : "entries"}
              </span>
            )}
          </h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            Stored on this device (not encrypted) · {entries.length === 0 ? "No entries yet" : "Always substituted in messages"}
          </p>
        </div>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          data-testid="vault-add-entry"
          className="px-3 py-1.5 text-xs font-medium bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5 shrink-0"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          Add Entry
        </button>
      </div>

      {/* Add Entry form */}
      {showAddForm && (
        <div
          data-testid="vault-add-form"
          className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] p-3 space-y-2"
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="Sensitive text (e.g. Jan de Vries)"
              data-testid="vault-entry-text"
              className="flex-1 px-3 py-2 text-sm bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.5)]"
            />
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddSubmit(); }}
              placeholder="Category (e.g. person name)"
              data-testid="vault-entry-category"
              className="flex-1 px-3 py-2 text-sm bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.5)]"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setShowAddForm(false); setNewText(""); setNewCategory(""); }}
              className="px-3 py-1.5 text-xs text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddSubmit}
              disabled={!newText.trim() || !newCategory.trim()}
              data-testid="vault-entry-save"
              className="px-3 py-1.5 text-xs font-medium bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Entry
            </button>
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by name, type, or placeholder..."
          data-testid="vault-search"
          className="w-full px-3 py-2 pl-9 text-sm bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.5)]"
        />
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
      </div>

      {/* Entries list or empty state */}
      {entries.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-[hsl(var(--border))] p-8 text-center">
          <VaultIcon className="w-8 h-8 text-[hsl(var(--muted-foreground))] mx-auto mb-2 opacity-50" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            No entries yet. PII detected in messages will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto rounded-lg border border-[hsl(var(--border))]">
          {filteredEntries.length === 0 ? (
            <div className="p-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
              No entries match "{searchTerm}"
            </div>
          ) : (
            filteredEntries.map((entry) => (
              <div
                key={entry.id}
                data-testid="vault-entry"
                data-entry-text={entry.text}
                data-entry-category={entry.category}
                data-entry-placeholder={entry.placeholder}
                className="flex items-center justify-between p-3 border-b border-[hsl(var(--border)/0.5)] last:border-b-0 hover:bg-[hsl(var(--secondary)/0.3)] transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span data-testid="vault-entry-text-value" className="text-sm font-medium truncate">{entry.text}</span>
                    <span data-testid="vault-entry-category-value" className="text-xs px-1.5 py-0.5 rounded bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] shrink-0">
                      {entry.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <code data-testid="vault-entry-placeholder-value" className="text-xs font-mono bg-[hsl(var(--muted)/0.5)] px-1.5 py-0.5 rounded text-[hsl(var(--muted-foreground))]">
                      {entry.placeholder}
                    </code>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      Used {entry.useCount} {entry.useCount === 1 ? "time" : "times"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => handleEdit(entry)}
                    data-testid="vault-entry-edit"
                    className="p-1.5 rounded hover:bg-[hsl(var(--primary)/0.2)] text-[hsl(var(--primary))] transition-colors"
                    title="Edit entry"
                  >
                    <EditIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    data-testid="vault-entry-delete"
                    className="p-1.5 rounded hover:bg-[hsl(var(--status-danger-bg))] text-[hsl(var(--status-danger))] transition-colors"
                    title="Delete entry"
                  >
                    <DeleteIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Action buttons */}
      {entries.length > 0 && (
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={handleExport}
            data-testid="vault-export"
            className="flex-1 px-4 py-2 text-sm font-medium bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <ExportIcon className="w-4 h-4" />
            Export Vault
          </button>
          <button
            onClick={() => setShowClearConfirm(true)}
            data-testid="vault-clear-all"
            className="flex-1 px-4 py-2 text-sm font-medium bg-[hsl(var(--status-danger-bg))] text-[hsl(var(--status-danger))] rounded-lg hover:opacity-80 transition-opacity flex items-center justify-center gap-2"
          >
            <TrashIcon className="w-4 h-4" />
            Clear All
          </button>
        </div>
      )}

      {/* Clear confirmation dialog */}
      {showClearConfirm && (
        <div data-testid="vault-clear-confirm" className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--foreground)/0.15)]">
          <div className="w-full max-w-sm rounded-lg bg-[hsl(var(--card))] shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4">
              <h3 className="text-base font-semibold">Clear PII Vault?</h3>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="rounded p-1 hover:bg-[hsl(var(--accent))]"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-[hsl(var(--foreground))]">
                This will permanently delete all {entries.length} vault entries. This action cannot be undone.
              </p>
              <div className="rounded-lg bg-[hsl(var(--status-danger-bg))] border border-[hsl(var(--status-danger-border))] p-3">
                <p className="text-xs text-[hsl(var(--status-danger))] font-medium">
                  Placeholder mappings will be lost. Message history will not be modified.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 border-t border-[hsl(var(--border))] px-6 py-4">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                data-testid="vault-clear-confirm-button"
                className="px-4 py-2 text-sm font-medium bg-[hsl(var(--status-danger))] text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function VaultIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function EditIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function DeleteIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function ExportIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function TrashIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function CloseIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
