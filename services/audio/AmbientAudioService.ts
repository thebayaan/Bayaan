/**
 * AmbientAudioService - Manages ambient sound playback with gapless looping
 *
 * Uses a dual-player crossfade technique for seamless looping:
 * Two AudioPlayer instances (A and B) are loaded with the same sound.
 * When the active player nears the end of the track, the standby player
 * starts from the beginning with a short crossfade, eliminating the gap
 * that native loop = true produces.
 *
 * Key behaviors:
 * - Two AudioPlayer instances for gapless looping
 * - Separate from the Quran player
 * - Independent volume control
 * - Fade in/out for smooth start/stop transitions
 */

import {createAudioPlayer, AudioPlayer, AudioStatus} from 'expo-audio';
import {EventSubscription} from 'expo-modules-core';
import {
  AmbientSoundType,
  AMBIENT_SOUNDS,
  AMBIENT_FADE_DURATION,
  AMBIENT_FADE_STEP,
  DEFAULT_AMBIENT_VOLUME,
} from '@/types/ambient';

/**
 * How far before the end (seconds) to silently start the standby player.
 * Must be large enough for the native layer to fully buffer and begin decoding.
 */
const PRE_BUFFER_TIME = 6.0;

/** How far before the end (seconds) to begin the volume crossfade */
const CROSSFADE_WINDOW = 3.0;

/** How often the player emits status updates (ms) */
const STATUS_UPDATE_INTERVAL = 50;

/** Duration of the crossfade between players (ms) */
const CROSSFADE_DURATION = 2500;

/** Step interval for crossfade volume animation (ms) */
const CROSSFADE_STEP = 25;

class AmbientAudioService {
  private static instance: AmbientAudioService;

  // Dual players for gapless looping
  private playerA: AudioPlayer | null = null;
  private playerB: AudioPlayer | null = null;
  private activePlayer: 'A' | 'B' = 'A';
  private standbyPreStarted = false;
  private isCrossfading = false;
  private crossfadeInterval: ReturnType<typeof setInterval> | null = null;

  // Event subscriptions for playback status
  private subscriptionA: EventSubscription | null = null;
  private subscriptionB: EventSubscription | null = null;

  // State
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

  // ========== HELPERS ==========

  private getActive(): AudioPlayer | null {
    return this.activePlayer === 'A' ? this.playerA : this.playerB;
  }

  private getStandby(): AudioPlayer | null {
    return this.activePlayer === 'A' ? this.playerB : this.playerA;
  }

  private swapPlayers(): void {
    this.activePlayer = this.activePlayer === 'A' ? 'B' : 'A';
  }

  // ========== SOUND LOADING ==========

  /**
   * Load an ambient sound. Fully stops and releases both players first,
   * then creates two fresh players with the same bundled asset.
   */
  loadSound(soundType: AmbientSoundType): void {
    const meta = AMBIENT_SOUNDS[soundType];
    if (!meta) {
      console.error('[AmbientAudio] Unknown sound type:', soundType);
      return;
    }

    // Full teardown first
    this.stopAndRelease();

    try {
      if (__DEV__) console.log('[AmbientAudio] Loading sound:', soundType);

      // Create two players with the same source
      this.playerA = createAudioPlayer(meta.source, {
        updateInterval: STATUS_UPDATE_INTERVAL,
      });
      this.playerB = createAudioPlayer(meta.source, {
        updateInterval: STATUS_UPDATE_INTERVAL,
      });

      // No native loop — we handle it via crossfade
      this.playerA.loop = false;
      this.playerB.loop = false;

      // Start silent
      this.playerA.volume = 0;
      this.playerB.volume = 0;

      this.activePlayer = 'A';
      this.currentSound = soundType;

      // Listen for status updates on both players
      this.attachStatusListeners();

      if (__DEV__) console.log('[AmbientAudio] Sound loaded:', soundType);
    } catch (error) {
      console.error('[AmbientAudio] Failed to load sound:', error);
      this.currentSound = null;
      this.releaseAllPlayers();
    }
  }

  // ========== CROSSFADE STATUS LISTENER ==========

  private attachStatusListeners(): void {
    this.removeStatusListeners();

    if (this.playerA) {
      this.subscriptionA = this.playerA.addListener(
        'playbackStatusUpdate',
        (status: AudioStatus) => this.handleStatusUpdate('A', status),
      );
    }
    if (this.playerB) {
      this.subscriptionB = this.playerB.addListener(
        'playbackStatusUpdate',
        (status: AudioStatus) => this.handleStatusUpdate('B', status),
      );
    }
  }

