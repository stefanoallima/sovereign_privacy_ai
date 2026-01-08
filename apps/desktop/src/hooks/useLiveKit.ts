/**
 * useLiveKit Hook
 *
 * React hook for managing LiveKit voice conversation state.
 * Provides a simple interface for connecting, speaking, and receiving audio.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { ConnectionState, RemoteParticipant } from 'livekit-client';
import { getLiveKitService, LiveKitService } from '@/services/livekit';

export interface UseLiveKitOptions {
  /** LiveKit server URL */
  url?: string;
  /** Room name to join */
  roomName?: string;
  /** Auto-connect on mount */
  autoConnect?: boolean;
  /** Callback when agent sends transcription */
  onTranscription?: (text: string, role: 'user' | 'assistant') => void;
  /** Callback when connection state changes */
  onConnectionChange?: (connected: boolean) => void;
}

export interface UseLiveKitReturn {
  /** Whether connected to LiveKit room */
  isConnected: boolean;
  /** Whether microphone is currently enabled */
  isSpeaking: boolean;
  /** Whether the agent is currently speaking */
  isAgentSpeaking: boolean;
  /** Connection state */
  connectionState: ConnectionState | null;
  /** Connect to LiveKit room */
  connect: (roomName?: string) => Promise<void>;
  /** Disconnect from LiveKit room */
  disconnect: () => Promise<void>;
  /** Start speaking (enable microphone) */
  startSpeaking: () => Promise<void>;
  /** Stop speaking (disable microphone) */
  stopSpeaking: () => Promise<void>;
  /** Toggle microphone */
  toggleSpeaking: () => Promise<void>;
  /** Error if any */
  error: Error | null;
}

const DEFAULT_ROOM_NAME = 'voice-assistant';
const DEFAULT_URL = 'ws://localhost:7880';

export function useLiveKit(options: UseLiveKitOptions = {}): UseLiveKitReturn {
  const {
    url = DEFAULT_URL,
    roomName = DEFAULT_ROOM_NAME,
    autoConnect = false,
    onTranscription: _onTranscription,
    onConnectionChange,
  } = options;

  // Suppress unused variable warning - reserved for future use
  void _onTranscription;

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Refs
  const serviceRef = useRef<LiveKitService | null>(null);
  const currentRoomRef = useRef<string>(roomName);

  // Initialize service
  useEffect(() => {
    serviceRef.current = getLiveKitService({ url });

    // Set up callbacks
    serviceRef.current.setCallbacks({
      onConnected: () => {
        setIsConnected(true);
        setConnectionState(ConnectionState.Connected);
        onConnectionChange?.(true);
      },
      onDisconnected: () => {
        setIsConnected(false);
        setIsSpeaking(false);
        setConnectionState(ConnectionState.Disconnected);
        onConnectionChange?.(false);
      },
      onAudioReceived: () => {
        // Agent is speaking when we receive audio
        setIsAgentSpeaking(true);
        // Reset after a short delay when audio stops
        // (In a real implementation, track audio end event)
      },
      onParticipantJoined: (participant: RemoteParticipant) => {
        console.log('[useLiveKit] Agent joined:', participant.identity);
      },
      onParticipantLeft: (participant: RemoteParticipant) => {
        console.log('[useLiveKit] Agent left:', participant.identity);
        setIsAgentSpeaking(false);
      },
      onError: (err: Error) => {
        console.error('[useLiveKit] Error:', err);
        setError(err);
      },
    });

    // Auto-connect if enabled
    if (autoConnect) {
      connect(roomName);
    }

    // Cleanup on unmount
    return () => {
      serviceRef.current?.disconnect();
    };
  }, [url]); // Only re-initialize if URL changes

  // Connect to room
  const connect = useCallback(
    async (room?: string) => {
      const targetRoom = room || currentRoomRef.current;
      currentRoomRef.current = targetRoom;

      if (!serviceRef.current) {
        setError(new Error('LiveKit service not initialized'));
        return;
      }

      try {
        setError(null);
        setConnectionState(ConnectionState.Connecting);
        await serviceRef.current.connect(targetRoom, 'user');
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Connection failed');
        setError(error);
        setConnectionState(ConnectionState.Disconnected);
        throw error;
      }
    },
    []
  );

  // Disconnect from room
  const disconnect = useCallback(async () => {
    if (!serviceRef.current) return;

    try {
      await serviceRef.current.disconnect();
      setIsSpeaking(false);
      setIsAgentSpeaking(false);
    } catch (err) {
      console.error('[useLiveKit] Disconnect error:', err);
    }
  }, []);

  // Start speaking (enable microphone)
  const startSpeaking = useCallback(async () => {
    if (!serviceRef.current || !isConnected) {
      console.warn('[useLiveKit] Cannot start speaking: not connected');
      return;
    }

    try {
      await serviceRef.current.enableMicrophone();
      setIsSpeaking(true);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to enable microphone');
      setError(error);
      console.error('[useLiveKit] Enable microphone error:', err);
    }
  }, [isConnected]);

  // Stop speaking (disable microphone)
  const stopSpeaking = useCallback(async () => {
    if (!serviceRef.current) return;

    try {
      await serviceRef.current.disableMicrophone();
      setIsSpeaking(false);
    } catch (err) {
      console.error('[useLiveKit] Disable microphone error:', err);
    }
  }, []);

  // Toggle speaking
  const toggleSpeaking = useCallback(async () => {
    if (isSpeaking) {
      await stopSpeaking();
    } else {
      await startSpeaking();
    }
  }, [isSpeaking, startSpeaking, stopSpeaking]);

  return {
    isConnected,
    isSpeaking,
    isAgentSpeaking,
    connectionState,
    connect,
    disconnect,
    startSpeaking,
    stopSpeaking,
    toggleSpeaking,
    error,
  };
}
