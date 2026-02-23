import { useState } from "react";
import { usePersonasStore, useSettingsStore, useChatStore } from "@/stores";
import {
  CreatePersonaDialog,
  CreateContextDialog,
  CreateProjectDialog,
} from "@/components/dialogs";
import { PersonaConfigPage } from "@/components/personas";
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
  ChevronDown,
  LayoutGrid,
  Settings,
  Shield,
} from "lucide-react";
import { PIIProfileCard } from "@/components/profile/PIIProfileCard";

export function ContextPanel() {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"general" | "advanced">("general");

  const [showPersonaDialog, setShowPersonaDialog] = useState(false);
  const [showContextDialog, setShowContextDialog] = useState(false);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [configPersonaId, setConfigPersonaId] = useState<string | null>(null);

  const { personas, selectedPersonaId, selectPersona } = usePersonasStore();
  const { models, getEnabledModels, settings } = useSettingsStore();
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
        className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center h-12 w-6 rounded-l-lg bg-[hsl(var(--card))] hover:bg-[hsl(var(--accent))] border border-r-0 border-[hsl(var(--border)/0.5)] shadow-md transition-all z-20"
      >
        <ChevronLeft className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
      </button>
    );
  }

  return (
    <aside className="relative flex w-80 flex-shrink-0 flex-col bg-[hsl(var(--surface-1))] border-l border-[hsl(var(--border))] h-full transition-all duration-300">
      {/* Header with Tabs */}
      <div className="flex flex-col border-b border-[hsl(var(--border)/0.5)] bg-[hsl(var(--background)/0.3)] backdrop-blur-md">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="font-bold text-[15px] tracking-tight flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-[hsl(var(--primary))]" />
            Context
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex px-4 gap-1 pb-2">
          <TabButton
            active={activeTab === "general"}
            onClick={() => setActiveTab("general")}
            label="General"
          />
          <TabButton
            active={activeTab === "advanced"}
            onClick={() => setActiveTab("advanced")}
            label="Advanced"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin">

        {activeTab === "general" ? (
          <>
            {/* Persona Selection - Collapsible */}
            <CollapsibleSection title="Persona" icon={<Users className="h-3.5 w-3.5" />} defaultOpen dataTour="persona-selector">
              <div className="space-y-1.5">
                {personas.map((persona) => (
                  <div
                    key={persona.id}
                    className={`group relative w-full text-left transition-all duration-200 ${persona.id === selectedPersonaId
                      ? "flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.25)] cursor-pointer transition-all"
                      : "flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[hsl(var(--accent))] transition-colors cursor-pointer"
                      }`}
                  >
                    <button
                      onClick={() => selectPersona(persona.id)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl group-hover:scale-110 transition-transform duration-200">{persona.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium text-sm ${persona.id === selectedPersonaId ? "" : "text-[hsl(var(--foreground))]"}`}>
                              {persona.name}
                            </span>
                            {persona.requiresPIIVault && (
                              <Shield size={12} className="text-green-600 shrink-0" />
                            )}
                          </div>
                          <div className={`text-xs truncate mt-0.5 ${persona.id === selectedPersonaId ? "opacity-80" : "text-[hsl(var(--muted-foreground))]"}`}>
                            {persona.description}
                          </div>
                        </div>
                      </div>
                    </button>
                    {/* Settings button - appears on hover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfigPersonaId(persona.id);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-[hsl(var(--background)/0.5)] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-all"
                      title="Configure persona"
                    >
                      <Settings size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowPersonaDialog(true)}
                className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-[hsl(var(--border))] px-3 py-2.5 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.05)] transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Persona
              </button>
            </CollapsibleSection>

            {/* Project Selection */}
            <CollapsibleSection title="Project" icon={<FolderKanban className="h-3.5 w-3.5" />} defaultOpen>
              <div className="relative">
                <select
                  value={conversation?.projectId || ""}
                  onChange={(e) =>
                    conversation &&
                    moveToProject(conversation.id, e.target.value || null)
                  }
                  disabled={!conversation}
                  className="w-full appearance-none rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5 text-sm disabled:opacity-50 focus:outline-none focus:border-[hsl(var(--ring)/0.5)] focus:ring-2 focus:ring-[hsl(var(--ring)/0.1)] transition-all cursor-pointer shadow-sm hover:border-[hsl(var(--border)/0.8)]"
                >
                  <option value="">No Project (Quick Chat)</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))] pointer-events-none" />
              </div>
              <button
                onClick={() => setShowProjectDialog(true)}
                className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-[hsl(var(--border))] px-3 py-2.5 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.05)] transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
                New Project
              </button>
            </CollapsibleSection>

            {/* Privacy Shield - Moved from absolute/floating to context panel */}
            <CollapsibleSection title="Privacy Shield" icon={<Shield className="h-3.5 w-3.5" />} defaultOpen dataTour="privacy-shield">
              <PIIProfileCard />
            </CollapsibleSection>

          </>
        ) : (
          <>
            {/* Model Selection - Dropdown Style */}
            <CollapsibleSection title="Model Configuration" icon={<Cpu className="h-3.5 w-3.5" />} defaultOpen>
              {/* Local mode indicator */}
              {settings.privacyMode === 'local' && (
                <div className="mb-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[hsl(var(--violet)/0.15)] text-[hsl(var(--violet))] border border-[hsl(var(--violet)/0.3)]">
                    <Shield size={12} />
                    Local Mode — On-device models only
                  </span>
                </div>
              )}
              {settings.privacyMode === 'cloud' && (
                <div className="mb-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))] border border-[hsl(var(--primary)/0.25)]">
                    <Shield size={12} />
                    Cloud Mode — Remote inference
                  </span>
                </div>
              )}
              <div className="relative">
                <select
                  value={selectedModelId}
                  onChange={(e) => conversation && updateConversationModel(conversation.id, e.target.value)}
                  disabled={!conversation}
                  className="w-full appearance-none rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5 text-sm disabled:opacity-50 focus:outline-none focus:border-[hsl(var(--ring)/0.5)] focus:ring-2 focus:ring-[hsl(var(--ring)/0.1)] transition-all cursor-pointer shadow-sm hover:border-[hsl(var(--border)/0.8)]"
                >
                  {enabledModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.provider === 'ollama' ? '🖥️ ' : '☁️ '}{model.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))] pointer-events-none" />
              </div>

              {/* Model Stats - Only show for selected */}
              {selectedModel && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="bg-[hsl(var(--secondary)/0.5)] rounded-lg p-2.5 flex flex-col gap-1 border border-[hsl(var(--border)/0.5)]">
                    <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-semibold">Speed</span>
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      <Zap className="h-3 w-3 text-amber-500" />
                      {selectedModel.speedTier}
                    </div>
                  </div>
                  <div className="bg-[hsl(var(--secondary)/0.5)] rounded-lg p-2.5 flex flex-col gap-1 border border-[hsl(var(--border)/0.5)]">
                    <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-semibold">Cost</span>
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      <Coins className="h-3 w-3 text-[hsl(var(--primary))]" />
                      ${selectedModel.inputCostPer1M}/1M
                    </div>
                  </div>
                </div>
              )}
            </CollapsibleSection>

            {/* Contexts */}
            <CollapsibleSection title="Personal Contexts" icon={<FileText className="h-3.5 w-3.5" />} defaultOpen>
              {contexts.length === 0 ? (
                <div className="rounded-xl bg-[hsl(var(--muted)/0.3)] px-4 py-8 text-center border border-dashed border-[hsl(var(--border))]">
                  <FileText className="h-8 w-8 mx-auto text-[hsl(var(--muted-foreground)/0.3)] mb-2" />
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    No personal contexts yet
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {contexts.map((ctx) => (
                    <label
                      key={ctx.id}
                      className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[hsl(var(--secondary))] transition-colors group border border-transparent hover:border-[hsl(var(--border)/0.5)]"
                    >
                      <input
                        type="checkbox"
                        checked={conversation?.activeContextIds.includes(ctx.id) || false}
                        onChange={() =>
                          conversation &&
                          toggleConversationContext(conversation.id, ctx.id)
                        }
                        disabled={!conversation}
                        className="h-4 w-4 rounded-md border-2 border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--ring))]"
                      />
                      <span className="flex-1 text-sm font-medium group-hover:text-[hsl(var(--foreground))] transition-colors">{ctx.name}</span>
                      <span className="text-[10px] text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] px-2 py-0.5 rounded-full font-mono">
                        {ctx.tokenCount}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <button
                onClick={() => setShowContextDialog(true)}
                className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-[hsl(var(--border))] px-3 py-2.5 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.05)] transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Context
              </button>
            </CollapsibleSection>

            {/* Usage Stats */}
            <CollapsibleSection title="Session Usage" icon={<Clock className="h-3.5 w-3.5" />}>
              <div className="rounded-xl bg-[hsl(var(--muted)/0.3)] p-4 border border-[hsl(var(--border)/0.5)]">
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-[hsl(var(--muted-foreground))]">Context tokens</span>
                    <span className="font-mono font-medium">~2,400</span>
                  </div>
                  <div className="w-full h-px bg-[hsl(var(--border)/0.5)]" />
                  <div className="flex justify-between items-center">
                    <span className="text-[hsl(var(--muted-foreground))]">Cost per message</span>
                    <span className="font-mono font-bold text-[hsl(var(--primary))]">
                      ~${selectedModel ? ((2400 / 1_000_000) * selectedModel.inputCostPer1M).toFixed(5) : "0.00000"}
                    </span>
                  </div>
                </div>
              </div>
            </CollapsibleSection>
          </>
        )}
      </div>

      {/* Privacy mode is now controlled via pills in the chat input */}

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

      {/* Persona Configuration Page */}
      {configPersonaId && (
        <PersonaConfigPage
          personaId={configPersonaId}
          onClose={() => setConfigPersonaId(null)}
        />
      )}
    </aside>
  );
}

// Subcomponents

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${active
        ? "bg-[hsl(var(--background))] text-[hsl(var(--foreground))] shadow-sm ring-1 ring-black/5"
        : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary)/0.5)] hover:text-[hsl(var(--foreground))]"
        }`}
    >
      {label}
    </button>
  )
}

function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen = false,
  dataTour,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  dataTour?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card)/0.4)] rounded-2xl overflow-hidden transition-all duration-200" data-tour={dataTour}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3.5 hover:bg-[hsl(var(--secondary)/0.3)] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          {icon && <span className="text-[hsl(var(--muted-foreground))]">{icon}</span>}
          <span className="text-[11px] font-semibold tracking-widest uppercase text-[hsl(var(--foreground-subtle))]">{title}</span>
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="p-3.5 pt-0 border-t border-[hsl(var(--border)/0.3)] animate-fade-in">
          <div className="pt-3">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
