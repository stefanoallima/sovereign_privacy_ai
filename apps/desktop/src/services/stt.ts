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

// Check if we're running in Tauri
const isTauri = () => {
  return typeof window !== "undefined" && "__TAURI__" in window;
};

/**
 * Get STT status from Tauri backend
 */
export async function getSttStatus(): Promise<SttStatus | null> {
  if (!isTauri()) return null;

  try {
    return await invoke<SttStatus>("stt_get_status");
  } catch (error) {
    console.error("Failed to get STT status:", error);
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

let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];

/**
 * Start recording audio from microphone
 */
export async function startRecording(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Use WAV-compatible format
    const options: MediaRecorderOptions = {
      mimeType: "audio/webm;codecs=opus",
    };

    mediaRecorder = new MediaRecorder(stream, options);
    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.start(100); // Collect data every 100ms
    return true;
  } catch (error) {
    console.error("Failed to start recording:", error);
    return false;
  }
}

/**
 * Stop recording and get audio as base64 WAV
 */
export async function stopRecording(): Promise<string | null> {
  return new Promise((resolve) => {
    if (!mediaRecorder) {
      resolve(null);
      return;
    }

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });

      // Convert to WAV format for Whisper
      try {
        const wavBlob = await convertToWav(audioBlob);
        const base64 = await blobToBase64(wavBlob);
        resolve(base64);
      } catch (error) {
        console.error("Failed to convert audio:", error);
        resolve(null);
      }

      // Stop all tracks
      mediaRecorder?.stream.getTracks().forEach((track) => track.stop());
      mediaRecorder = null;
    };

    mediaRecorder.stop();
  });
}

/**
 * Convert audio blob to WAV format
 */
async function convertToWav(blob: Blob): Promise<Blob> {
  const audioContext = new AudioContext({ sampleRate: 16000 });
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Convert to mono 16-bit PCM WAV
  const numberOfChannels = 1;
  const sampleRate = 16000;
  const length = audioBuffer.length;

  // Resample if necessary
  let samples: Float32Array;
  if (audioBuffer.sampleRate !== sampleRate) {
    const offlineContext = new OfflineAudioContext(
      numberOfChannels,
      Math.ceil(length * sampleRate / audioBuffer.sampleRate),
      sampleRate
    );
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start(0);
    const resampledBuffer = await offlineContext.startRendering();
    samples = resampledBuffer.getChannelData(0);
  } else {
    samples = audioBuffer.getChannelData(0);
  }

  // Create WAV file
  const wavBuffer = encodeWav(samples, sampleRate);
  return new Blob([wavBuffer], { type: "audio/wav" });
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
