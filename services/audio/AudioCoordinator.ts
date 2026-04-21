/**
 * AudioCoordinator - Mutual exclusion between main player and mushaf player
 *
 * Ensures only one audio source plays at a time. When one source starts,
 * the other is paused automatically.
 */

import {usePlayerStore} from '@/services/player/store/playerStore';

type AudioSource = 'main' | 'mushaf' | 'none';

class AudioCoordinator {
  private static instance: AudioCoordinator;
  private activeSource: AudioSource = 'none';

  private constructor() {}

  static getInstance(): AudioCoordinator {
    if (!AudioCoordinator.instance) {
      AudioCoordinator.instance = new AudioCoordinator();
    }
    return AudioCoordinator.instance;
  }

  getActiveSource(): AudioSource {
    return this.activeSource;
  }

  /**
   * Called before mushaf player starts playing.
   * Pauses the main player if it's currently playing.
   */
  mushafWillPlay(): void {
    if (this.activeSource === 'main') {
      const store = usePlayerStore.getState();
      if (
        store.playback.state === 'playing' ||
        store.playback.state === 'buffering'
      ) {
        store.pause();
        if (__DEV__)
          console.log('[AudioCoordinator] Paused main player for mushaf');
      }
    }
    this.activeSource = 'mushaf';
  }

  /**
   * Called before main player starts playing.
   * Pauses the mushaf player if it's currently playing.
   */
  mainWillPlay(): void {
    if (this.activeSource === 'mushaf') {
      // Lazy import to avoid circular dependency
      const {mushafAudioService} = require('./MushafAudioService');
      if (mushafAudioService.getIsPlaying()) {
        mushafAudioService.pause();
        if (__DEV__)
          console.log('[AudioCoordinator] Paused mushaf player for main');
      }

      // Update mushaf store state
      const {useMushafPlayerStore} = require('@/store/mushafPlayerStore');
      const mushafState = useMushafPlayerStore.getState();
      if (mushafState.playbackState === 'playing') {
        mushafState.setPlaybackState('paused');
      }
    }
    this.activeSource = 'main';
  }

  /**
   * Called when a source stops completely (not just pauses).
   */
  sourceDidStop(source: AudioSource): void {
    if (this.activeSource === source) {
      this.activeSource = 'none';
    }
  }
}

export const audioCoordinator = AudioCoordinator.getInstance();
export type {AudioSource};
