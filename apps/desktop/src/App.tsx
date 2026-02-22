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
// Tax Audit is now a persona - TaxAuditLayout removed
import { DocumentUploadWidget } from "@/components/pii/DocumentUploadWidget";
import { useProfileStore } from "@/stores/profiles";
import { useWizardStore } from "@/stores/wizard";
import { SetupWizard } from "@/components/wizard/SetupWizard";
import { SupportChat } from "@/components/support/SupportChat";
import { useAppTour } from "@/hooks/useAppTour";
import "@/styles/tour.css";

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
  const { isInitialized: chatInitialized, initialize: initChat, currentConversationId } = useChatStore();
  const { isUploadModalOpen, setUploadModalOpen, people } = useProfileStore();
  const { wizardCompleted, showWizard } = useWizardStore();
  const { startTour, tourCompleted } = useAppTour();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isContextPanelOpen, setIsContextPanelOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);

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

  // Trigger app tour after wizard completion (first time only)
  useEffect(() => {
    if (wizardCompleted && !showWizard && !tourCompleted && chatInitialized) {
      const timer = setTimeout(() => startTour(), 500);
      return () => clearTimeout(timer);
    }
  }, [wizardCompleted, showWizard, tourCompleted, chatInitialized, startTour]);

  // Open settings automatically if no API key is set (only if wizard already completed)
  useEffect(() => {
    if (!settings.nebiusApiKey && chatInitialized && wizardCompleted && !settings.airplaneMode) {
      setIsSettingsOpen(true);
    }
  }, [settings.nebiusApiKey, chatInitialized, wizardCompleted, settings.airplaneMode]);

  // Show loading while chat store initializes
  if (!chatInitialized) {
    return <LoadingScreen />;
  }

  // Show setup wizard on first launch or when explicitly opened
  if (!wizardCompleted || showWizard) {
    return <SetupWizard />;
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
        <main className="flex-1 overflow-hidden relative">
          <ChatWindow />
        </main>

        {/* Sidebar Drawer */}
        <Drawer
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          title="Conversations"
        >
          <Sidebar
            onSettingsClick={() => {
              setIsSidebarOpen(false);
              setIsSettingsOpen(true);
            }}
            onSupportClick={() => {
              setIsSidebarOpen(false);
              setIsSupportOpen(true);
            }}
          />
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

        {/* Support Chat */}
        <SupportChat
          isOpen={isSupportOpen}
          onClose={() => setIsSupportOpen(false)}
        />

        {/* Document Ingestion Overlay */}
        {isUploadModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fade-in">
            <div className="absolute inset-0" onClick={() => setUploadModalOpen(false)} />
            <div className="relative w-full bg-[hsl(var(--card))] rounded-3xl shadow-2xl border border-[hsl(var(--border)/0.5)] overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">Import PII Document</h2>
                  <button
                    onClick={() => setUploadModalOpen(false)}
                    className="p-2 rounded-full hover:bg-[hsl(var(--secondary))] transition-colors"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <DocumentUploadWidget
                  conversationId={currentConversationId || 'default'}
                  existingPersons={people}
                  onProcessComplete={() => {
                    // Optional: close or show success
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Desktop Layout
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[hsl(var(--background))]">
      {/* Sidebar - Conversations and Projects */}
      <Sidebar
        onSettingsClick={() => setIsSettingsOpen(true)}
        onSupportClick={() => setIsSupportOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex flex-1 flex-col overflow-hidden relative">
        <ChatWindow />
      </main>

      {/* Context Panel - Persona, Contexts, Model Selection */}
      <ContextPanel />

      {/* Settings Dialog */}
      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Support Chat */}
      <SupportChat
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
      />

      {/* Document Ingestion Overlay */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/20 backdrop-blur-sm animate-fade-in">
          <div className="absolute inset-0" onClick={() => setUploadModalOpen(false)} />
          <div className="relative w-full max-w-2xl bg-[hsl(var(--card))] rounded-3xl shadow-2xl border border-[hsl(var(--border)/0.5)] overflow-hidden">
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Import PII Document</h2>
                <button
                  onClick={() => setUploadModalOpen(false)}
                  className="p-2 rounded-full hover:bg-[hsl(var(--secondary))] transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <DocumentUploadWidget
                conversationId={currentConversationId || 'default'}
                existingPersons={people}
                onProcessComplete={() => {
                  // Optional: close or show success
                }}
              />
            </div>
          </div>
        </div>
      )}
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
