import { Menu, Settings, Sparkles } from "lucide-react";
import { useChatStore, usePersonasStore } from "@/stores";

interface MobileHeaderProps {
  onMenuClick: () => void;
  onSettingsClick: () => void;
  onContextClick: () => void;
}

export function MobileHeader({
  onMenuClick,
  onSettingsClick,
  onContextClick,
}: MobileHeaderProps) {
  const { getCurrentConversation } = useChatStore();
  const { personas } = usePersonasStore();

  const conversation = getCurrentConversation();
  const persona = personas.find((p) => p.id === conversation?.personaId);

  return (
    <header className="flex items-center justify-between h-14 px-4 border-b border-[hsl(var(--border)/0.5)] bg-[hsl(var(--background)/0.95)] backdrop-blur-sm sticky top-0 z-10">
      {/* Left - Menu Button */}
      <button
        onClick={onMenuClick}
        className="h-10 w-10 rounded-xl flex items-center justify-center hover:bg-[hsl(var(--secondary))] transition-colors"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Center - Conversation Title */}
      <div className="flex-1 mx-4 text-center overflow-hidden">
        {conversation ? (
          <div className="flex items-center justify-center gap-2">
            <span className="text-lg">{persona?.icon}</span>
            <span className="font-medium truncate">{conversation.title}</span>
          </div>
        ) : (
          <span className="font-medium text-[hsl(var(--muted-foreground))]">
            Private Assistant
          </span>
        )}
      </div>

      {/* Right - Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={onContextClick}
          className="h-10 w-10 rounded-xl flex items-center justify-center hover:bg-[hsl(var(--secondary))] transition-colors"
        >
          <Sparkles className="h-5 w-5" />
        </button>
        <button
          onClick={onSettingsClick}
          className="h-10 w-10 rounded-xl flex items-center justify-center hover:bg-[hsl(var(--secondary))] transition-colors"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