  private removeStatusListeners(): void {
    if (this.subscriptionA) {
      this.subscriptionA.remove();
      this.subscriptionA = null;
    }
    if (this.subscriptionB) {
      this.subscriptionB.remove();
      this.subscriptionB = null;
    }
  }

  /**
   * Called on every status update from either player.
   *
   * Two-phase approach for gapless looping:
   * Phase 1 (PRE_BUFFER_TIME): Silently start the standby player at volume 0
   *   so the native layer has time to buffer and begin outputting audio.
   * Phase 2 (CROSSFADE_WINDOW): Ramp the standby volume up and active volume
   *   down. Since the standby is already playing, there's zero startup latency.
   */
  private handleStatusUpdate(which: 'A' | 'B', status: AudioStatus): void {
    // Only care about the active player
    if (which !== this.activePlayer) return;
    if (!this.isPlaying) return;

    const {currentTime, duration} = status;
    if (duration <= 0 || currentTime <= 0) return;

    const timeRemaining = duration - currentTime;

    // Phase 1: Pre-buffer the standby player silently
    if (
      !this.standbyPreStarted &&
      !this.isCrossfading &&
      timeRemaining <= PRE_BUFFER_TIME &&
      timeRemaining > CROSSFADE_WINDOW
    ) {
      this.preStartStandby();
    }

    // Phase 2: Begin the volume crossfade
    if (
      !this.isCrossfading &&
      timeRemaining <= CROSSFADE_WINDOW &&
      timeRemaining > 0
    ) {
      this.startCrossfade();
    }

    // Safety net: track finished without crossfade triggering
    if (status.didJustFinish && !this.isCrossfading) {
      this.handleTrackFinished();
    }
  }

  /**
   * Phase 1: Start the standby player at volume 0 from position 0.
   * This gives the native audio layer time to buffer and begin decoding,
   * so when the crossfade starts there's no startup latency.
   */
  private preStartStandby(): void {
    const standby = this.getStandby();
    if (!standby) return;

    try {
      standby.seekTo(0);
      standby.volume = 0;
      standby.play();
      this.standbyPreStarted = true;
      if (__DEV__)
        console.log('[AmbientAudio] Standby pre-started (buffering)');
    } catch (error) {
      console.error('[AmbientAudio] Failed to pre-start standby:', error);
    }
  }

  /**
   * Phase 2: The standby is already playing at volume 0.
   * Now ramp its volume up while fading the active player out.
   */
  private startCrossfade(): void {
    const active = this.getActive();
    const standby = this.getStandby();
    if (!active || !standby) return;

    this.isCrossfading = true;

    if (__DEV__) console.log('[AmbientAudio] Starting crossfade');

    // If standby wasn't pre-started (e.g. short track), start it now
    if (!this.standbyPreStarted) {
      try {
        standby.seekTo(0);
        standby.volume = 0;
        standby.play();
      } catch (error) {
        console.error('[AmbientAudio] Crossfade standby start failed:', error);
        this.isCrossfading = false;
        return;
      }
    }

    const steps = Math.ceil(CROSSFADE_DURATION / CROSSFADE_STEP);
    const activeStartVolume = active.volume;
    let currentStep = 0;

    // Capture references so the interval operates on the correct players
    const fadingOut = active;
    const fadingIn = standby;

    this.crossfadeInterval = setInterval(() => {
      currentStep++;
      const progress = Math.min(currentStep / steps, 1);

      try {
        fadingOut.volume = Math.max(activeStartVolume * (1 - progress), 0);
        fadingIn.volume = Math.min(
          this.targetVolume * progress,
          this.targetVolume,
        );
      } catch {
        // Player may have been released during crossfade
      }

      if (currentStep >= steps) {
        this.clearCrossfade();

        // Pause the old active and reset it for next time
        try {
          fadingOut.pause();
          fadingOut.seekTo(0);
          fadingOut.volume = 0;
        } catch {
          // ignore
        }

        // Ensure the new active is at target volume
        try {
          fadingIn.volume = this.targetVolume;
        } catch {
          // ignore
        }

        this.swapPlayers();
        this.standbyPreStarted = false;
        this.isCrossfading = false;

        if (__DEV__)
          console.log(
            '[AmbientAudio] Crossfade complete, active:',
            this.activePlayer,
          );
      }
    }, CROSSFADE_STEP);
  }

  /**
   * Safety net: if the active track ended without crossfade triggering
   * (e.g. very short file, or timing missed), immediately restart on standby.
   */
  private handleTrackFinished(): void {
    if (this.isCrossfading) return;

    const standby = this.getStandby();
    const active = this.getActive();
    if (!standby) return;

    if (__DEV__) console.log('[AmbientAudio] Track finished — immediate swap');

    try {
      standby.seekTo(0);
      standby.volume = this.targetVolume;
      standby.play();
    } catch (error) {
      console.error('[AmbientAudio] Failed to restart on standby:', error);
    }

    if (active) {
      try {
        active.pause();
        active.seekTo(0);
        active.volume = 0;
      } catch {
        // ignore
      }
    }

    this.swapPlayers();
    this.standbyPreStarted = false;
  }

