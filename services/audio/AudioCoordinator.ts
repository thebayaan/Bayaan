/**
 * AudioCoordinator - Mutual exclusion between main player and mushaf player
 *
 * Ensures only one audio source plays at a time. When one source starts,
 * the other is paused automatically.
 */

import {usePlayerStore} from '@/services/player/store/playerStore';

type AudioSource = 'main' | 'mushaf' | 'adhkar' | 'none';

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
    this.stopRecitation();
    this.pauseAdhkarIfActive();
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
    this.stopRecitation();
    this.pauseAdhkarIfActive();
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
  adhkarWillPlay(): void {
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
    this.setActiveSource('adhkar');
  }

  private pauseAdhkarIfActive(): void {
    if (this.activeSource !== 'adhkar') return;
    // The caller sets the new source right after; the engine reads this to
    // know another source took over.
    this.setActiveSource('none');
    const {useAdhkarSessionStore} = require('@/store/adhkarSessionStore');
    useAdhkarSessionStore.getState().dispatch({type: 'otherAudioStarted'});
  }

  /**
   * Quran audio must never play into the mic: playback stops the reader's
   * recitation follow-along.
   */
  private stopRecitation(): void {
    // Lazy import to avoid circular dependency
    const {
      useRecitationTrackingStore,
    } = require('@/store/recitationTrackingStore');
    if (useRecitationTrackingStore.getState().status === 'off') return;
    const {
      stopRecitationTracking,
    } = require('@/services/recitation/RecitationTrackingService');
    void stopRecitationTracking('playback_started');
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
