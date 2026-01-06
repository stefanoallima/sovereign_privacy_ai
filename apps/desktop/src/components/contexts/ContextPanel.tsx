import { useState } from "react";
import { usePersonasStore, useSettingsStore, useChatStore } from "@/stores";
import {
  CreatePersonaDialog,
  CreateContextDialog,
  CreateProjectDialog,
} from "@/components/dialogs";
import {
  ChevronLeft,
  ChevronRight,
  Users,
  FolderKanban,
  FileText,
  Cpu,
  Plus,
  Zap,
  Clock,
  Coins,
} from "lucide-react";

export function ContextPanel() {
  const [isOpen, setIsOpen] = useState(true);
  const [showPersonaDialog, setShowPersonaDialog] = useState(false);
  const [showContextDialog, setShowContextDialog] = useState(false);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const { personas, selectedPersonaId, selectPersona } = usePersonasStore();
  const { models, getEnabledModels } = useSettingsStore();
  const {
    contexts,
    projects,
    getCurrentConversation,
    updateConversationModel,
    toggleConversationContext,
    moveToProject,
  } = useChatStore();

  const conversation = getCurrentConversation();
  const enabledModels = getEnabledModels();
  const selectedModelId = conversation?.modelId || enabledModels[0]?.id;
  const selectedModel = models.find((m) => m.id === selectedModelId);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center h-12 w-6 rounded-l-lg bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--accent))] border border-r-0 border-[hsl(var(--border)/0.5)] shadow-md transition-all"
      >
        <ChevronLeft className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
      </button>
    );
  }

  return (
    <aside className="flex w-72 flex-col border-l border-[hsl(var(--border)/0.5)] glass">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[hsl(var(--border)/0.5)] px-5 py-4">
        <h2 className="font-semibold text-[15px]">Context</h2>
        <button
          onClick={() => setIsOpen(false)}
          className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Persona Selection */}
        <Section title="Persona" icon={<Users className="h-3.5 w-3.5" />}>
          <div className="space-y-1.5">
            {personas.map((persona) => (
              <button
                key={persona.id}
                onClick={() => selectPersona(persona.id)}
                className={`group w-full rounded-xl px-3 py-3 text-left transition-all ${
                  persona.id === selectedPersonaId
                    ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] shadow-sm"
                    : "hover:bg-[hsl(var(--secondary))]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl group-hover:scale-110 transition-transform">{persona.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium text-sm ${persona.id === selectedPersonaId ? "" : "text-[hsl(var(--foreground))]"}`}>
                      {persona.name}
                    </div>
                    <div className={`text-xs truncate mt-0.5 ${persona.id === selectedPersonaId ? "opacity-80" : "text-[hsl(var(--muted-foreground))]"}`}>
                      {persona.description}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowPersonaDialog(true)}
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-[hsl(var(--border))] px-3 py-2.5 text-sm text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.05)] transition-all"
          >
            <Plus className="h-4 w-4" />
            Create Persona
          </button>
        </Section>

        {/* Project Selection */}
        <Section title="Project" icon={<FolderKanban className="h-3.5 w-3.5" />}>
          <select
            value={conversation?.projectId || ""}
            onChange={(e) =>
              conversation &&
              moveToProject(conversation.id, e.target.value || null)
            }
            disabled={!conversation}
            className="w-full rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--background)/0.5)] px-4 py-3 text-sm disabled:opacity-50 focus:outline-none focus:border-[hsl(var(--ring)/0.5)] transition-all cursor-pointer"
          >
            <option value="">No Project (Quick Chat)</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowProjectDialog(true)}
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-[hsl(var(--border))] px-3 py-2.5 text-sm text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.05)] transition-all"
          >
            <Plus className="h-4 w-4" />
            Create Project
          </button>
        </Section>

        {/* Personal Contexts */}
        <Section title="Personal Contexts" icon={<FileText className="h-3.5 w-3.5" />}>
          {contexts.length === 0 ? (
            <div className="rounded-xl bg-[hsl(var(--muted)/0.3)] px-4 py-6 text-center">
              <FileText className="h-6 w-6 mx-auto text-[hsl(var(--muted-foreground)/0.5)] mb-2" />
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                No personal contexts yet
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {contexts.map((ctx) => (
                <label
                  key={ctx.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[hsl(var(--secondary))] transition-colors group"
                >
                  <input
                    type="checkbox"
                    checked={conversation?.activeContextIds.includes(ctx.id) || false}
                    onChange={() =>
                      conversation &&
                      toggleConversationContext(conversation.id, ctx.id)
                    }
                    disabled={!conversation}
                    className="h-4 w-4 rounded-md border-2 border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--ring))] focus:ring-offset-0"
                  />
                  <span className="flex-1 text-sm font-medium group-hover:text-[hsl(var(--foreground))] transition-colors">{ctx.name}</span>
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] px-2 py-0.5 rounded-full">
                    {ctx.tokenCount}
                  </span>
                </label>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowContextDialog(true)}
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-[hsl(var(--border))] px-3 py-2.5 text-sm text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.05)] transition-all"
          >
            <Plus className="h-4 w-4" />
            Add Context
          </button>
        </Section>

        {/* Model Selection */}
        <Section title="Model" icon={<Cpu className="h-3.5 w-3.5" />}>
          <div className="space-y-1.5">
            {enabledModels.map((model) => (
              <button
                key={model.id}
                onClick={() =>
                  conversation && updateConversationModel(conversation.id, model.id)
                }
                disabled={!conversation}
                className={`w-full rounded-xl px-3 py-3 text-left transition-all disabled:opacity-50 ${
                  model.id === selectedModelId
                    ? "bg-[hsl(var(--accent))] ring-1 ring-[hsl(var(--primary)/0.5)] shadow-sm"
                    : "hover:bg-[hsl(var(--secondary))]"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-medium text-sm">{model.name}</span>
                  <span className="text-[10px] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] px-2 py-0.5 rounded-full">
                    {model.contextWindow / 1000}K
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-[hsl(var(--muted-foreground))]">
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    {model.speedTier}
                  </span>
                  <span className="flex items-center gap-1">
                    <Coins className="h-3 w-3" />
                    ${model.inputCostPer1M}/1M
                  </span>
                </div>
              </button>
            ))}
          </div>
        </Section>
      </div>

      {/* Footer - Token Estimate */}
      <div className="border-t border-[hsl(var(--border)/0.5)] p-4">
        <div className="rounded-xl bg-[hsl(var(--muted)/0.3)] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Estimated Usage</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[hsl(var(--muted-foreground))]">Context tokens</span>
              <span className="font-medium">~2,400</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[hsl(var(--muted-foreground))]">Cost per message</span>
              <span className="font-medium text-[hsl(var(--primary))]">
                ~${selectedModel ? ((2400 / 1_000_000) * selectedModel.inputCostPer1M).toFixed(5) : "0.00000"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <CreatePersonaDialog
        isOpen={showPersonaDialog}
        onClose={() => setShowPersonaDialog(false)}
      />
      <CreateContextDialog
        isOpen={showContextDialog}
        onClose={() => setShowContextDialog(false)}
      />
      <CreateProjectDialog
        isOpen={showProjectDialog}
        onClose={() => setShowProjectDialog(false)}
      />
    </aside>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 px-1">
        {icon && <span className="text-[hsl(var(--muted-foreground))]">{icon}</span>}
        <h3 className="text-[11px] font-semibold uppercase text-[hsl(var(--muted-foreground))] tracking-wider">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}