  // ========== PLAYBACK CONTROLS ==========

  /**
   * Start playing the active player.
   */
  play(): void {
    const active = this.getActive();
    if (!active) {
      if (__DEV__) console.warn('[AmbientAudio] Cannot play: no player');
      return;
    }

    try {
      active.play();
      this.isPlaying = true;
      if (__DEV__) console.log('[AmbientAudio] Playing');
    } catch (error) {
      console.error('[AmbientAudio] Play failed:', error);
    }
  }

  /**
   * Pause both players and cancel any crossfade.
   */
  pause(): void {
    this.clearCrossfade();
    this.isCrossfading = false;
    this.standbyPreStarted = false;

    if (this.playerA) {
      try {
        this.playerA.pause();
      } catch {
        // ignore
      }
    }
    if (this.playerB) {
      try {
        this.playerB.pause();
      } catch {
        // ignore
      }
    }

    this.isPlaying = false;
    if (__DEV__) console.log('[AmbientAudio] Paused');
  }

  /**
   * Stop playback: tear down everything.
   */
  stop(): void {
    this.stopAndRelease();
    if (__DEV__) console.log('[AmbientAudio] Stopped');
  }

  // ========== VOLUME ==========

  /**
   * Set the target volume (0.0 - 1.0).
   * Applies immediately to the active player if not mid-fade.
   */
  setVolume(volume: number): void {
    this.targetVolume = Math.max(0, Math.min(1, volume));

    if (!this.fadeInterval && !this.isCrossfading) {
      const active = this.getActive();
      if (active && this.isPlaying) {
        active.volume = this.targetVolume;
      }
    }

    if (__DEV__)
      console.log('[AmbientAudio] Volume set to:', this.targetVolume);
  }

  getVolume(): number {
    return this.targetVolume;
  }

  // ========== FADE (START/STOP TRANSITIONS) ==========

  /**
   * Fade in from 0 to targetVolume. Uses the active player.
   */
  fadeIn(): void {
    const active = this.getActive();
    if (!active) return;
    this.clearFade();

    active.volume = 0;
    this.play();

    const steps = Math.ceil(AMBIENT_FADE_DURATION / AMBIENT_FADE_STEP);
    const volumeStep = this.targetVolume / steps;
    let currentStep = 0;

    const playerRef = active;

    this.fadeInterval = setInterval(() => {
      currentStep++;
      if (this.getActive() !== playerRef) {
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
   * Fade out from current volume to 0, then pause both players.
   */
  fadeOut(): void {
    const active = this.getActive();
    if (!active) return;
    this.clearFade();

    const startVolume = active.volume;
    if (startVolume <= 0) {
      this.pause();
      return;
    }

    const steps = Math.ceil(AMBIENT_FADE_DURATION / AMBIENT_FADE_STEP);
    const volumeStep = startVolume / steps;
    let currentStep = 0;

    const playerRef = active;

    this.fadeInterval = setInterval(() => {
      currentStep++;
      if (this.getActive() !== playerRef) {
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

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  getCurrentSound(): AmbientSoundType | null {
    return this.currentSound;
  }

  hasPlayer(): boolean {
    return this.playerA !== null || this.playerB !== null;
  }

  // ========== CLEANUP ==========

  private releasePlayer(player: AudioPlayer | null): void {
    if (!player) return;
    try {
      player.pause();
    } catch {
      // ignore
    }
    try {
      player.remove();
    } catch (error) {
      if (__DEV__)
        console.warn('[AmbientAudio] Error releasing player:', error);
    }
  }

  private releaseAllPlayers(): void {
    this.releasePlayer(this.playerA);
    this.releasePlayer(this.playerB);
    this.playerA = null;
    this.playerB = null;
  }

  /**
   * Full teardown — clears all intervals, removes listeners, releases
   * both players, resets state. Does NOT reset targetVolume.
   */
  private stopAndRelease(): void {
    this.clearFade();
    this.clearCrossfade();
    this.isCrossfading = false;
    this.standbyPreStarted = false;
    this.removeStatusListeners();
    this.releaseAllPlayers();
    this.isPlaying = false;
    this.currentSound = null;
  }

  private clearFade(): void {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
  }

  private clearCrossfade(): void {
    if (this.crossfadeInterval) {
      clearInterval(this.crossfadeInterval);
      this.crossfadeInterval = null;
    }
  }

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
