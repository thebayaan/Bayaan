/**
 * MushafAudioService - Manages audio playback for mushaf ayah-by-ayah reading
 *
 * Singleton service using createAudioPlayer() from expo-audio.
 * Loads surah audio, tracks current position via polling, and detects ayah changes
 * using binary search on timestamp data.
 *
 * Key differences from AmbientAudioService:
 * - No looping/crossfade (plays surah audio linearly)
 * - Ayah tracking via 200ms polling of currentTime
 * - Supports seeking to specific ayahs
 * - Rate control (0.5x - 2.0x)
 */

import {createAudioPlayer, AudioPlayer} from 'expo-audio';
import {EventSubscription} from 'expo-modules-core';
import type {AyahTimestamp} from '@/types/timestamps';
import {binarySearchAyah} from '@/utils/timestampUtils';
import {audioCoordinator} from './AudioCoordinator';

const AYAH_TRACKING_INTERVAL = 200; // ms

type AyahChangeCallback = (surahNumber: number, ayahNumber: number) => void;
type SurahEndCallback = () => void;

class MushafAudioService {
  private static instance: MushafAudioService;

  private player: AudioPlayer | null = null;
  private statusSubscription: EventSubscription | null = null;
  private trackingInterval: ReturnType<typeof setInterval> | null = null;

  // Current state
  private currentSurah: number = 0;
  private timestamps: AyahTimestamp[] = [];
  private lastTrackedAyah: number = -1;
  private isPlaying = false;
  private rate: number = 1.0;
  private _dispatchingAyahChange = false;

  // Callbacks
  private onAyahChange: AyahChangeCallback | null = null;
  private onSurahEnd: SurahEndCallback | null = null;

  private constructor() {}

  static getInstance(): MushafAudioService {
    if (!MushafAudioService.instance) {
      MushafAudioService.instance = new MushafAudioService();
    }
    return MushafAudioService.instance;
  }

  getPlayer(): AudioPlayer | null {
    return this.player;
  }

  // ========== CALLBACKS ==========

  setOnAyahChange(callback: AyahChangeCallback): void {
    this.onAyahChange = callback;
  }

  setOnSurahEnd(callback: SurahEndCallback): void {
    this.onSurahEnd = callback;
  }

  // ========== LOADING ==========

  /**
   * Load a surah for playback. Releases any previous player.
   */
  loadSurah(
    surahNumber: number,
    audioUrl: string,
    timestamps: AyahTimestamp[],
  ): void {
    // Release previous player
    this.releasePlayer();

    try {
      if (__DEV__)
        console.log(`[MushafAudio] Loading surah ${surahNumber}: ${audioUrl}`);

      this.player = createAudioPlayer({uri: audioUrl});
      this.player.loop = false;
      this.player.setPlaybackRate(this.rate, 'high');

      this.currentSurah = surahNumber;
      this.timestamps = timestamps;
      this.lastTrackedAyah = -1;

      // Listen for track end
      this.statusSubscription = this.player.addListener(
        'playbackStatusUpdate',
        status => {
          if (status.didJustFinish && this.isPlaying) {
            this.handleSurahEnd();
          }
        },
      );

      if (__DEV__)
        console.log(
          `[MushafAudio] Loaded surah ${surahNumber} with ${timestamps.length} timestamps`,
        );
    } catch (error) {
      console.error('[MushafAudio] Failed to load surah:', error);
      this.currentSurah = 0;
      this.timestamps = [];
    }
  }

  // ========== PLAYBACK CONTROLS ==========

  play(): void {
    if (!this.player) {
      if (__DEV__) console.warn('[MushafAudio] Cannot play: no player');
      return;
    }

    try {
      audioCoordinator.mushafWillPlay();
      this.player.play();
      this.isPlaying = true;
      this.startAyahTracking();
      if (__DEV__) console.log('[MushafAudio] Playing');
    } catch (error) {
      console.error('[MushafAudio] Play failed:', error);
    }
  }

  pause(): void {
    if (!this.player) return;

    try {
      this.player.pause();
      this.isPlaying = false;
      this.stopAyahTracking();
      if (__DEV__) console.log('[MushafAudio] Paused');
    } catch (error) {
      console.error('[MushafAudio] Pause failed:', error);
    }
  }

