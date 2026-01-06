import { useState } from "react";
import { ApiSettings } from "./ApiSettings";
import { ModelSettings } from "./ModelSettings";
import { AppearanceSettings } from "./AppearanceSettings";
import { PersonaSettings } from "./PersonaSettings";
import { KnowledgeBaseSettings } from "./KnowledgeBaseSettings";
import { SharedContextSettings } from "./SharedContextSettings";

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabId = "api" | "models" | "personas" | "knowledge" | "context" | "appearance";

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<TabId>("api");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-4xl rounded-lg bg-[hsl(var(--card))] shadow-xl flex h-[80vh] overflow-hidden">
        {/* Sidebar Navigation */}
        <div className="w-64 border-r border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] flex flex-col">
          <div className="p-6 border-b border-[hsl(var(--border))]">
            <h2 className="text-lg font-semibold">Settings</h2>
          </div>

          <nav className="p-2 space-y-1 flex-1 overflow-y-auto">
            <TabButton label="API Configuration" active={activeTab === "api"} onClick={() => setActiveTab("api")} icon={<ApiIcon />} />
            <TabButton label="Models" active={activeTab === "models"} onClick={() => setActiveTab("models")} icon={<ModelIcon />} />
            <div className="my-2 border-t border-[hsl(var(--border))]" />
            <TabButton label="Personas" active={activeTab === "personas"} onClick={() => setActiveTab("personas")} icon={<PersonaIcon />} />
            <TabButton label="Knowledge Bases" active={activeTab === "knowledge"} onClick={() => setActiveTab("knowledge")} icon={<DatabaseIcon />} />
            <TabButton label="Shared Context" active={activeTab === "context"} onClick={() => setActiveTab("context")} icon={<FileTextIcon />} />
            <div className="my-2 border-t border-[hsl(var(--border))]" />
            <TabButton label="Appearance" active={activeTab === "appearance"} onClick={() => setActiveTab("appearance")} icon={<PaletteIcon />} />
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile-ish Header (Close button) */}
          <div className="flex justify-end p-4 border-b border-[hsl(var(--border))]">
            <button
              onClick={onClose}
              className="rounded-full p-2 hover:bg-[hsl(var(--accent))] transition-colors"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-2xl mx-auto">
              {activeTab === "api" && <ApiSettings />}
              {activeTab === "models" && <ModelSettings />}
              {activeTab === "personas" && <PersonaSettings />}
              {activeTab === "knowledge" && <KnowledgeBaseSettings />}
              {activeTab === "context" && <SharedContextSettings />}
              {activeTab === "appearance" && <AppearanceSettings />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({ label, active, onClick, icon }: { label: string, active: boolean, onClick: () => void, icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${active
          ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
          : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
        }`}
    >
      {icon}
      {label}
    </button>
  )
}

// Icons
function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function ApiIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a10 10 0 1 0 10 10 10 10 0 0 0-10-10Z" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  )
}

function ModelIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" cy="2" />
      <path d="M7 7h10" />
      <path d="M7 12h10" />
      <path d="M7 17h10" />
    </svg>
  )
}

function PersonaIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function DatabaseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  )
}

function FileTextIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" x2="8" y1="13" y2="13" />
      <line x1="16" x2="8" y1="17" y2="17" />
      <line x1="10" x2="8" y1="9" y2="9" />
    </svg>
  )
}

function PaletteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13.5" cy="6.5" r=".5" />
      <circle cx="17.5" cy="10.5" r=".5" />
      <circle cx="8.5" cy="7.5" r=".5" />
      <circle cx="6.5" cy="12.5" r=".5" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
    </svg>
  )
}
