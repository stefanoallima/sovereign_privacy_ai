/**
 * TTS Service - Uses Piper TTS via Tauri backend when available,
 * falls back to Web Speech API in browser.
 */

import { invoke } from "@tauri-apps/api/core";

export interface VoiceConfig {
  model_name: string;
  speaker_id: number | null;
  speed: number;
}

export interface TtsStatus {
  piper_installed: boolean;
  voice_installed: boolean;
  current_voice: VoiceConfig;
  is_speaking: boolean;
}

// Check if we're running in Tauri (v2 compatible)
const isTauri = () => {
  const hasTauri = typeof window !== "undefined" && "__TAURI__" in window;
  const hasTauriInternals = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  const result = hasTauri || hasTauriInternals;
  console.log("[TTS] isTauri check:", { result, hasTauri, hasTauriInternals });
  return result;
};

/**
 * Get TTS status from Tauri backend
 */
export async function getTtsStatus(): Promise<TtsStatus | null> {
  if (!isTauri()) return null;

  try {
    return await invoke<TtsStatus>("tts_get_status");
  } catch (error) {
    console.error("Failed to get TTS status:", error);
    return null;
  }
}

/**
 * Initialize TTS (downloads Piper and voice model if needed)
 */
export async function initializeTts(): Promise<TtsStatus | null> {
  if (!isTauri()) return null;

  try {
    return await invoke<TtsStatus>("tts_initialize");
  } catch (error) {
    console.error("Failed to initialize TTS:", error);
    return null;
  }
}

/**
 * Speak text using Piper TTS
 */
export async function speak(text: string): Promise<boolean> {
  if (!isTauri()) {
    return speakWithWebSpeech(text);
  }

  try {
    await invoke("tts_speak", { text });
    return true;
  } catch (error) {
    console.error("Piper TTS failed, falling back to Web Speech:", error);
    return speakWithWebSpeech(text);
  }
}

/**
 * Stop speaking
 */
export async function stopSpeaking(): Promise<void> {
  if (!isTauri()) {
    window.speechSynthesis?.cancel();
    return;
  }

  try {
    await invoke("tts_stop");
  } catch (error) {
    console.error("Failed to stop TTS:", error);
    window.speechSynthesis?.cancel();
  }
}

/**
 * Check if currently speaking
 */
export async function isSpeaking(): Promise<boolean> {
  if (!isTauri()) {
    return window.speechSynthesis?.speaking ?? false;
  }

  try {
    return await invoke<boolean>("tts_is_speaking");
  } catch (error) {
    console.error("Failed to check speaking status:", error);
    return false;
  }
}

/**
 * Set voice configuration
 */
export async function setVoice(
  modelName: string,
  speakerId: number | null = 0, // Valid range: 0-903 for libritts-high
  speed: number = 1.0
): Promise<boolean> {
  if (!isTauri()) return false;

  try {
    await invoke("tts_set_voice", {
      modelName,
      speakerId,
      speed,
    });
    return true;
  } catch (error) {
    console.error("Failed to set voice:", error);
    return false;
  }
}

/**
 * Download a specific voice model
 */
export async function downloadVoice(modelName: string): Promise<boolean> {
  if (!isTauri()) return false;

  try {
    await invoke("tts_download_voice", { modelName });
    return true;
  } catch (error) {
    console.error("Failed to download voice:", error);
    return false;
  }
}

// ============ Web Speech API Fallback ============

/**
 * Fallback to Web Speech API
 */
function speakWithWebSpeech(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      console.warn("Web Speech API not supported");
      resolve(false);
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // Clean text for TTS
    const cleanText = cleanTextForTts(text);
    if (!cleanText) {
      resolve(true);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);

    // Try to get a good voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (v) =>
        v.name.includes("Microsoft David") ||
        v.name.includes("Microsoft Zira") ||
        v.name.includes("Google") ||
        (v.lang.startsWith("en") && v.localService)
    );

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onend = () => resolve(true);
    utterance.onerror = () => resolve(false);

    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Clean text for TTS (remove markdown, etc.)
 */
function cleanTextForTts(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " code block ") // Replace code blocks
    .replace(/`([^`]+)`/g, "$1") // Remove inline code backticks
    .replace(/\*\*([^*]+)\*\*/g, "$1") // Remove bold
    .replace(/\*([^*]+)\*/g, "$1") // Remove italic
    .replace(/#{1,6}\s/g, "") // Remove headers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Replace links with text
    .replace(/<[^>]+>/g, "") // Remove HTML tags
    .replace(/\n{2,}/g, ". ") // Replace multiple newlines with pause
    .replace(/\n/g, " ") // Replace single newlines with space
    .replace(/\s{2,}/g, " ") // Collapse multiple spaces
    .trim();
}
