import { useState, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, Eye, Edit2, FileText, Trash2, Save, FolderPlus, BookOpen } from 'lucide-react';
import { useCanvasStore, useChatStore } from '@/stores';

function extractBriefFromCanvas(content: string): string {
  const lines = content.split('\n').filter(l => /^([-*•]|#{1,3}) /.test(l.trim()));
  const items = lines.slice(0, 10).map(l => l.replace(/^#{1,3} /, '• ').replace(/^[-*•] /, '• '));
  return items.join('\n') || content.slice(0, 300);
}

const CANVAS_TEMPLATES = [
  { icon: '📊', label: 'Tax Strategy', prompt: 'Create a structured tax strategy document for my situation, with sections for income overview, deduction opportunities, and risk areas.' },
  { icon: '📝', label: 'CBT Journal', prompt: 'Help me structure a CBT journal entry for today, with sections for situation, automatic thoughts, emotions, evidence for/against, and balanced perspective.' },
  { icon: '📋', label: 'Project Brief', prompt: 'Create a professional project brief document with sections for objective, scope, stakeholders, timeline, and success criteria.' },
  { icon: '⚖️', label: 'Risk Summary', prompt: 'Produce a structured risk summary document with identified risks, likelihood ratings, impact assessment, and mitigation recommendations.' },
];

function CanvasEmptyState({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col h-full bg-[hsl(var(--surface-1))] border-l border-[hsl(var(--border))]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))]">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-[hsl(var(--violet))]" />
          <span className="text-sm font-semibold text-[hsl(var(--foreground-muted))]">Canvas</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Empty state body */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6 pattern-dots">
        <div className="text-center">
          <div className="h-12 w-12 rounded-2xl bg-[hsl(var(--violet)/0.15)] border border-[hsl(var(--violet)/0.3)] flex items-center justify-center mx-auto mb-4">
            <FileText className="h-6 w-6 text-[hsl(var(--violet))]" />
          </div>
          <h3 className="text-[14px] font-semibold text-[hsl(var(--foreground))] mb-1">Canvas is empty</h3>
          <p className="text-[12px] text-[hsl(var(--muted-foreground))]">
            Ask the AI to create a document, or start from a template
          </p>
        </div>

        {/* Template shelf */}
        <div className="w-full max-w-xs space-y-2">
          <p className="text-[11px] text-[hsl(var(--foreground-subtle))] uppercase tracking-wider font-medium mb-3">Quick start</p>
          {CANVAS_TEMPLATES.map(t => (
            <button
              key={t.label}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[hsl(var(--surface-2))] hover:bg-[hsl(var(--accent))] border border-transparent hover:border-[hsl(var(--border))] transition-all text-left group"
              onClick={() => {
                // Dispatch a custom event that ChatWindow can listen to
                window.dispatchEvent(new CustomEvent('canvas:template-prompt', { detail: { prompt: t.prompt } }));
              }}
            >
              <span className="text-base flex-shrink-0">{t.icon}</span>
              <span className="text-[13px] text-[hsl(var(--foreground-muted))] group-hover:text-[hsl(var(--foreground))] font-medium transition-colors">{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CanvasPanel() {
  const { closePanel, updateDocument, deleteDocument, documents, activeDocumentId } = useCanvasStore();
  const doc = documents.find(d => d.id === activeDocumentId);
  const { projects, currentConversationId } = useChatStore();

  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Sync local state when active document changes
  useEffect(() => {
    setEditContent(doc?.content ?? '');
    setEditTitle(doc?.title ?? '');
    setIsDirty(false);
    setMode('preview');
    setIsEditingTitle(false);
  }, [doc?.id]);

  const handleSave = useCallback(async () => {
    if (!doc) return;
    await updateDocument(doc.id, { content: editContent, title: editTitle });
    setIsDirty(false);
  }, [doc, editContent, editTitle, updateDocument]);

  const handleDelete = useCallback(async () => {
    if (!doc) return;
    await deleteDocument(doc.id);
  }, [doc, deleteDocument]);

  if (!doc) {
    return <CanvasEmptyState onClose={closePanel} />;
  }

  return (
    <div className="flex flex-col h-full bg-[hsl(var(--surface-1))] border-l border-[hsl(var(--border))] panel-slide-enter">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))] flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FileText className="h-4 w-4 text-[hsl(var(--violet))] flex-shrink-0" />
          {isEditingTitle ? (
            <input
              autoFocus
              value={editTitle}
              onChange={e => { setEditTitle(e.target.value); setIsDirty(true); }}
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={e => e.key === 'Enter' && setIsEditingTitle(false)}
              className="flex-1 text-sm font-semibold bg-transparent border-none outline-none text-[hsl(var(--foreground))] min-w-0"
            />
          ) : (
            <button
              onClick={() => setIsEditingTitle(true)}
              className="text-sm font-semibold text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary))] transition-colors truncate text-left"
            >
              {doc.title}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Preview / Edit toggle */}
          <div className="flex bg-[hsl(var(--surface-2))] p-0.5 rounded-lg mr-1">
            {(['preview', 'edit'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  mode === m
                    ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))] shadow-sm'
                    : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                }`}
              >
                {m === 'preview' ? <Eye className="h-3 w-3" /> : <Edit2 className="h-3 w-3" />}
                {m === 'preview' ? 'Preview' : 'Edit'}
              </button>
            ))}
          </div>

          {isDirty && (
            <button
              onClick={handleSave}
              className="p-1.5 rounded-lg bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.25)] transition-colors"
              title="Save changes"
            >
              <Save className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={handleDelete}
            className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.1)] transition-colors"
            title="Delete document"
          >
            <Trash2 className="h-4 w-4" />
          </button>

          <button
            onClick={closePanel}
            className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Project badge */}
      {doc.projectId && (
        <div className="px-4 py-1.5 border-b border-[hsl(var(--border))] flex items-center gap-1.5 flex-shrink-0">
          <FolderPlus className="h-3 w-3 text-[hsl(var(--violet))]" />
          <span className="text-[11px] text-[hsl(var(--muted-foreground))] tracking-wide uppercase font-medium">
            {projects.find(p => p.id === doc.projectId)?.name ?? 'Project'}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        {mode === 'preview' ? (
          <div className="prose prose-sm prose-invert max-w-none
            prose-headings:text-[hsl(var(--foreground))] prose-headings:font-semibold
            prose-p:text-[hsl(var(--foreground-muted))]
            prose-code:text-[hsl(var(--primary))] prose-code:bg-[hsl(var(--surface-2))]
            prose-pre:bg-[hsl(var(--surface-2))] prose-pre:border prose-pre:border-[hsl(var(--border))]
            prose-a:text-[hsl(var(--primary))]
            prose-strong:text-[hsl(var(--foreground))]
            prose-th:text-[hsl(var(--foreground))] prose-td:text-[hsl(var(--foreground-muted))]
          ">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {doc.content}
            </ReactMarkdown>
          </div>
        ) : (
          <textarea
            value={editContent}
            onChange={e => { setEditContent(e.target.value); setIsDirty(true); }}
            className="w-full h-full min-h-[400px] bg-transparent resize-none focus:outline-none text-sm font-mono leading-relaxed text-[hsl(var(--foreground-muted))] placeholder:text-[hsl(var(--foreground-subtle))]"
            placeholder="Write markdown here..."
            spellCheck={false}
          />
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-[hsl(var(--border))] flex items-center justify-between flex-shrink-0">
        <span className="text-[11px] text-[hsl(var(--foreground-subtle))]">
          {doc.content.split(/\s+/).filter(Boolean).length} words
        </span>
        {currentConversationId && (
          <button
            onClick={() => {
              if (!doc || !currentConversationId) return;
              const briefContent = extractBriefFromCanvas(doc.content);
              localStorage.setItem(`brief:${currentConversationId}`, briefContent);
              window.dispatchEvent(new CustomEvent('brief:updated', { detail: { conversationId: currentConversationId } }));
            }}
            className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--foreground-subtle))]
              hover:text-[hsl(var(--violet))] transition-colors px-2 py-0.5 rounded-lg hover:bg-[hsl(var(--violet)/0.08)]"
            title="Push canvas key points to Living Brief"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Sync to Brief
          </button>
        )}
        <span className="text-[11px] text-[hsl(var(--foreground-subtle))]">
          Updated {new Date(doc.updatedAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
