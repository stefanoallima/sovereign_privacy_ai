/**
 * VoiceConversation Component
 *
 * LiveKit-based voice conversation UI.
 * Provides a simple interface for voice chat with automatic VAD and turn-taking.
 */

import { useState, useCallback } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Volume2, Loader2 } from 'lucide-react';
import { useLiveKit } from '@/hooks/useLiveKit';
import { ConnectionState } from 'livekit-client';

interface VoiceConversationProps {
  /** Callback when transcription is received */
  onTranscription?: (text: string, role: 'user' | 'assistant') => void;
  /** Custom class name */
  className?: string;
}

export function VoiceConversation({
  onTranscription,
  className = '',
}: VoiceConversationProps) {
  const {
    isConnected,
    isSpeaking,
    isAgentSpeaking,
    connectionState,
    connect,
    disconnect,
    startSpeaking,
    stopSpeaking,
    error,
  } = useLiveKit({
    onTranscription,
  });

  const [isConnecting, setIsConnecting] = useState(false);

  // Handle connect/disconnect
  const handleToggleConnection = useCallback(async () => {
    if (isConnected) {
      await disconnect();
    } else {
      setIsConnecting(true);
      try {
        await connect();
      } catch (err) {
        console.error('Failed to connect:', err);
      } finally {
        setIsConnecting(false);
      }
    }
  }, [isConnected, connect, disconnect]);

  // Handle push-to-talk
  const handleMouseDown = useCallback(async () => {
    if (isConnected && !isAgentSpeaking) {
      await startSpeaking();
    }
  }, [isConnected, isAgentSpeaking, startSpeaking]);

  const handleMouseUp = useCallback(async () => {
    if (isSpeaking) {
      await stopSpeaking();
    }
  }, [isSpeaking, stopSpeaking]);

  // Get status text
  const getStatusText = () => {
    if (isConnecting || connectionState === ConnectionState.Connecting) {
      return 'Connecting...';
    }
    if (!isConnected) {
      return 'Click to start voice chat';
    }
    if (isAgentSpeaking) {
      return 'Agent speaking...';
    }
    if (isSpeaking) {
      return 'Listening...';
    }
    return 'Hold to speak';
  };

  // Get connection button style
  const getConnectionButtonStyle = () => {
    if (isConnected) {
      return 'bg-red-500 hover:bg-red-600 text-white';
    }
    if (isConnecting) {
      return 'bg-gray-400 text-white cursor-wait';
    }
    return 'bg-green-500 hover:bg-green-600 text-white';
  };

  // Get mic button style
  const getMicButtonStyle = () => {
    if (!isConnected) {
      return 'bg-gray-300 text-gray-500 cursor-not-allowed';
    }
    if (isAgentSpeaking) {
      return 'bg-blue-500 text-white';
    }
    if (isSpeaking) {
      return 'bg-green-500 text-white animate-pulse';
    }
    return 'bg-gray-200 hover:bg-gray-300 text-gray-700';
  };

  return (
    <div className={`flex flex-col items-center gap-4 p-4 ${className}`}>
      {/* Status indicator */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        {isAgentSpeaking && <Volume2 className="w-4 h-4 animate-pulse text-blue-500" />}
        {isSpeaking && <Mic className="w-4 h-4 animate-pulse text-green-500" />}
        <span>{getStatusText()}</span>
      </div>

      {/* Error display */}
      {error && (
        <div className="text-sm text-red-500 bg-red-50 px-3 py-1 rounded">
          {error.message}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-4">
        {/* Connection button */}
        <button
          onClick={handleToggleConnection}
          disabled={isConnecting}
          className={`p-4 rounded-full transition-colors ${getConnectionButtonStyle()}`}
          title={isConnected ? 'End call' : 'Start call'}
        >
          {isConnecting ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : isConnected ? (
            <PhoneOff className="w-6 h-6" />
          ) : (
            <Phone className="w-6 h-6" />
          )}
        </button>

        {/* Push-to-talk button */}
        <button
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchEnd={handleMouseUp}
          disabled={!isConnected || isAgentSpeaking}
          className={`p-6 rounded-full transition-all ${getMicButtonStyle()}`}
          title={isConnected ? 'Hold to speak' : 'Connect first'}
        >
          {isSpeaking ? (
            <Mic className="w-8 h-8" />
          ) : (
            <MicOff className="w-8 h-8" />
          )}
        </button>
      </div>

      {/* Connection state indicator */}
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected
              ? 'bg-green-500'
              : connectionState === ConnectionState.Connecting
              ? 'bg-yellow-500 animate-pulse'
              : 'bg-gray-400'
          }`}
        />
        <span className="text-xs text-gray-500">
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {/* Instructions */}
      {isConnected && !isAgentSpeaking && !isSpeaking && (
        <p className="text-xs text-gray-400 text-center max-w-xs">
          Hold the microphone button to speak. The AI will automatically detect when you stop talking.
        </p>
      )}
    </div>
  );
}

export default VoiceConversation;
