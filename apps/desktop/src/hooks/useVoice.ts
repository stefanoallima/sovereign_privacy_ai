import { useCallback, useRef, useEffect, useState } from "react";
import { useVoiceStore } from "@/stores";
import * as ttsService from "@/services/tts";
import * as sttService from "@/services/stt";

// Type declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export function useVoice() {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  // TTS state
  const [ttsReady, setTtsReady] = useState(false);
  const [ttsInitializing, setTtsInitializing] = useState(false);

  // STT state
  const [sttReady, setSttReady] = useState(false);
  const [sttInitializing, setSttInitializing] = useState(false);
  const [useWhisper, setUseWhisper] = useState(false);

  const {
    voiceState,
    voiceInputEnabled,
    voiceOutputEnabled,
    setVoiceState,
    startRecording,
    stopRecording,
    updateRecordingDuration,
    setTranscription,
    setIsTranscribing,
    startSpeaking,
    stopSpeaking,
  } = useVoiceStore();

  // Initialize Speech Recognition, TTS, and STT
  useEffect(() => {
    // Check for browser support of Speech Recognition (fallback)
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      console.warn("Speech Recognition is not supported in this browser");
      // Still supported if we have Whisper
    } else {
      // Initialize Speech Recognition as fallback
      recognitionRef.current = new SpeechRecognitionAPI();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-US";
    }

    // Initialize Piper TTS
    initializePiperTts();

    // Initialize Whisper STT
    initializeWhisperStt();

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  // Initialize Piper TTS
  const initializePiperTts = async () => {
    setTtsInitializing(true);
    try {
      const status = await ttsService.getTtsStatus();

      if (status) {
        if (status.piper_installed && status.voice_installed) {
          setTtsReady(true);
          console.log("Piper TTS ready:", status.current_voice);
        } else {
          console.log("Initializing Piper TTS (downloading if needed)...");
          const newStatus = await ttsService.initializeTts();
          if (newStatus?.piper_installed && newStatus?.voice_installed) {
            setTtsReady(true);
            console.log("Piper TTS initialized successfully");
          }
        }
      }
    } catch (error) {
      console.warn("Piper TTS not available, using Web Speech API fallback:", error);
    } finally {
      setTtsInitializing(false);
    }
  };

  // Initialize Whisper STT
  const initializeWhisperStt = async () => {
    setSttInitializing(true);
    try {
      const status = await sttService.getSttStatus();

      if (status) {
        if (status.whisper_installed && status.model_installed) {
          setSttReady(true);
          setUseWhisper(true);
          setIsSupported(true);
          console.log("Whisper STT ready:", status.current_config);
        } else {
          console.log("Initializing Whisper STT (downloading if needed)...");
          const newStatus = await sttService.initializeStt();
          if (newStatus?.whisper_installed && newStatus?.model_installed) {
            setSttReady(true);
            setUseWhisper(true);
            setIsSupported(true);
            console.log("Whisper STT initialized successfully");
          }
        }
      } else {
        // Not in Tauri, check Web Speech API
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
        setIsSupported(!!SpeechRecognitionAPI);
      }
    } catch (error) {
      console.warn("Whisper STT not available, using Web Speech API fallback:", error);
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      setIsSupported(!!SpeechRecognitionAPI);
    } finally {
      setSttInitializing(false);
    }
  };

  // Start listening for speech using Whisper
  const startListeningWhisper = useCallback(async () => {
    if (!voiceInputEnabled) {
      console.warn("Voice input is disabled");
      return;
    }

    try {
      // Start recording timer
      let duration = 0;
      recordingTimerRef.current = window.setInterval(() => {
        duration += 1;
        updateRecordingDuration(duration);
      }, 1000);

      startRecording();
      setVoiceState("recording");

      // Start recording audio
      const success = await sttService.startRecording();
      if (!success) {
        throw new Error("Failed to start audio recording");
      }
    } catch (error) {
      console.error("Failed to start Whisper recording:", error);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      stopRecording();
      setVoiceState("idle");
    }
  }, [voiceInputEnabled, startRecording, stopRecording, setVoiceState, updateRecordingDuration]);

  // Stop listening with Whisper and get transcription
  const stopListeningWhisper = useCallback(async (): Promise<string> => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }

    setIsTranscribing(true);
    setVoiceState("processing");

    try {
      // Stop recording and get audio
      const audioBase64 = await sttService.stopRecording();

      if (!audioBase64) {
        throw new Error("No audio recorded");
      }

      // Transcribe with Whisper
      const transcription = await sttService.transcribe(audioBase64);

      if (transcription) {
        setTranscription(transcription);
        return transcription;
      } else {
        console.warn("Whisper transcription failed, no result");
        return "";
      }
    } catch (error) {
      console.error("Whisper transcription error:", error);
      return "";
    } finally {
      setIsTranscribing(false);
      stopRecording();
      setVoiceState("idle");
    }
  }, [stopRecording, setVoiceState, setIsTranscribing, setTranscription]);

  // Start listening for speech using Web Speech API (fallback)
  const startListeningWebSpeech = useCallback(() => {
    if (!recognitionRef.current || !voiceInputEnabled) {
      console.warn("Speech recognition not available or disabled");
      return;
    }

    try {
      // Start recording timer
      let duration = 0;
      recordingTimerRef.current = window.setInterval(() => {
        duration += 1;
        updateRecordingDuration(duration);
      }, 1000);

      startRecording();

      recognitionRef.current.onstart = () => {
        setVoiceState("recording");
      };

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = "";
        let interimTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (interimTranscript) {
          setTranscription(interimTranscript);
        }

        if (finalTranscript) {
          setTranscription(finalTranscript);
        }
      };

      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("Speech recognition error:", event.error);
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
        }
        stopRecording();
        setVoiceState("idle");
      };

      recognitionRef.current.onend = () => {
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
        }
        setIsTranscribing(false);
      };

      recognitionRef.current.start();
    } catch (error) {
      console.error("Failed to start speech recognition:", error);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      setVoiceState("idle");
    }
  }, [
    voiceInputEnabled,
    startRecording,
    stopRecording,
    setVoiceState,
    setTranscription,
    setIsTranscribing,
    updateRecordingDuration,
  ]);

  // Stop listening with Web Speech API (fallback)
  const stopListeningWebSpeech = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      if (!recognitionRef.current) {
        resolve("");
        return;
      }

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }

      const currentTranscription = useVoiceStore.getState().lastTranscription;

      recognitionRef.current.onend = () => {
        setIsTranscribing(false);
        stopRecording();
        setVoiceState("idle");
        resolve(currentTranscription);
      };

      recognitionRef.current.stop();
    });
  }, [stopRecording, setVoiceState, setIsTranscribing]);

  // Start listening - uses Whisper if available, falls back to Web Speech API
  const startListening = useCallback(() => {
    if (useWhisper && sttReady) {
      startListeningWhisper();
    } else {
      startListeningWebSpeech();
    }
  }, [useWhisper, sttReady, startListeningWhisper, startListeningWebSpeech]);

  // Stop listening - uses Whisper if available, falls back to Web Speech API
  const stopListening = useCallback((): Promise<string> => {
    if (useWhisper && sttReady) {
      return stopListeningWhisper();
    } else {
      return stopListeningWebSpeech();
    }
  }, [useWhisper, sttReady, stopListeningWhisper, stopListeningWebSpeech]);

  // Speak text using Piper TTS (or Web Speech API fallback)
  const speak = useCallback(
    async (text: string): Promise<void> => {
      if (!voiceOutputEnabled) {
        return;
      }

      startSpeaking();
      setVoiceState("speaking");

      try {
        await ttsService.speak(text);
      } catch (error) {
        console.error("TTS error:", error);
      } finally {
        stopSpeaking();
        setVoiceState("idle");
      }
    },
    [voiceOutputEnabled, startSpeaking, stopSpeaking, setVoiceState]
  );

  // Stop speaking
  const cancelSpeech = useCallback(async () => {
    await ttsService.stopSpeaking();
    stopSpeaking();
    setVoiceState("idle");
  }, [stopSpeaking, setVoiceState]);

  // Toggle push-to-talk
  const toggleRecording = useCallback(() => {
    if (voiceState === "recording") {
      return stopListening();
    } else if (voiceState === "idle") {
      startListening();
      return Promise.resolve("");
    }
    return Promise.resolve("");
  }, [voiceState, startListening, stopListening]);

  return {
    // State
    isSupported,
    voiceState,
    ttsReady,
    ttsInitializing,
    sttReady,
    sttInitializing,
    useWhisper,

    // STT functions
    startListening,
    stopListening,
    toggleRecording,

    // TTS functions
    speak,
    cancelSpeech,

    // Initialization
    initializePiperTts,
    initializeWhisperStt,
  };
}
