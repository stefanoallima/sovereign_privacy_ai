/**
 * LiveKit Service
 *
 * Handles WebRTC connection to LiveKit server for voice conversation.
 * Audio is streamed to/from the Python voice agent via LiveKit.
 */

import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  RemoteParticipant,
  LocalParticipant,
  ConnectionState,
  AudioTrack,
} from 'livekit-client';
import * as jose from 'jose';

export interface LiveKitConfig {
  url: string;
  token?: string;
  apiKey?: string;
  apiSecret?: string;
}

export interface LiveKitCallbacks {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onAudioReceived?: (track: RemoteTrack) => void;
  onParticipantJoined?: (participant: RemoteParticipant) => void;
  onParticipantLeft?: (participant: RemoteParticipant) => void;
  onError?: (error: Error) => void;
}

const DEFAULT_CONFIG: LiveKitConfig = {
  url: 'ws://localhost:7880',
  apiKey: 'devkey',
  apiSecret: 'secret',
};

/**
 * Generate a properly signed JWT token for LiveKit.
 * Uses the jose library for HMAC-SHA256 signing.
 */
async function generateToken(roomName: string, participantName: string): Promise<string> {
  const apiKey = DEFAULT_CONFIG.apiKey!;
  const apiSecret = DEFAULT_CONFIG.apiSecret!;

  // Create the secret key for signing
  const secret = new TextEncoder().encode(apiSecret);

  // Build the JWT with LiveKit claims
  const token = await new jose.SignJWT({
    video: {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(apiKey)
    .setSubject(participantName)
    .setIssuedAt()
    .setExpirationTime('1h')
    .setNotBefore(Math.floor(Date.now() / 1000) - 10) // 10 seconds ago to handle clock skew
    .sign(secret);

  return token;
}

export class LiveKitService {
  private room: Room | null = null;
  private config: LiveKitConfig;
  private callbacks: LiveKitCallbacks = {};
  private audioElement: HTMLAudioElement | null = null;

  constructor(config: Partial<LiveKitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Connect to a LiveKit room.
   */
  async connect(roomName: string, participantName: string = 'user'): Promise<void> {
    if (this.room) {
      await this.disconnect();
    }

    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });

    // Set up event handlers
    this.setupEventHandlers();

    // Generate properly signed token
    const token = this.config.token || await generateToken(roomName, participantName);
    console.log('[LiveKit] Connecting with token for room:', roomName);

    try {
      await this.room.connect(this.config.url, token);
      console.log('[LiveKit] Connected to room:', roomName);
    } catch (error) {
      console.error('[LiveKit] Connection error:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the current room.
   */
  async disconnect(): Promise<void> {
    if (this.room) {
      this.room.disconnect();
      this.room = null;
    }

    if (this.audioElement) {
      this.audioElement.srcObject = null;
      this.audioElement = null;
    }

    console.log('[LiveKit] Disconnected');
  }

  /**
   * Enable the local microphone and start publishing audio.
   */
  async enableMicrophone(): Promise<void> {
    if (!this.room) {
      throw new Error('Not connected to a room');
    }

    await this.room.localParticipant.setMicrophoneEnabled(true);
    console.log('[LiveKit] Microphone enabled');
  }

  /**
   * Disable the local microphone and stop publishing audio.
   */
  async disableMicrophone(): Promise<void> {
    if (!this.room) {
      return;
    }

    await this.room.localParticipant.setMicrophoneEnabled(false);
    console.log('[LiveKit] Microphone disabled');
  }

  /**
   * Check if microphone is currently enabled.
   */
  isMicrophoneEnabled(): boolean {
    return this.room?.localParticipant.isMicrophoneEnabled ?? false;
  }

  /**
   * Get the current connection state.
   */
  getConnectionState(): ConnectionState | null {
    return this.room?.state ?? null;
  }

  /**
   * Check if connected to a room.
   */
  isConnected(): boolean {
    return this.room?.state === ConnectionState.Connected;
  }

  /**
   * Set callback handlers.
   */
  setCallbacks(callbacks: LiveKitCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Set up event handlers for the room.
   */
  private setupEventHandlers(): void {
    if (!this.room) return;

    this.room.on(RoomEvent.Connected, () => {
      console.log('[LiveKit] Room connected');
      this.callbacks.onConnected?.();
    });

    this.room.on(RoomEvent.Disconnected, () => {
      console.log('[LiveKit] Room disconnected');
      this.callbacks.onDisconnected?.();
    });

    this.room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
      console.log('[LiveKit] Track subscribed:', track.kind, 'from', participant.identity);

      if (track.kind === Track.Kind.Audio) {
        // Attach audio track to an audio element for playback
        this.playAudioTrack(track as AudioTrack);
        this.callbacks.onAudioReceived?.(track);
      }
    });

    this.room.on(RoomEvent.TrackUnsubscribed, (track, _publication, participant) => {
      console.log('[LiveKit] Track unsubscribed:', track.kind, 'from', participant.identity);

      if (track.kind === Track.Kind.Audio) {
        track.detach();
      }
    });

    this.room.on(RoomEvent.ParticipantConnected, (participant) => {
      console.log('[LiveKit] Participant joined:', participant.identity);
      this.callbacks.onParticipantJoined?.(participant);
    });

    this.room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      console.log('[LiveKit] Participant left:', participant.identity);
      this.callbacks.onParticipantLeft?.(participant);
    });

    this.room.on(RoomEvent.MediaDevicesError, (error) => {
      console.error('[LiveKit] Media devices error:', error);
      this.callbacks.onError?.(error);
    });

    this.room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
      console.log('[LiveKit] Connection quality changed:', quality, 'for', participant.identity);
    });
  }

  /**
   * Play an audio track through an audio element.
   */
  private playAudioTrack(track: AudioTrack): void {
    // Create audio element if needed
    if (!this.audioElement) {
      this.audioElement = document.createElement('audio');
      this.audioElement.autoplay = true;
      // Hidden audio element
      this.audioElement.style.display = 'none';
      document.body.appendChild(this.audioElement);
    }

    // Attach track to audio element
    track.attach(this.audioElement);
    console.log('[LiveKit] Audio track attached to element');
  }

  /**
   * Get the current room instance.
   */
  getRoom(): Room | null {
    return this.room;
  }

  /**
   * Get local participant.
   */
  getLocalParticipant(): LocalParticipant | undefined {
    return this.room?.localParticipant;
  }

  /**
   * Get all remote participants.
   */
  getRemoteParticipants(): Map<string, RemoteParticipant> {
    return this.room?.remoteParticipants ?? new Map();
  }
}

// Singleton instance
let liveKitServiceInstance: LiveKitService | null = null;

/**
 * Get the singleton LiveKit service instance.
 */
export function getLiveKitService(config?: Partial<LiveKitConfig>): LiveKitService {
  if (!liveKitServiceInstance) {
    liveKitServiceInstance = new LiveKitService(config);
  }
  return liveKitServiceInstance;
}
