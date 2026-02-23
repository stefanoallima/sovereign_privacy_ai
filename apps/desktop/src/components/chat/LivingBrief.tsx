import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, BookOpen, Edit2, Check, X } from 'lucide-react';

interface LivingBriefProps {
  conversationId: string;
}

function getBrief(conversationId: string): string {
  return localStorage.getItem(`brief:${conversationId}`) ?? '';
}

function saveBrief(conversationId: string, content: string): void {
  localStorage.setItem(`brief:${conversationId}`, content);
}

export function LivingBrief({ conversationId }: LivingBriefProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(() => getBrief(conversationId));
  const [draft, setDraft] = useState('');

  const hasBrief = content.trim().length > 0;

  // Refresh when Sync to Brief fires
  useEffect(() => {
    const handler = (e: CustomEvent<{ conversationId: string }>) => {
      if (e.detail.conversationId === conversationId) {
        setContent(getBrief(conversationId));
        setIsExpanded(true);
      }
    };
    window.addEventListener('brief:updated', handler as EventListener);
    return () => window.removeEventListener('brief:updated', handler as EventListener);
  }, [conversationId]);

  // Reset when switching conversations
  useEffect(() => {
    setContent(getBrief(conversationId));
    setIsEditing(false);
    setDraft('');
    setIsExpanded(false);
  }, [conversationId]);

  const startEdit = () => {
    setDraft(content);
    setIsEditing(true);
    setIsExpanded(true);
  };

  const saveEdit = () => {
    saveBrief(conversationId, draft);
    setContent(draft);
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setDraft('');
  };

  if (!hasBrief && !isEditing) {
    return (
      <button
        onClick={startEdit}
        className="flex items-center gap-2 px-4 py-2 w-full text-left text-[11px] text-[hsl(var(--foreground-subtle))] hover:text-[hsl(var(--primary))] transition-colors border-b border-[hsl(var(--border))]"
      >
        <BookOpen className="h-3.5 w-3.5" />
        <span>Add context brief...</span>
      </button>
    );
  }

  return (
    <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--surface-1))]">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-2">
        <button
          onClick={() => setIsExpanded(e => !e)}
          className="flex items-center gap-2 text-[11px] font-semibold tracking-widest uppercase text-[hsl(var(--violet))] hover:text-[hsl(var(--primary))] transition-colors"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Context Brief
          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        <div className="flex items-center gap-1">
          {isEditing ? (
            <>
              <button onClick={saveEdit} className="p-1 rounded text-[hsl(var(--primary))] hover:bg-[hsl(var(--accent))] transition-colors">
                <Check className="h-3.5 w-3.5" />
              </button>
              <button onClick={cancelEdit} className="p-1 rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <button onClick={startEdit} className="p-1 rounded text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] transition-colors">
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 pb-3">
          {isEditing ? (
            <textarea
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={4}
              className="w-full text-[12px] bg-[hsl(var(--surface-2))] border border-[hsl(var(--border))] rounded-lg p-2
                text-[hsl(var(--foreground-muted))] font-mono resize-none focus:outline-none
                focus:border-[hsl(var(--ring))] focus:ring-1 focus:ring-[hsl(var(--ring)/0.3)]"
              placeholder={"• Revenue discussed: ~€85k\n• Priority: minimize deductions risk\n• Model recommended: hybrid"}
            />
          ) : (
            <div className="text-[12px] text-[hsl(var(--foreground-muted))] whitespace-pre-line leading-relaxed">
              {content}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
