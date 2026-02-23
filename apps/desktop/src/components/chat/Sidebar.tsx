import { useState, useRef, useEffect } from "react";
import { useChatStore, usePersonasStore } from "@/stores";
import { useWizardStore } from "@/stores/wizard";
import { ProjectExplorer } from "@/components/layout/ProjectExplorer";
import {
  MessageSquare,
  Plus,
  Search,
  ChevronDown,
  Settings,
  Pencil,
  Trash2,
  Bot,
  EyeOff,
  Wand2,
  Compass,
  LifeBuoy,
} from "lucide-react";
import { useAppTour } from "@/hooks/useAppTour";

interface SidebarProps {
  onSettingsClick: () => void;
  onSupportClick: () => void;
}

export function Sidebar({ onSettingsClick, onSupportClick }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const {
    conversations,
    projects,
    currentConversationId,
    selectConversation,
    createConversation,
    deleteConversation,
    updateConversationTitle,
  } = useChatStore();

  const { selectedPersonaId } = usePersonasStore();
  const { resetWizard } = useWizardStore();
  const { startTour } = useAppTour();

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const handleEditStart = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditTitle(currentTitle);
  };

  const handleEditSave = async () => {
    if (editingId && editTitle.trim()) {
      await updateConversationTitle(editingId, editTitle.trim());
      setEditingId(null);
    }
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditTitle("");
  };

  const handleNewChat = async () => {
    await createConversation(selectedPersonaId || "psychologist", "Qwen/Qwen3-235B-A22B");
  };

  const handleNewIncognitoChat = async () => {
    await createConversation(selectedPersonaId || "psychologist", "Qwen/Qwen3-235B-A22B", undefined, true);
  };

  // Filter conversations by search query
  const filteredConversations = conversations.filter((conv) =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Separate incognito, quick chats, and project chats
  const incognitoChats = filteredConversations.filter((conv) => conv.isIncognito);
  const quickChats = filteredConversations.filter((conv) => !conv.projectId && !conv.isIncognito);

  // Group conversations by project
  const projectChats = projects.map((project) => ({
    project,
    conversations: filteredConversations.filter((conv) => conv.projectId === project.id),
  })).filter(({ conversations: convs }) => convs.length > 0);

  return (
    <aside className="flex w-72 flex-col h-full bg-[hsl(var(--surface-1))] border-r border-[hsl(var(--border))]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border)/0.5)]">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(162_78%_50%)] text-white shadow-sm">
            <Bot className="h-4 w-4" />
          </div>
          <span className="font-semibold text-[15px]">Chats</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNewIncognitoChat}
            data-tour="new-incognito"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--secondary))] hover:bg-purple-500/20 text-[hsl(var(--muted-foreground))] hover:text-purple-400 transition-all active:scale-95"
            title="New incognito chat"
          >
            <EyeOff className="h-4 w-4" />
          </button>
          <button
            onClick={handleNewChat}
            data-tour="new-chat"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--accent-foreground))] transition-all active:scale-95"
            title="New chat"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground)/0.5)]" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--background)/0.5)] py-2.5 pl-10 pr-4 text-sm placeholder:text-[hsl(var(--muted-foreground)/0.5)] focus:bg-[hsl(var(--background))] focus:border-[hsl(var(--ring)/0.5)] focus:outline-none transition-all"
          />
        </div>
      </div>

      {/* Project Explorer */}
      <ProjectExplorer />
      <div className="border-t border-[hsl(var(--border))] my-1" />

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-6" data-tour="conversations">
        {/* Incognito Chats Section */}
        {incognitoChats.length > 0 && (
          <div>
            <SectionHeader
              title="Incognito"
              count={incognitoChats.length}
              isCollapsed={collapsedSections.has("incognito")}
              onToggle={() => toggleSection("incognito")}
            />
            {!collapsedSections.has("incognito") && (
              <div className="space-y-1 mt-2">
                {incognitoChats.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    title={conv.title}
                    isActive={conv.id === currentConversationId}
                    isEditing={false}
                    editValue=""
                    onEditChange={() => {}}
                    onEditSave={() => {}}
                    onEditCancel={() => {}}
                    onEditStart={() => {}}
                    onClick={() => selectConversation(conv.id)}
                    onDelete={() => void deleteConversation(conv.id)}
                    isIncognito
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quick Chats Section */}
        {(quickChats.length > 0 || !searchQuery) && (
          <div>
            <SectionHeader
              title="Recent Chats"
              count={quickChats.length}
              isCollapsed={collapsedSections.has("quick")}
              onToggle={() => toggleSection("quick")}
            />
            {!collapsedSections.has("quick") && (
              <div className="space-y-1 mt-2">
                {quickChats.length > 0 ? (
                  quickChats.map((conv) => (
                    <ConversationItem
                      key={conv.id}
                      title={conv.title}
                      isActive={conv.id === currentConversationId}
                      isEditing={editingId === conv.id}
                      editValue={editTitle}
                      onEditChange={setEditTitle}
                      onEditSave={handleEditSave}
                      onEditCancel={handleEditCancel}
                      onEditStart={() => handleEditStart(conv.id, conv.title)}
                      onClick={() => selectConversation(conv.id)}
                      onDelete={() => void deleteConversation(conv.id)}
                    />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 px-4">
                    <div className="h-10 w-10 rounded-xl bg-[hsl(var(--muted)/0.5)] flex items-center justify-center mb-3">
                      <MessageSquare className="h-5 w-5 text-[hsl(var(--muted-foreground)/0.5)]" />
                    </div>
                    <p className="text-xs text-[hsl(var(--muted-foreground)/0.7)] text-center">
                      No conversations yet
                    </p>
                    <p className="text-[11px] text-[hsl(var(--muted-foreground)/0.5)] text-center mt-1">
                      Start a new chat to begin
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Projects */}
        {projectChats.map(({ project, conversations: projConvs }) => (
          <div key={project.id}>
            <SectionHeader
              title={project.name}
              count={projConvs.length}
              isCollapsed={collapsedSections.has(project.id)}
              onToggle={() => toggleSection(project.id)}
            />
            {!collapsedSections.has(project.id) && (
              <div className="space-y-1 mt-2">
                {projConvs.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    title={conv.title}
                    isActive={conv.id === currentConversationId}
                    isEditing={editingId === conv.id}
                    editValue={editTitle}
                    onEditChange={setEditTitle}
                    onEditSave={handleEditSave}
                    onEditCancel={handleEditCancel}
                    onEditStart={() => handleEditStart(conv.id, conv.title)}
                    onClick={() => selectConversation(conv.id)}
                    onDelete={() => void deleteConversation(conv.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Search empty state */}
        {searchQuery && filteredConversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <Search className="h-8 w-8 text-[hsl(var(--muted-foreground)/0.3)] mb-3" />
            <p className="text-sm text-[hsl(var(--muted-foreground)/0.7)]">
              No conversations found
            </p>
            <p className="text-xs text-[hsl(var(--muted-foreground)/0.5)] mt-1">
              Try a different search term
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-[hsl(var(--border)/0.5)] space-y-1">
        <button
          onClick={() => startTour()}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--primary)/0.1)] hover:text-[hsl(var(--primary))] transition-all group"
        >
          <Compass className="h-4 w-4 group-hover:rotate-45 transition-transform duration-300" />
          <span className="font-medium">App Tour</span>
        </button>
        <button
          onClick={() => resetWizard()}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--primary)/0.1)] hover:text-[hsl(var(--primary))] transition-all group"
        >
          <Wand2 className="h-4 w-4 group-hover:rotate-12 transition-transform duration-300" />
          <span className="font-medium">Settings Assistant</span>
        </button>
        <button
          onClick={onSupportClick}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-[hsl(var(--muted-foreground))] hover:bg-orange-500/10 hover:text-orange-500 transition-all group"
        >
          <LifeBuoy className="h-4 w-4 group-hover:rotate-45 transition-transform duration-300" />
          <span className="font-medium">Support</span>
        </button>
        <button
          onClick={onSettingsClick}
          data-tour="settings-btn"
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))] transition-all group"
        >
          <Settings className="h-4 w-4 group-hover:rotate-45 transition-transform duration-300" />
          <span className="font-medium">Settings</span>
        </button>
      </div>
    </aside>
  );
}

function SectionHeader({
  title,
  count,
  isCollapsed,
  onToggle,
}: {
  title: string;
  count: number;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full px-3 py-2 flex items-center justify-between group rounded-lg hover:bg-[hsl(var(--secondary)/0.5)] transition-colors"
    >
      <span className="px-2 mb-1 text-[11px] font-semibold tracking-widest uppercase text-[hsl(var(--foreground-subtle))]">
        {title}
      </span>
      <div className="flex items-center gap-2">
        {count > 0 && (
          <span className="text-[10px] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] px-2 py-0.5 rounded-full font-medium">
            {count}
          </span>
        )}
        <ChevronDown
          className={`h-3.5 w-3.5 text-[hsl(var(--muted-foreground)/0.5)] transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""
            }`}
        />
      </div>
    </button>
  );
}

function ConversationItem({
  title,
  isActive,
  isEditing,
  editValue,
  onEditChange,
  onEditSave,
  onEditCancel,
  onEditStart,
  onClick,
  onDelete,
  isIncognito,
}: {
  title: string;
  isActive: boolean;
  isEditing: boolean;
  editValue: string;
  onEditChange: (val: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onEditStart: () => void;
  onClick: () => void;
  onDelete: () => void;
  isIncognito?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onEditSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onEditCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="relative flex items-center rounded-xl bg-[hsl(var(--background))] px-3 py-2.5 ring-2 ring-[hsl(var(--ring))]">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => onEditChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={onEditSave}
          className="w-full bg-transparent text-sm focus:outline-none"
        />
      </div>
    );
  }

  return (
    <div
      className={`group relative flex items-center rounded-lg transition-all cursor-pointer ${
        isIncognito ? "border border-dashed border-purple-500/30 " : ""
      }${isActive
          ? isIncognito
            ? "bg-purple-500/15 text-[hsl(var(--accent-foreground))] shadow-sm"
            : "bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))] font-medium"
          : "text-[hsl(var(--foreground-subtle))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
        }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3 flex-1 px-3 py-2.5 pr-16">
        {isIncognito ? (
          <EyeOff className={`h-4 w-4 flex-shrink-0 text-purple-400`} />
        ) : (
          <MessageSquare className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-[hsl(var(--primary))]" : ""}`} />
        )}
        <span className="text-sm truncate font-medium">{title}</span>
      </div>

      {/* Hover Actions */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
        {!isIncognito && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditStart();
            }}
            className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            title="Rename"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[hsl(var(--destructive)/0.1)] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] transition-colors"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
