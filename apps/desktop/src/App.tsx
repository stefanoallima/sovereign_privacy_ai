import { useEffect, useState } from "react";
import { useSettingsStore, useAuthStore, useChatStore, useRequireAuth } from "@/stores";
import { Sidebar } from "@/components/chat/Sidebar";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { ContextPanel } from "@/components/contexts/ContextPanel";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { Drawer } from "@/components/layout/Drawer";
import { BottomSheet } from "@/components/layout/BottomSheet";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { useGlobalShortcut } from "@/hooks/useGlobalShortcut";
import { useSync } from "@/hooks/useSync";
import { useIsMobile } from "@/hooks/useMediaQuery";

function LoadingScreen() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[hsl(var(--background))]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function MainApp() {
  const { settings } = useSettingsStore();
  const { isInitialized: chatInitialized, initialize: initChat } = useChatStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isContextPanelOpen, setIsContextPanelOpen] = useState(false);

  const isMobile = useIsMobile();

  // Initialize sync
  useSync();

  // Set up global shortcut listener for voice (Ctrl+Space)
  useGlobalShortcut();

  // Initialize chat store if not already
  useEffect(() => {
    if (!chatInitialized) {
      initChat();
    }
  }, [chatInitialized, initChat]);

  // Apply theme on mount and when it changes
  useEffect(() => {
    const root = document.documentElement;

    if (settings.theme === "system") {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      root.classList.toggle("dark", prefersDark);
    } else {
      root.classList.toggle("dark", settings.theme === "dark");
    }
  }, [settings.theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (settings.theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle("dark", e.matches);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [settings.theme]);

  // Open settings automatically if no API key is set
  useEffect(() => {
    if (!settings.nebiusApiKey && chatInitialized) {
      setIsSettingsOpen(true);
    }
  }, [settings.nebiusApiKey, chatInitialized]);

  // Show loading while chat store initializes
  if (!chatInitialized) {
    return <LoadingScreen />;
  }

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-[hsl(var(--background))]">
        {/* Mobile Header */}
        <MobileHeader
          onMenuClick={() => setIsSidebarOpen(true)}
          onSettingsClick={() => setIsSettingsOpen(true)}
          onContextClick={() => setIsContextPanelOpen(true)}
        />

        {/* Main Chat Area */}
        <main className="flex-1 overflow-hidden">
          <ChatWindow />
        </main>

        {/* Sidebar Drawer */}
        <Drawer
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          title="Conversations"
        >
          <Sidebar onSettingsClick={() => {
            setIsSidebarOpen(false);
            setIsSettingsOpen(true);
          }} />
        </Drawer>

        {/* Context Panel Bottom Sheet */}
        <BottomSheet
          isOpen={isContextPanelOpen}
          onClose={() => setIsContextPanelOpen(false)}
          title="Settings"
        >
          <ContextPanel />
        </BottomSheet>

        {/* Settings Dialog */}
        <SettingsDialog
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      </div>
    );
  }

  // Desktop Layout
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[hsl(var(--background))]">
      {/* Sidebar - Conversations and Projects */}
      <Sidebar onSettingsClick={() => setIsSettingsOpen(true)} />

      {/* Main Chat Area */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <ChatWindow />
      </main>

      {/* Context Panel - Persona, Contexts, Model Selection */}
      <ContextPanel />

      {/* Settings Dialog */}
      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}

function App() {
  const { initialize: initAuth, isInitialized: authInitialized } = useAuthStore();
  const { isReady, needsAuth } = useRequireAuth();

  // Initialize auth store on mount
  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Apply theme based on system preference (for auth screen)
  useEffect(() => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", prefersDark);

    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle("dark", e.matches);
    };

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Show loading while auth initializes
  if (!authInitialized || !isReady) {
    return <LoadingScreen />;
  }

  // Show auth screen if user needs to sign in
  if (needsAuth) {
    return <AuthScreen />;
  }

  // Show main app
  return <MainApp />;
}

export default App;
