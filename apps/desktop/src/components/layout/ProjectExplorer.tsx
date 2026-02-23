import { useState } from 'react';
import { FolderOpen, Folder, MessageSquare, FileText, ChevronRight, Plus } from 'lucide-react';
import { useChatStore, useCanvasStore } from '@/stores';

export function ProjectExplorer() {
  const { projects, conversations, selectConversation } = useChatStore();
  const { documents, openPanel, streamingDocId } = useCanvasStore();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  if (projects.length === 0) {
    return (
      <div className="px-2 py-3">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-[11px] font-semibold tracking-widest uppercase text-[hsl(var(--foreground-subtle))]">
            Projects
          </span>
        </div>
        <div className="px-2 py-2 space-y-1.5">
          {[
            { icon: '📁', label: 'Q1 Tax Preparation' },
            { icon: '📁', label: 'Career Planning' },
          ].map(ghost => (
            <div
              key={ghost.label}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg opacity-25 pointer-events-none"
            >
              <span className="text-sm">{ghost.icon}</span>
              <span className="text-[12px] text-[hsl(var(--foreground-subtle))] italic">{ghost.label}</span>
            </div>
          ))}
          <button
            className="w-full mt-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg
              border border-dashed border-[hsl(var(--border))] text-[11px] text-[hsl(var(--foreground-subtle))]
              hover:border-[hsl(var(--primary)/0.4)] hover:text-[hsl(var(--primary))] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Create your first project
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 py-3">
      {/* Header */}
      <div className="flex items-center justify-between px-2 mb-2">
        <span className="text-[11px] font-semibold tracking-widest uppercase text-[hsl(var(--foreground-subtle))]">
          Projects
        </span>
      </div>

      {projects.map(project => {
        const isExpanded = expanded.has(project.id);
        const projectChats = conversations.filter(c => c.projectId === project.id);
        const projectDocs = documents.filter(d => d.projectId === project.id);
        const hasChildren = projectChats.length > 0 || projectDocs.length > 0;

        return (
          <div key={project.id} className="mb-0.5">
            {/* Project row */}
            <button
              onClick={() => toggle(project.id)}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left
                text-[13px] font-medium text-[hsl(var(--foreground-muted))]
                hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]
                transition-colors"
            >
              {hasChildren ? (
                <ChevronRight
                  className="h-3 w-3 flex-shrink-0 text-[hsl(var(--foreground-subtle))]"
                  style={{
                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
              ) : (
                <span className="w-3 flex-shrink-0" />
              )}
              {isExpanded
                ? <FolderOpen className="h-4 w-4 flex-shrink-0" style={{ color: project.color ?? 'hsl(var(--primary))' }} />
                : <Folder className="h-4 w-4 flex-shrink-0" style={{ color: project.color ?? 'hsl(var(--primary))' }} />
              }
              <span className="truncate">{project.name}</span>
            </button>

            {/* Children */}
            {isExpanded && (
              <div className="ml-5 border-l border-[hsl(var(--border))] pl-2 mt-0.5 space-y-0.5">
                {projectChats.map(chat => (
                  <button
                    key={chat.id}
                    onClick={() => selectConversation(chat.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left
                      text-[12px] text-[hsl(var(--foreground-subtle))]
                      hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]
                      transition-colors"
                  >
                    <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 text-[hsl(var(--muted-foreground))]" />
                    <span className="truncate">{chat.title}</span>
                  </button>
                ))}

                {projectDocs.map(doc => {
                  const isStreaming = streamingDocId === doc.id;
                  return (
                    <button
                      key={doc.id}
                      onClick={() => openPanel(doc.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left
                        text-[12px] text-[hsl(var(--foreground-subtle))]
                        hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]
                        transition-colors"
                    >
                      <FileText
                        className={`h-3.5 w-3.5 flex-shrink-0 transition-all ${
                          isStreaming
                            ? 'text-[hsl(var(--violet))] animate-pulse'
                            : 'text-[hsl(var(--violet))]'
                        }`}
                        style={isStreaming ? { filter: 'drop-shadow(0 0 6px hsl(267 84% 71% / 0.8))' } : undefined}
                      />
                      <span className="truncate">{doc.title}</span>
                      {isStreaming && (
                        <span className="ml-auto text-[10px] text-[hsl(var(--violet))] animate-pulse flex-shrink-0">writing…</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