  /**
   * Seek to the start of a specific ayah.
   */
  seekToAyah(ayahNumber: number): void {
    if (!this.player || this.timestamps.length === 0) return;

    const timestamp = this.timestamps.find(t => t.ayahNumber === ayahNumber);
    if (!timestamp) {
      if (__DEV__)
        console.warn(`[MushafAudio] No timestamp for ayah ${ayahNumber}`);
      return;
    }

    try {
      // expo-audio seekTo expects seconds
      this.player.seekTo(timestamp.timestampFrom / 1000);
      this.lastTrackedAyah = ayahNumber;

      // Guard against re-entrancy: onAyahChange may call seekToAyah,
      // which would call onAyahChange again → infinite recursion.
      if (this.onAyahChange && !this._dispatchingAyahChange) {
        this._dispatchingAyahChange = true;
        try {
          this.onAyahChange(this.currentSurah, ayahNumber);
        } finally {
          this._dispatchingAyahChange = false;
        }
      }

      if (__DEV__)
        console.log(
          `[MushafAudio] Seeked to ayah ${ayahNumber} at ${timestamp.timestampFrom}ms`,
        );
    } catch (error) {
      console.error('[MushafAudio] Seek failed:', error);
    }
  }

  seekToNextAyah(): void {
    if (this.lastTrackedAyah < 0 || this.timestamps.length === 0) return;

    const nextAyah = this.lastTrackedAyah + 1;
    const maxAyah = this.timestamps[this.timestamps.length - 1].ayahNumber;

    if (nextAyah > maxAyah) {
      // End of surah — trigger surah end
      this.handleSurahEnd();
      return;
    }

    this.seekToAyah(nextAyah);
  }

  seekToPreviousAyah(): void {
    if (this.lastTrackedAyah <= 1 || this.timestamps.length === 0) return;

    const prevAyah = this.lastTrackedAyah - 1;
    const minAyah = this.timestamps[0].ayahNumber;

    if (prevAyah < minAyah) {
      // Already at first ayah — seek to beginning
      this.seekToAyah(minAyah);
      return;
    }

    this.seekToAyah(prevAyah);
  }

  setRate(rate: number): void {
    this.rate = Math.max(0.5, Math.min(2.0, rate));
    if (this.player) {
      this.player.setPlaybackRate(this.rate, 'high');
    }
    if (__DEV__) console.log(`[MushafAudio] Rate set to ${this.rate}`);
  }

  // ========== STATUS ==========

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  getCurrentSurah(): number {
    return this.currentSurah;
  }

  getCurrentPositionMs(): number {
    if (!this.player) return 0;
    return this.player.currentTime * 1000;
  }

  getDurationMs(): number {
    if (!this.player) return 0;
    return this.player.duration * 1000;
  }

  getLastTrackedAyah(): number {
    return this.lastTrackedAyah;
  }

  hasPlayer(): boolean {
    return this.player !== null;
  }

  // ========== AYAH TRACKING ==========

  private startAyahTracking(): void {
    this.stopAyahTracking();

    this.trackingInterval = setInterval(() => {
      if (!this.player || !this.isPlaying || this.timestamps.length === 0) {
        return;
      }

      const positionMs = this.player.currentTime * 1000;
      const ayah = binarySearchAyah(this.timestamps, positionMs);

      if (ayah && ayah.ayahNumber !== this.lastTrackedAyah) {
        this.lastTrackedAyah = ayah.ayahNumber;
        if (this.onAyahChange && !this._dispatchingAyahChange) {
          this._dispatchingAyahChange = true;
          try {
            this.onAyahChange(this.currentSurah, ayah.ayahNumber);
          } finally {
            this._dispatchingAyahChange = false;
          }
        }
      }
    }, AYAH_TRACKING_INTERVAL);
  }

  private stopAyahTracking(): void {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }
  }

  // ========== SURAH END ==========

  private handleSurahEnd(): void {
    this.isPlaying = false;
    this.stopAyahTracking();

    if (__DEV__) console.log(`[MushafAudio] Surah ${this.currentSurah} ended`);

    if (this.onSurahEnd) {
      this.onSurahEnd();
    }
  }

  // ========== CLEANUP ==========

  private releasePlayer(): void {
    this.stopAyahTracking();

    if (this.statusSubscription) {
      this.statusSubscription.remove();
      this.statusSubscription = null;
    }

    if (this.player) {
      try {
        this.player.pause();
      } catch {
        // ignore
      }
      try {
        this.player.remove();
      } catch (error) {
        if (__DEV__)
          console.warn('[MushafAudio] Error releasing player:', error);
      }
      this.player = null;
    }

    this.isPlaying = false;
  }

  /**
   * Full cleanup — stops playback and releases all resources.
   */
  cleanup(): void {
    this.releasePlayer();
    this.currentSurah = 0;
    this.timestamps = [];
    this.lastTrackedAyah = -1;
    audioCoordinator.sourceDidStop('mushaf');
    if (__DEV__) console.log('[MushafAudio] Cleaned up');
  }

  /**
   * Stop playback and return to idle. Keeps rate preference.
   */
  stop(): void {
    this.releasePlayer();
    this.currentSurah = 0;
    this.timestamps = [];
    this.lastTrackedAyah = -1;
    audioCoordinator.sourceDidStop('mushaf');
    if (__DEV__) console.log('[MushafAudio] Stopped');
  }
}

export const mushafAudioService = MushafAudioService.getInstance();
export {MushafAudioService};
