import { useEffect } from "react";
import { useVoiceStore } from "@/stores";

// Check if we're running in Tauri
const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

export function useGlobalShortcut() {
  const { startRecording, stopRecording, isRecording } = useVoiceStore();

  useEffect(() => {
    if (!isTauri) return;

    // Dynamic import of Tauri event API
    const setupListeners = async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");

        // Listen for Ctrl+Space press
        const unlistenPressed = await listen("voice-shortcut-pressed", () => {
          if (!isRecording) {
            startRecording();
          }
        });

        // Listen for Ctrl+Space release
        const unlistenReleased = await listen("voice-shortcut-released", () => {
          if (isRecording) {
            stopRecording();
          }
        });

        return () => {
          unlistenPressed();
          unlistenReleased();
        };
      } catch (e) {
        console.error("Failed to setup global shortcut listeners:", e);
      }
    };

    const cleanup = setupListeners();

    return () => {
      cleanup.then((fn) => fn?.());
    };
  }, [startRecording, stopRecording, isRecording]);
}
