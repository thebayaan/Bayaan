/**
 * AudioCoordinator - Mutual exclusion between the app's audio sources
 *
 * Ensures only one audio source plays at a time. When one source starts,
 * the other is paused automatically.
 */

import {usePlayerStore} from '@/services/player/store/playerStore';

type AudioSource = 'main' | 'mushaf' | 'adhkar' | 'moments' | 'none'; // @ai

class AudioCoordinator {
  private static instance: AudioCoordinator;
  private activeSource: AudioSource = 'none';
  private listeners = new Set<() => void>();

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

  /** Called after every change of the active source. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setActiveSource(next: AudioSource): void {
    if (this.activeSource === next) return;
    this.activeSource = next;
    this.listeners.forEach(listener => listener());
  }

  /**
   * Called before mushaf player starts playing.
   * Pauses the main player if it's currently playing.
   */
  mushafWillPlay(): void {
    this.pauseAdhkarIfActive();
    this.pauseMomentsIfActive(); // @ai
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
    this.setActiveSource('mushaf');
  }

  /**
   * Called before main player starts playing.
   * Pauses the mushaf player if it's currently playing.
   */
  mainWillPlay(): void {
    this.pauseAdhkarIfActive();
    this.pauseMomentsIfActive(); // @ai
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
    this.setActiveSource('main');
  }

  /**
   * Called before the adhkar player plays. Pauses the main and mushaf players.
   */
  // @ai-start
  adhkarWillPlay(): void {
    this.pauseMomentsIfActive();
    this.pauseMainAndMushaf();
    this.setActiveSource('adhkar');
  }

  /**
   * Called before a Moments clip plays. Pauses every other source.
   */
  momentsWillPlay(): void {
    if (this.activeSource !== 'moments') {
      this.pauseAdhkarIfActive();
      this.pauseMainAndMushaf();
    }
    this.setActiveSource('moments');
  }

  private pauseMainAndMushaf(): void {
    const store = usePlayerStore.getState();
    if (
      store.playback.state === 'playing' ||
      store.playback.state === 'buffering'
    ) {
      store.pause();
    }
    const {mushafAudioService} = require('./MushafAudioService');
    if (mushafAudioService.getIsPlaying()) {
      mushafAudioService.pause();
      const {useMushafPlayerStore} = require('@/store/mushafPlayerStore');
      useMushafPlayerStore.getState().setPlaybackState('paused');
    }
  }

  private pauseMomentsIfActive(): void {
    if (this.activeSource !== 'moments') return;
    const {
      momentsAudioService,
    } = require('@/services/moments/MomentsAudioService');
    momentsAudioService.pause();
  }
  // @ai-end

  private pauseAdhkarIfActive(): void {
    if (this.activeSource !== 'adhkar') return;
    // The caller sets the new source right after; the engine reads this to
    // know another source took over.
    this.setActiveSource('none');
    const {useAdhkarSessionStore} = require('@/store/adhkarSessionStore');
    useAdhkarSessionStore.getState().dispatch({type: 'otherAudioStarted'});
  }

  /**
   * Called when a source stops completely (not just pauses).
   */
  sourceDidStop(source: AudioSource): void {
    if (this.activeSource === source) {
      this.setActiveSource('none');
    }
  }
}

export const audioCoordinator = AudioCoordinator.getInstance();
export type {AudioSource};
