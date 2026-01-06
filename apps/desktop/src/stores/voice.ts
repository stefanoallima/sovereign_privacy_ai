import { create } from "zustand";
import type { VoiceState } from "@/types";

interface VoiceStore {
  // State
  voiceState: VoiceState;
  voiceModeEnabled: boolean;
  voiceInputEnabled: boolean;
  voiceOutputEnabled: boolean;

  // Audio devices
  inputDevices: MediaDeviceInfo[];
  outputDevices: MediaDeviceInfo[];
  selectedInputDeviceId: string | null;
  selectedOutputDeviceId: string | null;

  // Recording state
  isRecording: boolean;
  recordingDuration: number;

  // Transcription
  lastTranscription: string;
  isTranscribing: boolean;

  // TTS
  isSpeaking: boolean;
  speakingQueue: string[];

  // Actions
  setVoiceState: (state: VoiceState) => void;
  toggleVoiceMode: () => void;
  toggleVoiceInput: () => void;
  toggleVoiceOutput: () => void;

  setInputDevices: (devices: MediaDeviceInfo[]) => void;
  setOutputDevices: (devices: MediaDeviceInfo[]) => void;
  selectInputDevice: (deviceId: string) => void;
  selectOutputDevice: (deviceId: string) => void;

  startRecording: () => void;
  stopRecording: () => void;
  updateRecordingDuration: (duration: number) => void;

  setTranscription: (text: string) => void;
  setIsTranscribing: (isTranscribing: boolean) => void;

  startSpeaking: () => void;
  stopSpeaking: () => void;
  addToSpeakingQueue: (text: string) => void;
  clearSpeakingQueue: () => void;

  // For Tauri integration
  interruptSpeaking: () => void;
}

export const useVoiceStore = create<VoiceStore>((set, get) => ({
  // Initial state
  voiceState: "idle",
  voiceModeEnabled: true,
  voiceInputEnabled: true,
  voiceOutputEnabled: true,

  inputDevices: [],
  outputDevices: [],
  selectedInputDeviceId: null,
  selectedOutputDeviceId: null,

  isRecording: false,
  recordingDuration: 0,

  lastTranscription: "",
  isTranscribing: false,

  isSpeaking: false,
  speakingQueue: [],

  // Actions
  setVoiceState: (state) => set({ voiceState: state }),

  toggleVoiceMode: () =>
    set((state) => ({
      voiceModeEnabled: !state.voiceModeEnabled,
      voiceInputEnabled: !state.voiceModeEnabled,
      voiceOutputEnabled: !state.voiceModeEnabled,
    })),

  toggleVoiceInput: () =>
    set((state) => ({ voiceInputEnabled: !state.voiceInputEnabled })),

  toggleVoiceOutput: () =>
    set((state) => ({ voiceOutputEnabled: !state.voiceOutputEnabled })),

  setInputDevices: (devices) => set({ inputDevices: devices }),
  setOutputDevices: (devices) => set({ outputDevices: devices }),
  selectInputDevice: (deviceId) => set({ selectedInputDeviceId: deviceId }),
  selectOutputDevice: (deviceId) => set({ selectedOutputDeviceId: deviceId }),

  startRecording: () =>
    set({
      isRecording: true,
      recordingDuration: 0,
      voiceState: "recording",
    }),

  stopRecording: () =>
    set({
      isRecording: false,
      voiceState: "processing",
    }),

  updateRecordingDuration: (duration) => set({ recordingDuration: duration }),

  setTranscription: (text) => set({ lastTranscription: text }),
  setIsTranscribing: (isTranscribing) =>
    set({
      isTranscribing,
      voiceState: isTranscribing ? "processing" : "idle",
    }),

  startSpeaking: () =>
    set({
      isSpeaking: true,
      voiceState: "speaking",
    }),

  stopSpeaking: () =>
    set({
      isSpeaking: false,
      voiceState: "idle",
      speakingQueue: [],
    }),

  addToSpeakingQueue: (text) =>
    set((state) => ({
      speakingQueue: [...state.speakingQueue, text],
    })),

  clearSpeakingQueue: () => set({ speakingQueue: [] }),

  interruptSpeaking: () => {
    const { isSpeaking } = get();
    if (isSpeaking) {
      set({
        isSpeaking: false,
        speakingQueue: [],
        voiceState: "idle",
      });
      // TODO: Call Tauri command to stop audio playback
    }
  },
}));
