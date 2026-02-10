/**
 * LockScreenService - Bridges playerStore state to system lock screen / notification controls
 *
 * Uses expo-media-control to display Now Playing info and handle remote commands
 * (play, pause, next, previous, seek, skip forward/backward).
 *
 * This is a pure service (no React). It subscribes to the Zustand store externally
 * and routes remote commands back through the store/audio service.
 */

import {
  enableMediaControls,
  disableMediaControls,
  updateMetadata,
  updatePlaybackState as updateMediaPlaybackState,
  addListener,
  removeAllListeners,
  PlaybackState,
  Command,
} from 'expo-media-control';
import type {MediaControlEvent} from 'expo-media-control';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {expoAudioService} from './ExpoAudioService';

const POSITION_SYNC_INTERVAL = 1000;

class LockScreenService {
  private static instance: LockScreenService;
  private storeUnsubscribe: (() => void) | null = null;
  private commandUnsubscribe: (() => void) | null = null;
  private positionInterval: ReturnType<typeof setInterval> | null = null;
  private isEnabled = false;
  private lastTrackId: string | null = null;
  private lastState: string | null = null;
  private lastDuration: number = 0;

  private constructor() {}

  static getInstance(): LockScreenService {
    if (!LockScreenService.instance) {
      LockScreenService.instance = new LockScreenService();
    }
    return LockScreenService.instance;
  }

  /**
   * Initialize media controls with supported capabilities.
   * Called automatically by startSync() if not already initialized.
   */
  async initialize(): Promise<void> {
    if (this.isEnabled) return;

    try {
      await enableMediaControls({
        capabilities: [
          Command.PLAY,
          Command.PAUSE,
          Command.NEXT_TRACK,
          Command.PREVIOUS_TRACK,
          Command.SKIP_FORWARD,
          Command.SKIP_BACKWARD,
          Command.SEEK,
        ],
        ios: {skipInterval: 15},
        android: {skipInterval: 15},
      });

      this.isEnabled = true;
      if (__DEV__) console.log('[LockScreenService] Initialized');
    } catch (error) {
      console.error('[LockScreenService] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Start syncing store state to lock screen and listening for remote commands.
   * Self-initializes if not already enabled, eliminating timing dependency on AppInitializer.
   */
  async startSync(): Promise<void> {
    if (!this.isEnabled) {
      await this.initialize();
    }

    this.listenForCommands();
    this.subscribeToStore();
    this.startPositionSync();

    // Immediately sync current state so metadata appears right away
    this.syncCurrentState();

    if (__DEV__) console.log('[LockScreenService] Sync started');
  }

  /**
   * Stop all syncing and listeners. Call on provider unmount.
   */
  stopSync(): void {
    if (this.storeUnsubscribe) {
      this.storeUnsubscribe();
      this.storeUnsubscribe = null;
    }
    if (this.commandUnsubscribe) {
      this.commandUnsubscribe();
      this.commandUnsubscribe = null;
    }
    if (this.positionInterval) {
      clearInterval(this.positionInterval);
      this.positionInterval = null;
    }

    this.lastTrackId = null;
    this.lastState = null;
    this.lastDuration = 0;

    if (__DEV__) console.log('[LockScreenService] Sync stopped');
  }

  /**
   * Tear down everything including the native media session.
   */
  async cleanup(): Promise<void> {
    this.stopSync();

    if (this.isEnabled) {
      try {
        await removeAllListeners();
        await disableMediaControls();
      } catch (error) {
        console.error('[LockScreenService] Cleanup error:', error);
      }
      this.isEnabled = false;
    }

    if (__DEV__) console.log('[LockScreenService] Cleaned up');
  }

  // ========== PRIVATE ==========

  private syncCurrentState(): void {
    const state = usePlayerStore.getState();
    const {queue, playback} = state;
    const currentTrack = queue.tracks[queue.currentIndex];

    if (currentTrack) {
      this.lastTrackId = currentTrack.id;
      this.syncMetadata(currentTrack);
    }

    if (playback.state) {
      this.lastState = playback.state;
      this.syncPlaybackState(playback.state);
    }
  }

  private listenForCommands(): void {
    this.commandUnsubscribe = addListener((event: MediaControlEvent) => {
      const store = usePlayerStore.getState();

      switch (event.command) {
        case Command.PLAY:
          store.play();
          break;
        case Command.PAUSE:
          store.pause();
          break;
        case Command.NEXT_TRACK:
          store.skipToNext();
          break;
        case Command.PREVIOUS_TRACK:
          store.skipToPrevious();
          break;
        case Command.SKIP_FORWARD:
          expoAudioService.seekForward(15);
          break;
        case Command.SKIP_BACKWARD:
          expoAudioService.seekBackward(15);
          break;
        case Command.SEEK:
          if (event.data?.position != null) {
            store.seekTo(event.data.position);
          }
          break;
      }
    });
  }

  private subscribeToStore(): void {
    // Subscribe to Zustand store changes outside React
    this.storeUnsubscribe = usePlayerStore.subscribe(state => {
      const {queue, playback} = state;
      const currentTrack = queue.tracks[queue.currentIndex];

      // Update metadata when track changes
      if (currentTrack && currentTrack.id !== this.lastTrackId) {
        this.lastTrackId = currentTrack.id;
        this.lastDuration = 0;
        this.syncMetadata(currentTrack);
      }

      // Re-sync metadata when duration becomes known (was 0, now real)
      if (currentTrack && playback.duration > 0 && this.lastDuration === 0) {
        this.lastDuration = playback.duration;
        this.syncMetadata(currentTrack, playback.duration);
      }

      // Update playback state when it changes
      if (playback.state !== this.lastState) {
        this.lastState = playback.state;
        this.syncPlaybackState(playback.state);
      }
    });
  }

  private syncMetadata(
    track: {
      title: string;
      artist: string;
      artwork?: string;
      duration?: number;
    },
    durationOverride?: number,
  ): void {
    updateMetadata({
      title: track.title,
      artist: track.artist,
      artwork: track.artwork ? {uri: track.artwork} : undefined,
      duration:
        durationOverride || track.duration || expoAudioService.getDuration(),
    }).catch(error => {
      if (__DEV__)
        console.warn('[LockScreenService] Failed to update metadata:', error);
    });
  }

  private syncPlaybackState(state: string): void {
    let mediaState: PlaybackState;

    switch (state) {
      case 'playing':
        mediaState = PlaybackState.PLAYING;
        break;
      case 'paused':
      case 'ended':
      case 'stopped':
        mediaState = PlaybackState.PAUSED;
        break;
      case 'buffering':
      case 'loading':
        mediaState = PlaybackState.BUFFERING;
        break;
      default:
        mediaState = PlaybackState.NONE;
        break;
    }

    const position = expoAudioService.getCurrentTime();
    const rate = expoAudioService.getPlaybackRate();

    updateMediaPlaybackState(mediaState, position, rate).catch(error => {
      if (__DEV__)
        console.warn(
          '[LockScreenService] Failed to update playback state:',
          error,
        );
    });
  }

  private startPositionSync(): void {
    this.positionInterval = setInterval(() => {
      if (!this.isEnabled) return;

      const state = usePlayerStore.getState();
      if (state.playback.state !== 'playing') return;

      const position = expoAudioService.getCurrentTime();
      const rate = expoAudioService.getPlaybackRate();

      updateMediaPlaybackState(PlaybackState.PLAYING, position, rate).catch(
        () => {
          // Silently ignore periodic position sync failures
        },
      );
    }, POSITION_SYNC_INTERVAL);
  }
}

export const lockScreenService = LockScreenService.getInstance();
