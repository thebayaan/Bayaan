/**
 * AmbientAudioService - Manages ambient sound playback
 *
 * Uses expo-audio's createAudioPlayer to create a standalone AudioPlayer
 * that persists outside React lifecycle. Plays looping ambient nature sounds
 * simultaneously with the main Quran recitation player.
 *
 * Key behaviors:
 * - Separate AudioPlayer instance from the Quran player
 * - Always loops, always plays at 1.0x rate
 * - Independent volume control
 * - Fade in/out for smooth transitions
 */

import {createAudioPlayer, AudioPlayer} from 'expo-audio';
import {
  AmbientSoundType,
  AMBIENT_SOUNDS,
  AMBIENT_FADE_DURATION,
  AMBIENT_FADE_STEP,
  DEFAULT_AMBIENT_VOLUME,
} from '@/types/ambient';

class AmbientAudioService {
  private static instance: AmbientAudioService;
  private player: AudioPlayer | null = null;
  private currentSound: AmbientSoundType | null = null;
  private targetVolume: number = DEFAULT_AMBIENT_VOLUME;
  private fadeInterval: ReturnType<typeof setInterval> | null = null;
  private isPlaying = false;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): AmbientAudioService {
    if (!AmbientAudioService.instance) {
      AmbientAudioService.instance = new AmbientAudioService();
    }
    return AmbientAudioService.instance;
  }

  // ========== SOUND LOADING ==========

  /**
   * Load an ambient sound. Fully stops and releases the old player first,
   * then creates a fresh player with the bundled asset.
   *
   * Always forces a full reload even if the same sound type is requested,
   * because the player may be in a bad state (paused, volume 0, mid-fade).
   */
  loadSound(soundType: AmbientSoundType): void {
    const meta = AMBIENT_SOUNDS[soundType];
    if (!meta) {
      console.error('[AmbientAudio] Unknown sound type:', soundType);
      return;
    }

    // Always do a full teardown first — clear fades, pause, release
    this.stopAndRelease();

    try {
      if (__DEV__) console.log('[AmbientAudio] Loading sound:', soundType);

      // Create a new player with the bundled asset
      this.player = createAudioPlayer(meta.source);
      this.player.loop = true;
      this.player.volume = 0; // Start silent for fade-in
      this.currentSound = soundType;

      if (__DEV__) console.log('[AmbientAudio] Sound loaded:', soundType);
    } catch (error) {
      console.error('[AmbientAudio] Failed to load sound:', error);
      this.currentSound = null;
      this.player = null;
    }
  }

  // ========== PLAYBACK CONTROLS ==========

  /**
   * Start playing the loaded ambient sound.
   * If no sound is loaded, this is a no-op.
   */
  play(): void {
    if (!this.player) {
      if (__DEV__) console.warn('[AmbientAudio] Cannot play: no player');
      return;
    }

    try {
      this.player.play();
      this.isPlaying = true;
      if (__DEV__) console.log('[AmbientAudio] Playing');
    } catch (error) {
      console.error('[AmbientAudio] Play failed:', error);
    }
  }

  /**
   * Pause the ambient sound.
   */
  pause(): void {
    if (!this.player) return;

    try {
      this.player.pause();
      this.isPlaying = false;
      if (__DEV__) console.log('[AmbientAudio] Paused');
    } catch (error) {
      console.error('[AmbientAudio] Pause failed:', error);
    }
  }

  /**
   * Stop playback: clear fades, pause, release player, reset all state.
   */
  stop(): void {
    this.stopAndRelease();
    if (__DEV__) console.log('[AmbientAudio] Stopped');
  }

  // ========== VOLUME ==========

  /**
   * Set the target volume (0.0 - 1.0).
   * Applies immediately if playing without a fade in progress.
   */
  setVolume(volume: number): void {
    this.targetVolume = Math.max(0, Math.min(1, volume));

    if (this.player && !this.fadeInterval) {
      this.player.volume = this.targetVolume;
    }

    if (__DEV__)
      console.log('[AmbientAudio] Volume set to:', this.targetVolume);
  }

  /**
   * Get the current target volume.
   */
  getVolume(): number {
    return this.targetVolume;
  }

  // ========== FADE ==========

  /**
   * Fade in from 0 to targetVolume over AMBIENT_FADE_DURATION ms.
   */
  fadeIn(): void {
    if (!this.player) return;
    this.clearFade();

    this.player.volume = 0;
    this.play();

    const steps = Math.ceil(AMBIENT_FADE_DURATION / AMBIENT_FADE_STEP);
    const volumeStep = this.targetVolume / steps;
    let currentStep = 0;

    // Capture the player reference so the interval only touches THIS player
    const playerRef = this.player;

    this.fadeInterval = setInterval(() => {
      currentStep++;
      // Guard: if the player changed out from under us, abort this fade
      if (this.player !== playerRef) {
        this.clearFade();
        return;
      }
      if (currentStep >= steps) {
        playerRef.volume = this.targetVolume;
        this.clearFade();
        return;
      }
      playerRef.volume = Math.min(volumeStep * currentStep, this.targetVolume);
    }, AMBIENT_FADE_STEP);
  }

  /**
   * Fade out from current volume to 0, then pause.
   */
  fadeOut(): void {
    if (!this.player) return;
    this.clearFade();

    const startVolume = this.player.volume;
    if (startVolume <= 0) {
      this.pause();
      return;
    }

    const steps = Math.ceil(AMBIENT_FADE_DURATION / AMBIENT_FADE_STEP);
    const volumeStep = startVolume / steps;
    let currentStep = 0;

    // Capture the player reference so the interval only touches THIS player
    const playerRef = this.player;

    this.fadeInterval = setInterval(() => {
      currentStep++;
      // Guard: if the player changed out from under us, abort this fade
      if (this.player !== playerRef) {
        this.clearFade();
        return;
      }
      if (currentStep >= steps) {
        playerRef.volume = 0;
        this.pause();
        this.clearFade();
        return;
      }
      playerRef.volume = Math.max(startVolume - volumeStep * currentStep, 0);
    }, AMBIENT_FADE_STEP);
  }

  // ========== STATUS ==========

  /**
   * Check if ambient is currently playing.
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Get the currently loaded sound type.
   */
  getCurrentSound(): AmbientSoundType | null {
    return this.currentSound;
  }

  /**
   * Check if a player is loaded and ready.
   */
  hasPlayer(): boolean {
    return this.player !== null;
  }

  // ========== CLEANUP ==========

  /**
   * Internal: full teardown — clears fades, pauses the player, releases it,
   * and resets tracking state. Does NOT reset targetVolume.
   */
  private stopAndRelease(): void {
    this.clearFade();

    // Pause before releasing so the native layer stops output immediately
    if (this.player) {
      try {
        this.player.pause();
      } catch {
        // ignore — player may already be in a bad state
      }
      try {
        this.player.remove();
      } catch (error) {
        if (__DEV__)
          console.warn('[AmbientAudio] Error releasing player:', error);
      }
      this.player = null;
    }

    this.isPlaying = false;
    this.currentSound = null;
  }

  /**
   * Clear any in-progress fade animation.
   */
  private clearFade(): void {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
  }

  /**
   * Full cleanup - stop playback, release player, reset all state including volume.
   */
  cleanup(): void {
    this.stopAndRelease();
    this.targetVolume = DEFAULT_AMBIENT_VOLUME;
    if (__DEV__) console.log('[AmbientAudio] Cleaned up');
  }
}

// Export singleton instance
export const ambientAudioService = AmbientAudioService.getInstance();

// Export class for testing
export {AmbientAudioService};
