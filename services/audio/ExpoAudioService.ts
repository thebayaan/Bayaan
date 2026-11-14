/**
 * ExpoAudioService - Core expo-audio wrapper
 *
 * This is a singleton service that manages audio playback using expo-audio.
 * It handles basic playback: play/pause/seek/rate operations.
 * Queue management is handled by playerStore.
 */

import {setAudioModeAsync, AudioPlayer, AudioSource} from 'expo-audio';

type PlaybackState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'error';

interface ExpoAudioServiceState {
  isInitialized: boolean;
  playbackState: PlaybackState;
  error: Error | null;
}

type StateListener = (state: ExpoAudioServiceState) => void;

// @ai How long loadTrack() waits for the provider to hand over the player.
const PLAYER_WAIT_MS = 3000;

class ExpoAudioService {
  private static instance: ExpoAudioService;
  private player: AudioPlayer | null = null;
  private playerWaiters: Array<() => void> = [];
  private isInitialized = false;
  private currentUrl: string | null = null;
  private stateListeners: Set<StateListener> = new Set();
  private playbackState: PlaybackState = 'idle';
  private lastError: Error | null = null;
  // @ai-start
  // The rate the user chose. The native player starts every app launch at
  // 1x, and the player store restores the chosen rate before or after the
  // player is injected, so the rate is kept here and pushed to the player
  // whenever one is available.
  private desiredRate = 1;
  // The current source could not be loaded or played (the player reported an
  // error for it). play() on such a source is silent, so callers reload.
  private sourceFailed = false;
  private statusSubscription: {remove: () => void} | null = null;
  // @ai-end

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): ExpoAudioService {
    if (!ExpoAudioService.instance) {
      ExpoAudioService.instance = new ExpoAudioService();
    }
    return ExpoAudioService.instance;
  }

  // ========== INITIALIZATION ==========

  /**
   * Initialize audio mode for background playback.
   * Should be called once during app startup.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      if (__DEV__) console.log('[ExpoAudioService] Already initialized');
      return;
    }

    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
      });

      this.isInitialized = true;
      if (__DEV__) console.log('[ExpoAudioService] Initialized successfully');
    } catch (error) {
      console.error('[ExpoAudioService] Initialization failed:', error);
      this.lastError =
        error instanceof Error ? error : new Error(String(error));
      this.notifyListeners();
      throw error;
    }
  }

  /**
   * Check if the service is initialized
   */
  getIsInitialized(): boolean {
    return this.isInitialized;
  }

  // ========== PLAYER MANAGEMENT ==========

  /**
   * Set the player instance from the useAudioPlayer hook.
   * This must be called from a React component that uses useAudioPlayer.
   */
  setPlayer(player: AudioPlayer): void {
    this.player = player;
    this.applyDesiredRate(); // @ai
    this.watchForErrors(player); // @ai
    const waiters = this.playerWaiters;
    this.playerWaiters = [];
    waiters.forEach(resolve => resolve());
    if (__DEV__) console.log('[ExpoAudioService] Player instance set');
  }

  /** Resolves once a player is set, or after timeoutMs at the latest. */
  waitForPlayer(timeoutMs: number): Promise<void> {
    if (this.player) return Promise.resolve();
    return new Promise<void>(resolve => {
      const done = (): void => {
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        this.playerWaiters = this.playerWaiters.filter(w => w !== done);
        resolve();
      }, timeoutMs);
      this.playerWaiters.push(done);
    });
  }

  /**
   * Get the current player instance
   */
  getPlayer(): AudioPlayer | null {
    return this.player;
  }

  /**
   * Check if player is ready
   */
  hasPlayer(): boolean {
    return this.player !== null;
  }

  // ========== TRACK LOADING ==========

  /**
   * Load a track from a URL.
   * Uses the player's replace method to load new audio.
   */
  async loadTrack(url: string): Promise<void> {
    // @ai-start
    // On a cold start a deep link can ask for a track before the provider
    // has handed over the player (it does so after an await). Wait for it
    // rather than fail the first play of the session.
    if (!this.player) await this.waitForPlayer(PLAYER_WAIT_MS);
    // @ai-end
    if (!this.player) {
      throw new Error(
        '[ExpoAudioService] Player not set. Call setPlayer first.',
      );
    }

    try {
      this.playbackState = 'loading';
      this.notifyListeners();

      if (__DEV__) console.log('[ExpoAudioService] Loading track:', url);

      // Create the audio source
      const source: AudioSource = {uri: url};

      // @ai-start
      // From here the player holds this source, loaded or not.
      this.currentUrl = url;
      this.sourceFailed = false;
      this.lastError = null;
      // @ai-end

      // Replace current audio with new source
      await this.player.replace(source);

      // Wait for the player to be fully loaded (with timeout)
      await this.waitForLoaded(5000);
      // @ai-start
      // The player reported that this source cannot be loaded (offline, a
      // dead link, a missing file). Fail now: carrying on used to end in a
      // play() that made no sound while the controls showed playing.
      if (this.sourceFailed && this.currentUrl === url) {
        throw this.lastError ?? new Error('The audio could not be loaded');
      }
      this.applyDesiredRate();
      // @ai-end

      this.playbackState = 'ready';
      this.lastError = null;
      this.notifyListeners();

      if (__DEV__)
        console.log(
          '[ExpoAudioService] Track loaded successfully, duration:',
          this.getDuration(),
        );
    } catch (error) {
      console.error('[ExpoAudioService] Failed to load track:', error);
      this.playbackState = 'error';
      this.lastError =
        error instanceof Error ? error : new Error(String(error));
      this.notifyListeners();
      throw error;
    }
  }

  // @ai-start
  /**
   * Wait until the new source has loaded or failed, or the timeout passes.
   *
   * The player's own status events decide this where they exist. The poll
   * below is only a fallback: it runs on JS timers, and React Native on
   * Android stops delivering timers while the app is in the background.
   * With the poll alone, a load started with the screen off never returned,
   * so playback stopped advancing after the next surah until the app was
   * opened again. Status events keep arriving in the background.
   */
  private async waitForLoaded(timeoutMs = 5000): Promise<void> {
    const player = this.player;
    let stopListening = (): void => undefined;
    const signalled = new Promise<void>(resolve => {
      if (!player || typeof player.addListener !== 'function') return;
      const subscription = player.addListener('playbackStatusUpdate', () => {
        // The event is only a wake-up; the player's live state decides, so
        // a late status of the previous source cannot end the wait.
        if (player.isLoaded || this.sourceFailed) resolve();
      });
      stopListening = () => subscription.remove();
    });
    try {
      await Promise.race([this.pollUntilLoaded(timeoutMs), signalled]);
    } finally {
      stopListening();
    }
  }
  // @ai-end

  /**
   * Poll for the player to be loaded, with a timeout.
   * Two-phase approach: first wait for isLoaded to become false
   * (indicating replace() has started processing the new source),
   * then wait for it to become true (new source fully loaded).
   * This prevents a race where isLoaded is still true from the
   * previous track and we return before the new track is ready.
   */
  private async pollUntilLoaded(timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 50;

    // Phase 1: Wait for player to begin loading the new source
    // (isLoaded becomes false when replace() starts processing).
    // Cap at 500ms — if isLoaded never becomes false (e.g. instant load
    // or first-ever load where isLoaded starts false), fall through.
    const resetDeadline = startTime + 500;
    while (Date.now() < resetDeadline) {
      if (!this.player?.isLoaded || this.sourceFailed) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    // Phase 2: Wait for the new track to finish loading
    while (Date.now() - startTime < timeoutMs) {
      if (this.player?.isLoaded) {
        return;
      }
      if (this.sourceFailed) return; // @ai No point in waiting out a failure.
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    if (__DEV__)
      console.warn('[ExpoAudioService] Timeout waiting for track to load');
  }

  /**
   * Get the currently loaded track URL
   */
  getCurrentUrl(): string | null {
    return this.currentUrl;
  }

  // @ai-start
  /**
   * Whether play() can make sound for `url`: the player holds that source
   * and has not reported it as failed. False after a launch whose restore
   * could not load (offline), after a failed load, after a stream that broke
   * mid-way, and when another source took the player.
   */
  isSourceReady(url: string): boolean {
    return (
      this.player !== null && this.currentUrl === url && !this.sourceFailed
    );
  }

  /**
   * Remember when the player reports an error for the current source.
   * expo-audio sends it as an `error` string on a status update, on both
   * platforms, and then goes back to plain updates.
   */
  private watchForErrors(player: AudioPlayer): void {
    this.statusSubscription?.remove();
    this.statusSubscription = null;
    if (typeof player.addListener !== 'function') return;
    this.statusSubscription = player.addListener(
      'playbackStatusUpdate',
      status => {
        const error = (status as {error?: unknown}).error;
        if (typeof error !== 'string' || error.length === 0) return;
        this.sourceFailed = true;
        this.lastError = new Error(error);
      },
    );
  }
  // @ai-end

  // ========== PLAYBACK CONTROLS ==========

  /**
   * Start playback
   */
  async play(): Promise<void> {
    if (!this.player) {
      if (__DEV__) console.warn('[ExpoAudioService] Cannot play: no player');
      return;
    }

    try {
      this.applyDesiredRate(); // @ai
      await this.player.play();
      this.playbackState = 'playing';
      this.notifyListeners();
      if (__DEV__) console.log('[ExpoAudioService] Playing');
    } catch (error) {
      console.error('[ExpoAudioService] Play failed:', error);
      this.playbackState = 'error';
      this.lastError =
        error instanceof Error ? error : new Error(String(error));
      this.notifyListeners();
      throw error;
    }
  }

  /**
   * Pause playback
   */
  async pause(): Promise<void> {
    if (!this.player) {
      if (__DEV__) console.warn('[ExpoAudioService] Cannot pause: no player');
      return;
    }

    try {
      await this.player.pause();
      this.playbackState = 'paused';
      this.notifyListeners();
      if (__DEV__) console.log('[ExpoAudioService] Paused');
    } catch (error) {
      console.error('[ExpoAudioService] Pause failed:', error);
      throw error;
    }
  }

  /**
   * Toggle play/pause
   */
  async togglePlayPause(): Promise<void> {
    if (this.player?.playing) {
      await this.pause();
    } else {
      await this.play();
    }
  }

  /**
   * Seek to a position in seconds
   */
  async seekTo(seconds: number): Promise<void> {
    if (!this.player) {
      if (__DEV__) console.warn('[ExpoAudioService] Cannot seek: no player');
      return;
    }

    try {
      // Only clamp to duration if duration is known (> 0)
      // Otherwise just clamp to non-negative value
      const duration = this.getDuration();
      const clampedSeconds =
        duration > 0
          ? Math.max(0, Math.min(seconds, duration))
          : Math.max(0, seconds);
      await this.player.seekTo(clampedSeconds);
      if (__DEV__) console.log('[ExpoAudioService] Seeked to:', clampedSeconds);
    } catch (error) {
      console.error('[ExpoAudioService] Seek failed:', error);
      throw error;
    }
  }

  /**
   * Seek forward by a number of seconds
   */
  async seekForward(seconds = 15): Promise<void> {
    const newPosition = this.getCurrentTime() + seconds;
    await this.seekTo(newPosition);
  }

  /**
   * Seek backward by a number of seconds
   */
  async seekBackward(seconds = 15): Promise<void> {
    const newPosition = this.getCurrentTime() - seconds;
    await this.seekTo(newPosition);
  }

  // ========== PLAYBACK SETTINGS ==========

  /**
   * Set playback rate (0.5 to 2.0)
   * Also enables pitch correction so audio doesn't sound distorted
   */
  setRate(rate: number): void {
    // @ai-start
    // Clamp to valid range (expo-audio supports 0.1 to 2.0). A rate that is
    // not a number (a damaged persisted value) falls back to 1x.
    const clampedRate = Number.isFinite(rate)
      ? Math.max(0.5, Math.min(2.0, rate))
      : 1;
    // Remember it even with no player yet: setPlayer() applies it.
    this.desiredRate = clampedRate;
    // @ai-end

    if (!this.player) {
      if (__DEV__)
        console.warn('[ExpoAudioService] Cannot set rate: no player');
      return;
    }

    // Use setPlaybackRate method with 'high' pitch correction quality
    this.player.setPlaybackRate(clampedRate, 'high');
    if (__DEV__) console.log('[ExpoAudioService] Rate set to:', clampedRate);
  }

  // @ai-start
  /**
   * Push the chosen rate to the native player when the two differ. The
   * native rate is 1x on a fresh player (every app launch), so without this
   * the UI shows the restored rate while the audio plays at 1x.
   */
  private applyDesiredRate(): void {
    if (!this.player) return;
    try {
      if (Math.abs(this.player.playbackRate - this.desiredRate) < 0.001) return;
      this.player.setPlaybackRate(this.desiredRate, 'high');
    } catch (error) {
      // A rate that cannot be applied must not stop a load or a play.
      if (__DEV__) console.warn('[ExpoAudioService] Rate sync failed:', error);
    }
  }
  // @ai-end

  /**
   * Set volume (0.0 to 1.0)
   */
  setVolume(volume: number): void {
    if (!this.player) {
      if (__DEV__)
        console.warn('[ExpoAudioService] Cannot set volume: no player');
      return;
    }

    // Clamp to valid range
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.player.volume = clampedVolume;
    if (__DEV__)
      console.log('[ExpoAudioService] Volume set to:', clampedVolume);
  }

  /**
   * Mute the player
   */
  setMuted(muted: boolean): void {
    if (!this.player) {
      if (__DEV__) console.warn('[ExpoAudioService] Cannot mute: no player');
      return;
    }

    this.player.muted = muted;
    if (__DEV__) console.log('[ExpoAudioService] Muted:', muted);
  }

  // ========== STATUS GETTERS ==========

  /**
   * Get current playback position in seconds
   */
  getCurrentTime(): number {
    return this.player?.currentTime ?? 0;
  }

  /**
   * Alias for getCurrentTime - for compatibility with queue manager
   */
  getPosition(): number {
    return this.getCurrentTime();
  }

  /**
   * Get total duration in seconds
   */
  getDuration(): number {
    return this.player?.duration ?? 0;
  }

  /**
   * Check if currently playing
   */
  getIsPlaying(): boolean {
    return this.player?.playing ?? false;
  }

  /**
   * Check if track is loaded and ready
   */
  getIsLoaded(): boolean {
    return this.player?.isLoaded ?? false;
  }

  /**
   * Check if currently buffering
   */
  getIsBuffering(): boolean {
    return this.player?.isBuffering ?? false;
  }

  /**
   * Get current playback rate
   */
  getPlaybackRate(): number {
    return this.player?.playbackRate ?? 1;
  }

  /**
   * Get current volume
   */
  getVolume(): number {
    return this.player?.volume ?? 1;
  }

  /**
   * Get current playback state
   */
  getPlaybackState(): PlaybackState {
    return this.playbackState;
  }

  /**
   * Get last error if any
   */
  getLastError(): Error | null {
    return this.lastError;
  }

  // ========== STATE LISTENERS ==========

  /**
   * Subscribe to state changes
   */
  addStateListener(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private notifyListeners(): void {
    const state: ExpoAudioServiceState = {
      isInitialized: this.isInitialized,
      playbackState: this.playbackState,
      error: this.lastError,
    };
    this.stateListeners.forEach(listener => listener(state));
  }

  // ========== CLEANUP ==========

  /**
   * Clean up resources
   */
  cleanup(): void {
    // @ai Keep the injected player. It is the runtime's single player that
    // ExpoAudioProvider owns, and the provider injects it only on mount. A
    // null here made every later loadTrack() throw 'Player not set' until the
    // provider mounted again, in practice until a restart (Settings -> Clear
    // cache calls playerStore.cleanup()). It also left LockScreenService no
    // player to clear the lock-screen controls on.
    this.currentUrl = null;
    this.sourceFailed = false; // @ai
    this.playbackState = 'idle';
    this.lastError = null;
    this.stateListeners.clear();
    // @ai The store goes back to 1x on cleanup; the kept player must follow.
    this.desiredRate = 1;
    this.applyDesiredRate(); // @ai
    if (__DEV__) console.log('[ExpoAudioService] Cleaned up');
  }

  /**
   * Reset the service (useful for testing)
   */
  reset(): void {
    this.cleanup();
    this.isInitialized = false;
    // @ai Test isolation only: drop the player (cleanup() keeps it).
    this.statusSubscription?.remove(); // @ai
    this.statusSubscription = null; // @ai
    this.player = null;
  }
}

// Export singleton instance
export const expoAudioService = ExpoAudioService.getInstance();

// Export class for testing
export {ExpoAudioService};

// Export types
export type {PlaybackState, ExpoAudioServiceState, StateListener};
