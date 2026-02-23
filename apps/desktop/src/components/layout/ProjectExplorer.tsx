import { useState } from 'react';
import { FolderOpen, Folder, MessageSquare, FileText, ChevronRight, Plus, MessageCirclePlus } from 'lucide-react';
import { useChatStore, useCanvasStore } from '@/stores';
import { usePersonasStore } from '@/stores';

export function ProjectExplorer() {
  const { projects, conversations, selectConversation, createConversation, createProject } = useChatStore();
  const { documents, openPanel, streamingDocId } = useCanvasStore();
  const { selectedPersonaId } = usePersonasStore();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedConvs, setExpandedConvs] = useState<Set<string>>(new Set());

  const toggleConv = (id: string) =>
    setExpandedConvs(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleNewChatInProject = async (projectId: string) => {
    const personaId = selectedPersonaId || 'psychologist';
    const convId = await createConversation(personaId, 'Qwen/Qwen3-235B-A22B', projectId);
    // Expand the project so the new chat is visible
    setExpanded(prev => new Set(prev).add(projectId));
    if (convId) selectConversation(convId as string);
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    const colors = ['#38bdf8', '#a78bfa', '#34d399', '#fb923c', '#f472b6'];
    const color = colors[projects.length % colors.length];
    const id = await createProject(newProjectName.trim(), '', color);
    setNewProjectName('');
    setCreatingProject(false);
    if (id) setExpanded(prev => new Set(prev).add(id as string));
  };

  const emptyState = (
    <div className="px-2 py-3">
      <div className="flex items-center justify-between px-2 mb-2">
        <span className="text-[11px] font-semibold tracking-widest uppercase text-[hsl(var(--foreground-subtle))]">
          Projects
        </span>
      </div>
      <div className="px-2 py-2 space-y-1.5">
        {['Q1 Tax Preparation', 'Career Planning'].map(label => (
          <div key={label} className="flex items-center gap-2 px-2 py-1.5 rounded-lg opacity-25 pointer-events-none">
            <Folder className="h-4 w-4 flex-shrink-0 text-[hsl(var(--foreground-subtle))]" />
            <span className="text-[12px] text-[hsl(var(--foreground-subtle))] italic">{label}</span>
          </div>
        ))}
        {creatingProject ? (
          <form
            onSubmit={e => { e.preventDefault(); handleCreateProject(); }}
            className="flex items-center gap-1"
          >
            <input
              autoFocus
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              onKeyDown={e => e.key === 'Escape' && setCreatingProject(false)}
              placeholder="Project name…"
              className="flex-1 text-[12px] bg-[hsl(var(--surface-2))] border border-[hsl(var(--ring)/0.5)] rounded-lg px-2 py-1 text-[hsl(var(--foreground))] outline-none placeholder:text-[hsl(var(--foreground-subtle))]"
            />
            <button type="submit" className="text-[11px] px-2 py-1 rounded-lg bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.25)] transition-colors">
              Add
            </button>
          </form>
        ) : (
          <button
            onClick={() => setCreatingProject(true)}
            className="w-full mt-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg
              border border-dashed border-[hsl(var(--border))] text-[11px] text-[hsl(var(--foreground-subtle))]
              hover:border-[hsl(var(--primary)/0.4)] hover:text-[hsl(var(--primary))] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Create your first project
          </button>
        )}
      </div>
    </div>
  );

  if (projects.length === 0) return emptyState;

  return (
    <div className="px-2 py-3">
      {/* Header */}
      <div className="flex items-center justify-between px-2 mb-2">
        <span className="text-[11px] font-semibold tracking-widest uppercase text-[hsl(var(--foreground-subtle))]">
          Projects
        </span>
        <button
          onClick={() => setCreatingProject(v => !v)}
          className="p-1 rounded-md text-[hsl(var(--foreground-subtle))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] transition-colors"
          title="New project"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Inline new-project form */}
      {creatingProject && (
        <form
          onSubmit={e => { e.preventDefault(); handleCreateProject(); }}
          className="flex items-center gap-1 px-2 mb-2"
        >
          <input
            autoFocus
            value={newProjectName}
            onChange={e => setNewProjectName(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && setCreatingProject(false)}
            placeholder="Project name…"
            className="flex-1 text-[12px] bg-[hsl(var(--surface-2))] border border-[hsl(var(--ring)/0.5)] rounded-lg px-2 py-1 text-[hsl(var(--foreground))] outline-none placeholder:text-[hsl(var(--foreground-subtle))]"
          />
          <button type="submit" className="text-[11px] px-2 py-1 rounded-lg bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.25)] transition-colors">
            Add
          </button>
        </form>
      )}

      {projects.map(project => {
        const isExpanded = expanded.has(project.id);
        const projectChats = conversations.filter(c => c.projectId === project.id);
        // Docs not attached to a specific conversation (project-level)
        const projectDocs = documents.filter(d => d.projectId === project.id && !d.conversationId);
        const hasChildren = projectChats.length > 0 || projectDocs.length > 0;

        return (
          <div key={project.id} className="mb-0.5">
            {/* Project row */}
            <div className="group flex items-center gap-1">
              <button
                onClick={() => toggle(project.id)}
                className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left
                  text-[13px] font-medium text-[hsl(var(--foreground-muted))]
                  hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]
                  transition-colors min-w-0"
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

              {/* New chat in project — visible on row hover */}
              <button
                onClick={() => handleNewChatInProject(project.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded-md flex-shrink-0
                  text-[hsl(var(--foreground-subtle))] hover:text-[hsl(var(--primary))]
                  hover:bg-[hsl(var(--accent))] transition-all"
                title={`New chat in ${project.name}`}
              >
                <MessageCirclePlus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Children */}
            {isExpanded && (
              <div className="ml-5 border-l border-[hsl(var(--border))] pl-2 mt-0.5 space-y-0.5">
                {projectChats.map(chat => {
                  const chatDocs = documents.filter(d => d.conversationId === chat.id);
                  const isConvExpanded = expandedConvs.has(chat.id);
                  return (
                    <div key={chat.id}>
                      <div className="flex items-center gap-0.5">
                        {chatDocs.length > 0 && (
                          <button
                            onClick={() => toggleConv(chat.id)}
                            className="flex-shrink-0 p-0.5 rounded text-[hsl(var(--foreground-subtle))] hover:text-[hsl(var(--foreground))] transition-colors"
                          >
                            <ChevronRight
                              className="h-3 w-3"
                              style={{ transform: isConvExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms' }}
                            />
                          </button>
                        )}
                        {chatDocs.length === 0 && <span className="w-4 flex-shrink-0" />}
                        <button
                          onClick={() => selectConversation(chat.id)}
                          className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg text-left
                            text-[12px] text-[hsl(var(--foreground-subtle))]
                            hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]
                            transition-colors min-w-0"
                        >
                          <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 text-[hsl(var(--foreground-subtle))]" />
                          <span className="truncate">{chat.title}</span>
                        </button>
                      </div>
                      {isConvExpanded && chatDocs.length > 0 && (
                        <div className="ml-6 border-l border-[hsl(var(--border))] pl-2 space-y-0.5 mt-0.5 mb-1">
                          {chatDocs.map(doc => {
                            const isStreaming = streamingDocId === doc.id;
                            return (
                              <button
                                key={doc.id}
                                onClick={() => openPanel(doc.id)}
                                className="w-full flex items-center gap-2 px-2 py-1 rounded-lg text-left
                                  text-[11.5px] text-[hsl(var(--foreground-subtle))]
                                  hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]
                                  transition-colors"
                              >
                                <FileText className={`h-3 w-3 flex-shrink-0 text-[hsl(var(--violet))] ${isStreaming ? 'animate-pulse' : ''}`} />
                                <span className="truncate">{doc.title}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

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
                        className={`h-3.5 w-3.5 flex-shrink-0 transition-all text-[hsl(var(--violet))] ${isStreaming ? 'animate-pulse' : ''}`}
                        style={isStreaming ? { filter: 'drop-shadow(0 0 6px hsl(267 84% 71% / 0.8))' } : undefined}
                      />
                      <span className="truncate">{doc.title}</span>
                      {isStreaming && (
                        <span className="ml-auto text-[10px] text-[hsl(var(--violet))] animate-pulse flex-shrink-0">writing…</span>
                      )}
                    </button>
                  );
                })}

                {/* "New chat here" shortcut at bottom of children */}
                <button
                  onClick={() => handleNewChatInProject(project.id)}
                  className="w-full flex items-center gap-2 px-2 py-1 rounded-lg text-left
                    text-[11px] text-[hsl(var(--foreground-subtle))]
                    hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--accent))]
                    transition-colors border border-dashed border-transparent hover:border-[hsl(var(--primary)/0.2)]"
                >
                  <Plus className="h-3 w-3 flex-shrink-0" />
                  New chat
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
