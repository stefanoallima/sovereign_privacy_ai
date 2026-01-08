/**
 * STT Service - Uses Whisper via Tauri backend when available,
 * falls back to Web Speech API in browser.
 */

import { invoke } from "@tauri-apps/api/core";

export interface SttConfig {
  model_name: string;
  language: string;
  translate: boolean;
}

export interface SttStatus {
  whisper_installed: boolean;
  model_installed: boolean;
  current_config: SttConfig;
  is_transcribing: boolean;
}

// Check if we're running in Tauri (v2 compatible)
const isTauri = () => {
  const hasTauri = typeof window !== "undefined" && "__TAURI__" in window;
  const hasTauriInternals = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  const result = hasTauri || hasTauriInternals;
  console.log("[STT] isTauri check:", { result, hasTauri, hasTauriInternals });
  return result;
};

/**
 * Get STT status from Tauri backend
 */
export async function getSttStatus(): Promise<SttStatus | null> {
  console.log("[STT] getSttStatus called");
  if (!isTauri()) {
    console.log("[STT] Not in Tauri, returning null");
    return null;
  }

  try {
    console.log("[STT] Invoking stt_get_status...");
    const status = await invoke<SttStatus>("stt_get_status");
    console.log("[STT] Got status:", status);
    return status;
  } catch (error) {
    console.error("[STT] Failed to get STT status:", error);
    return null;
  }
}

/**
 * Initialize STT (downloads Whisper and model if needed)
 */
export async function initializeStt(): Promise<SttStatus | null> {
  if (!isTauri()) return null;

  try {
    return await invoke<SttStatus>("stt_initialize");
  } catch (error) {
    console.error("Failed to initialize STT:", error);
    return null;
  }
}

/**
 * Transcribe audio using Whisper
 * @param audioBase64 Base64 encoded WAV audio
 */
export async function transcribe(audioBase64: string): Promise<string | null> {
  if (!isTauri()) {
    return null; // Will use Web Speech API fallback
  }

  try {
    return await invoke<string>("stt_transcribe", { audioBase64 });
  } catch (error) {
    console.error("Whisper transcription failed:", error);
    return null;
  }
}

/**
 * Check if currently transcribing
 */
export async function isTranscribing(): Promise<boolean> {
  if (!isTauri()) return false;

  try {
    return await invoke<boolean>("stt_is_transcribing");
  } catch (error) {
    console.error("Failed to check transcribing status:", error);
    return false;
  }
}

/**
 * Set STT configuration
 */
export async function setSttConfig(
  modelName: string,
  language: string = "en",
  translate: boolean = false
): Promise<boolean> {
  if (!isTauri()) return false;

  try {
    await invoke("stt_set_config", {
      modelName,
      language,
      translate,
    });
    return true;
  } catch (error) {
    console.error("Failed to set STT config:", error);
    return false;
  }
}

/**
 * Download a specific model
 */
export async function downloadModel(modelName: string): Promise<boolean> {
  if (!isTauri()) return false;

  try {
    await invoke("stt_download_model", { modelName });
    return true;
  } catch (error) {
    console.error("Failed to download model:", error);
    return false;
  }
}

// ============ Audio Recording Utilities ============
// Uses Web Audio API to capture raw PCM samples directly (avoids webm decoding issues)

let audioContext: AudioContext | null = null;
let mediaStream: MediaStream | null = null;
let scriptProcessor: ScriptProcessorNode | null = null;
let audioSamples: Float32Array[] = [];
let isRecording = false;

/**
 * Start recording audio from microphone using Web Audio API
 */
export async function startRecording(): Promise<boolean> {
  try {
    console.log("[STT] Starting audio recording...");

    // Get microphone stream
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
      }
    });

    // Create audio context at 16kHz for Whisper
    audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(mediaStream);

    // Use ScriptProcessorNode to capture raw PCM samples
    // Buffer size of 4096 samples
    scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
    audioSamples = [];
    isRecording = true;

    scriptProcessor.onaudioprocess = (event) => {
      if (!isRecording) return;

      // Get input samples and make a copy
      const inputData = event.inputBuffer.getChannelData(0);
      const samples = new Float32Array(inputData.length);
      samples.set(inputData);
      audioSamples.push(samples);
    };

    // Connect the nodes
    source.connect(scriptProcessor);
    scriptProcessor.connect(audioContext.destination);

    console.log("[STT] Recording started, sample rate:", audioContext.sampleRate);
    return true;
  } catch (error) {
    console.error("[STT] Failed to start recording:", error);
    return false;
  }
}

/**
 * Stop recording and get audio as base64 WAV
 */
export async function stopRecording(): Promise<string | null> {
  console.log("[STT] Stopping recording...");

  if (!isRecording || audioSamples.length === 0) {
    console.error("[STT] No audio recorded");
    cleanup();
    return null;
  }

  isRecording = false;

  try {
    // Combine all audio samples
    const totalLength = audioSamples.reduce((acc, arr) => acc + arr.length, 0);
    console.log("[STT] Total samples:", totalLength);

    if (totalLength === 0) {
      console.error("[STT] No audio samples captured");
      cleanup();
      return null;
    }

    const combined = new Float32Array(totalLength);
    let offset = 0;
    for (const samples of audioSamples) {
      combined.set(samples, offset);
      offset += samples.length;
    }

    // Get the actual sample rate used
    const sampleRate = audioContext?.sampleRate || 16000;
    console.log("[STT] Encoding WAV at", sampleRate, "Hz");

    // Encode as WAV
    const wavBuffer = encodeWav(combined, sampleRate);
    const wavBlob = new Blob([wavBuffer], { type: "audio/wav" });
    const base64 = await blobToBase64(wavBlob);

    console.log("[STT] WAV encoded, base64 length:", base64.length);

    cleanup();
    return base64;
  } catch (error) {
    console.error("[STT] Failed to process audio:", error);
    cleanup();
    return null;
  }
}

/**
 * Cleanup audio resources
 */
function cleanup() {
  if (scriptProcessor) {
    scriptProcessor.disconnect();
    scriptProcessor = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  audioSamples = [];
  isRecording = false;
}

/**
 * Encode samples as WAV
 */
function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // AudioFormat (PCM)
  view.setUint16(22, 1, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  // Convert float samples to 16-bit PCM
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Convert blob to base64
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
