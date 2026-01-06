import { useVoiceStore } from "@/stores";
import { useVoice } from "@/hooks/useVoice";
import { Mic, Volume2, Square } from "lucide-react";

interface VoiceButtonProps {
  onTranscription?: (text: string) => void;
}

export function VoiceButton({ onTranscription }: VoiceButtonProps) {
  const {
    voiceState,
    isRecording,
    recordingDuration,
    voiceInputEnabled,
  } = useVoiceStore();

  const { isSupported, startListening, stopListening } = useVoice();

  const handleMouseDown = () => {
    if (!isSupported || !voiceInputEnabled) return;
    startListening();
  };

  const handleMouseUp = async () => {
    if (!isRecording) return;

    const transcription = await stopListening();
    if (transcription && onTranscription) {
      onTranscription(transcription);
    }
  };

  const getButtonStyle = () => {
    if (!isSupported || !voiceInputEnabled) {
      return "bg-[hsl(var(--muted))] opacity-50 cursor-not-allowed";
    }

    switch (voiceState) {
      case "recording":
        return "bg-red-500 text-white shadow-lg shadow-red-500/30 scale-110";
      case "processing":
        return "bg-amber-500 text-white animate-pulse";
      case "speaking":
        return "bg-[hsl(var(--primary))] text-white";
      default:
        return "bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--accent-foreground))]";
    }
  };

  const getTooltip = () => {
    if (!isSupported) return "Speech recognition not supported";
    if (!voiceInputEnabled) return "Voice input disabled";
    if (isRecording) return "Release to send";
    return "Hold to talk";
  };

  return (
    <button
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleMouseDown}
      onTouchEnd={handleMouseUp}
      disabled={!isSupported || !voiceInputEnabled}
      className={`relative flex items-center justify-center gap-2 rounded-xl h-10 px-4 transition-all duration-200 ${getButtonStyle()}`}
      title={getTooltip()}
    >
      {/* Recording ring animation */}
      {isRecording && (
        <span className="absolute inset-0 rounded-xl animate-ping bg-red-500 opacity-25" />
      )}

      <Mic className={`h-4 w-4 transition-all ${isRecording ? "fill-current" : ""}`} />

      {isRecording && (
        <span className="text-xs font-medium tabular-nums">
          {formatDuration(recordingDuration)}
        </span>
      )}
    </button>
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Separate component for TTS control on messages
export function SpeakButton({ text }: { text: string }) {
  const { isSpeaking } = useVoiceStore();
  const { speak, cancelSpeech, isSupported } = useVoice();

  const handleClick = async () => {
    if (isSpeaking) {
      cancelSpeech();
    } else {
      await speak(text);
    }
  };

  if (!isSupported) return null;

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
        isSpeaking
          ? "text-[hsl(var(--primary))] bg-[hsl(var(--accent))]"
          : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
      }`}
      title={isSpeaking ? "Stop speaking" : "Read aloud"}
    >
      {isSpeaking ? (
        <>
          <Square className="h-3.5 w-3.5 fill-current" />
          <span>Stop</span>
        </>
      ) : (
        <>
          <Volume2 className="h-3.5 w-3.5" />
          <span>Listen</span>
        </>
      )}
    </button>
  );
}
