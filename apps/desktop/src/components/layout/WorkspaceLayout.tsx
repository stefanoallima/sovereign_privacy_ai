import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { useCanvasStore } from '@/stores';
import { CanvasPanel } from '@/components/chat/CanvasPanel';

interface WorkspaceLayoutProps {
  sidebar: React.ReactNode;
  chat: React.ReactNode;
  contextPanel: React.ReactNode;
}

export function WorkspaceLayout({ sidebar, chat, contextPanel }: WorkspaceLayoutProps) {
  const { isPanelOpen } = useCanvasStore();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[hsl(var(--background))]">
      {/* Left: Project Explorer — fixed width, not resizable */}
      <div className="flex-shrink-0 h-full">
        {sidebar}
      </div>

      {/* Center: Chat + (optional) Canvas — resizable */}
      <div className="flex flex-1 overflow-hidden min-w-0">
        {isPanelOpen ? (
          <PanelGroup orientation="horizontal" className="flex-1">
            {/* Chat panel — min 20%, default 55% */}
            <Panel defaultSize={55} minSize={20} className="flex flex-col overflow-hidden">
              {chat}
            </Panel>

            {/* Drag handle */}
            <PanelResizeHandle className="w-1 bg-transparent hover:bg-[hsl(var(--primary)/0.4)] active:bg-[hsl(var(--primary)/0.6)] transition-colors cursor-col-resize group relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-[hsl(var(--border))] group-hover:bg-[hsl(var(--primary)/0.6)] transition-colors" />
            </PanelResizeHandle>

            {/* Canvas panel — min 25%, default 45% */}
            <Panel defaultSize={45} minSize={25} className="flex flex-col overflow-hidden">
              <CanvasPanel />
            </Panel>
          </PanelGroup>
        ) : (
          <main className="flex flex-1 flex-col overflow-hidden">
            {chat}
          </main>
        )}
      </div>

      {/* Right: Context Panel — always present, collapses to icon strip */}
      <div className="flex-shrink-0 h-full">
        {contextPanel}
      </div>
    </div>
  );
}
