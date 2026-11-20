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
 *
 * Before the first verse (the isti'adha / basmala recited before verse 1 of a
 * surah whose basmala is drawn apart from its verses) it reports the intro
 * instead of a verse (setOnIntroChange; isInBasmalaIntro). @ai
 *
 * Every ayah number this service receives or reports is a TIMING ENTRY
 * number: the ayahNumber of the loaded timing set, in that set's own verse
 * numbering (a rewayah-numbered set counts the reciter's verses). Translation
 * to and from Hafs verse keys is the caller's job (mushafPlayerStore +
 * utils/timestampNumbering.ts).
 */

import {createAudioPlayer, AudioPlayer} from 'expo-audio';
import type {AudioStatus} from 'expo-audio'; // @ai

type EventSubscription = {remove(): void};
import type {AyahTimestamp} from '@/types/timestamps';
import {
  binarySearchAyah,
  isInBasmalaIntro, // @ai
} from '@/utils/timestampUtils';
import {audioCoordinator} from './AudioCoordinator';

const AYAH_TRACKING_INTERVAL = 200; // ms
// @ai-start
/**
 * Polls after seekToAyah() during which a position short of the seek target
 * (the seek not landed yet) is not taken for the intro.
 */
const SEEK_SETTLE_TICKS = 10;
/**
 * After our own play() or pause() the player's status is not acted on for
 * this long: a status sent before the call took effect can still arrive
 * after it, and would be taken for a pause (or a start) from outside.
 */
const NATIVE_SETTLE_MS = 1000;
/**
 * This close to the end of the audio, "not playing" is the surah ending, not
 * a pause: the end is reported by its own event, which may come second.
 */
const END_GUARD_S = 0.5;

const atAudioEnd = (currentTime: number, duration: number): boolean =>
  duration > 0 && currentTime >= duration - END_GUARD_S;
// @ai-end

type AyahChangeCallback = (surahNumber: number, ayahNumber: number) => void;
/** The audio entered (true) or left (false) the surah's intro. @ai */
type IntroChangeCallback = (surahNumber: number, inIntro: boolean) => void;
/**
 * 'finished': the audio reached its end. 'skipped': seekToNextAyah() was
 * called on the last timing entry.
 */
export type SurahEndReason = 'finished' | 'skipped';
type SurahEndCallback = (reason: SurahEndReason) => void;
// @ai-start
/**
 * The audio was paused (false) or started (true) by something other than
 * this service's play() / pause(): headphones unplugged, a call, another
 * app taking the audio, the lock screen's buttons.
 */
type PlayingChangeCallback = (playing: boolean) => void;
/** The loaded surah's audio cannot be played (the player's own message). */
type AudioErrorCallback = (message: string) => void;
// @ai-end

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
  // False while the loaded surah's verse numbering is unknown: previous /
  // next-ayah seeking is disabled instead of landing on unverified verses.
  private verseSeekingEnabled = true;
  // @ai-start
  // In the surah's intro (isInBasmalaIntro) at the last poll.
  private inIntro = false;
  // Target (ms) of the last seekToAyah() until the position reaches it, and
  // the polls left to wait for it.
  private pendingSeekMs: number | null = null;
  private pendingSeekTicks = 0;
  // Until this time (ms) the player's status is not acted on: see
  // NATIVE_SETTLE_MS.
  private settleUntil = 0;
  // Checks, once the status can be trusted, that play() did start the audio.
  private startCheckTimer: ReturnType<typeof setTimeout> | null = null;
  // The player went quiet without pause(): if its finish event follows, that
  // was the surah ending and is handled as such.
  private pausedFromOutside = false;
  // @ai-end

  // Callbacks
  private onAyahChange: AyahChangeCallback | null = null;
  private onSurahEnd: SurahEndCallback | null = null;
  private onIntroChange: IntroChangeCallback | null = null; // @ai
  private onPlayingChange: PlayingChangeCallback | null = null; // @ai
  private onAudioError: AudioErrorCallback | null = null; // @ai

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

  // @ai-start
  /**
   * Called when the audio enters the intro before the surah's first verse
   * (no verse is reported there) and when it leaves it, before the verse it
   * reaches is reported.
   */
  setOnIntroChange(callback: IntroChangeCallback): void {
    this.onIntroChange = callback;
  }

  /**
   * Called when the audio is paused or started from outside this service
   * (see PlayingChangeCallback), after getIsPlaying() and the verse tracking
   * have followed it.
   */
  setOnPlayingChange(callback: PlayingChangeCallback): void {
    this.onPlayingChange = callback;
  }

  /**
   * Called when the loaded surah's audio fails (no connection, a missing
   * file): nothing will play until a surah is loaded again.
   */
  setOnAudioError(callback: AudioErrorCallback): void {
    this.onAudioError = callback;
  }
  // @ai-end

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
      this.verseSeekingEnabled = true;
      this.resetIntro(); // @ai

      // Listen for track end
      // @ai-start
      // ...and for the audio being paused or started from outside.
      const player = this.player;
      this.statusSubscription = player.addListener(
        'playbackStatusUpdate',
        status => this.handleStatus(player, status),
      );
      // @ai-end

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
      this.pausedFromOutside = false; // @ai
      this.settleUntil = Date.now() + NATIVE_SETTLE_MS; // @ai
      this.scheduleStartCheck(); // @ai
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
      this.pausedFromOutside = false; // @ai
      this.settleUntil = Date.now() + NATIVE_SETTLE_MS; // @ai
      this.clearStartCheck(); // @ai
      this.stopAyahTracking();
      if (__DEV__) console.log('[MushafAudio] Paused');
    } catch (error) {
      console.error('[MushafAudio] Pause failed:', error);
    }
  }

  /**
   * Enable or disable previous / next-ayah seeking for the loaded surah.
   * Reset to enabled by loadSurah().
   */
  setVerseSeekingEnabled(enabled: boolean): void {
    this.verseSeekingEnabled = enabled;
  }

  isVerseSeekingEnabled(): boolean {
    return this.verseSeekingEnabled;
  }

  /**
   * Seek to the start of a timing entry (ayah number in the timing set's own
   * numbering). Returns false when there is no player or no such entry.
   */
  seekToAyah(ayahNumber: number): boolean {
    if (!this.player || this.timestamps.length === 0) return false;

    const timestamp = this.timestamps.find(t => t.ayahNumber === ayahNumber);
    if (!timestamp) {
      if (__DEV__)
        console.warn(`[MushafAudio] No timestamp for ayah ${ayahNumber}`);
      return false;
    }

    try {
      // expo-audio seekTo expects seconds
      this.player.seekTo(timestamp.timestampFrom / 1000);
      this.lastTrackedAyah = ayahNumber;
      // @ai-start
      // A verse is playing now: leave the intro, and do not take the old
      // position for it while the seek lands.
      this.pendingSeekMs = timestamp.timestampFrom;
      this.pendingSeekTicks = SEEK_SETTLE_TICKS;
      this.setIntro(false);
      // @ai-end

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
      return true;
    } catch (error) {
      console.error('[MushafAudio] Seek failed:', error);
      return false;
    }
  }

  // @ai-start
  /**
   * Returns false when nothing was done (verse seeking is off, or no verse
   * is being tracked yet), so the caller can tell a skip from a no-op.
   */
  seekToNextAyah(): boolean {
    if (!this.verseSeekingEnabled) return false;
    if (this.lastTrackedAyah < 0 || this.timestamps.length === 0) return false;

    const nextAyah = this.lastTrackedAyah + 1;
    const maxAyah = this.timestamps[this.timestamps.length - 1].ayahNumber;

    if (nextAyah > maxAyah) {
      // End of surah — trigger surah end
      this.handleSurahEnd('skipped');
      return true;
    }

    return this.seekToAyah(nextAyah);
  }

  /** Returns false when nothing was done (see seekToNextAyah). */
  seekToPreviousAyah(): boolean {
    if (!this.verseSeekingEnabled) return false;
    if (this.lastTrackedAyah <= 1 || this.timestamps.length === 0) return false;

    const prevAyah = this.lastTrackedAyah - 1;
    const minAyah = this.timestamps[0].ayahNumber;

    if (prevAyah < minAyah) {
      // Already at first ayah — seek to beginning
      return this.seekToAyah(minAyah);
    }

    return this.seekToAyah(prevAyah);
  }
  // @ai-end

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

  getTimestamps(): readonly AyahTimestamp[] {
    return this.timestamps;
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

      // @ai-start
      // The intro before verse 1 (an ayah-0 pre-roll entry is still reported
      // as before). Entering it, the first entry will be reported again when
      // reached, and the next-ayah control goes to it.
      if (this.pendingSeekMs !== null) {
        if (
          positionMs >= this.pendingSeekMs - 1 ||
          --this.pendingSeekTicks <= 0
        ) {
          this.pendingSeekMs = null;
        }
      }
      const inIntro =
        this.pendingSeekMs === null &&
        isInBasmalaIntro(this.timestamps, positionMs, this.currentSurah);
      if (inIntro && !this.inIntro) {
        this.lastTrackedAyah = this.timestamps[0].ayahNumber - 1;
      }
      this.setIntro(inIntro);
      // @ai-end

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

  // @ai-start
  private setIntro(inIntro: boolean): void {
    if (inIntro === this.inIntro) return;
    this.inIntro = inIntro;
    this.onIntroChange?.(this.currentSurah, inIntro);
  }

  /** A new surah, or none: not in an intro (no callback). */
  private resetIntro(): void {
    this.inIntro = false;
    this.pendingSeekMs = null;
    this.pendingSeekTicks = 0;
  }
  // @ai-end

  // @ai-start
  // ========== PAUSED OR STARTED FROM OUTSIDE ==========

  /**
   * The bar used to trust play() / pause() alone. When the headphones were
   * unplugged, a call came in or another app took the audio, the system
   * paused the player and the bar kept showing Pause over silence (the first
   * tap then only flipped the icon). After a call iOS resumes the player at
   * 1x whatever speed was chosen. So the player's own status is followed:
   * loaded, not playing and not buffering while we believe it plays is a
   * pause from outside; playing while we believe it is paused is a start
   * from outside, and gets its speed back.
   *
   * A status can be old by the time it arrives, so each change is confirmed
   * on the player itself, and nothing is concluded right after our own
   * play() / pause() (NATIVE_SETTLE_MS).
   */
  private handleStatus(player: AudioPlayer, status: AudioStatus): void {
    if (player !== this.player) return;

    // The audio could not be loaded, or broke mid-way (expo-audio reports it
    // as an `error` string on a status, on both platforms). The bar used to
    // show the verse as playing over silence, for good.
    if (typeof status.error === 'string' && status.error.length > 0) {
      console.warn('[MushafAudio] Audio failed:', status.error);
      this.isPlaying = false;
      this.pausedFromOutside = false;
      this.clearStartCheck();
      this.stopAyahTracking();
      this.onAudioError?.(status.error);
      return;
    }

    if (status.didJustFinish) {
      if (this.isPlaying || this.pausedFromOutside) {
        this.handleSurahEnd('finished');
      }
      return;
    }

    if (Date.now() < this.settleUntil) return;

    if (this.isPlaying) {
      if (
        status.isLoaded &&
        !status.playing &&
        !status.isBuffering &&
        !atAudioEnd(status.currentTime, status.duration) &&
        !player.playing
      ) {
        this.followPauseFromOutside();
      }
    } else if (status.playing && player.playing) {
      this.followStartFromOutside(player);
    }
  }

  private followPauseFromOutside(): void {
    this.isPlaying = false;
    this.pausedFromOutside = true;
    this.clearStartCheck();
    this.stopAyahTracking();
    if (__DEV__) console.log('[MushafAudio] Paused from outside');
    this.onPlayingChange?.(false);
  }

  private followStartFromOutside(player: AudioPlayer): void {
    // As play(): no other source may play along.
    audioCoordinator.mushafWillPlay();
    this.isPlaying = true;
    this.pausedFromOutside = false;
    // iOS resumes an interrupted player at 1x.
    player.setPlaybackRate(this.rate, 'high');
    this.startAyahTracking();
    if (__DEV__) console.log('[MushafAudio] Started from outside');
    this.onPlayingChange?.(true);
  }

  /**
   * play() can be refused without an error or a status (no audio focus
   * during a call, the device on silent), and a pause from outside during
   * the settle time is not acted on: look at the player once when it ends.
   */
  private scheduleStartCheck(): void {
    this.clearStartCheck();
    this.startCheckTimer = setTimeout(() => {
      this.startCheckTimer = null;
      const player = this.player;
      if (!player || !this.isPlaying) return;
      if (
        player.isLoaded &&
        !player.playing &&
        !player.isBuffering &&
        !atAudioEnd(player.currentTime, player.duration)
      ) {
        this.followPauseFromOutside();
      }
    }, NATIVE_SETTLE_MS);
  }

  private clearStartCheck(): void {
    if (this.startCheckTimer) {
      clearTimeout(this.startCheckTimer);
      this.startCheckTimer = null;
    }
  }
  // @ai-end

  // ========== SURAH END ==========

  private handleSurahEnd(reason: SurahEndReason): void {
    this.isPlaying = false;
    this.pausedFromOutside = false; // @ai
    this.clearStartCheck(); // @ai
    this.stopAyahTracking();

    if (__DEV__)
      console.log(`[MushafAudio] Surah ${this.currentSurah} ended (${reason})`);

    if (this.onSurahEnd) {
      this.onSurahEnd(reason);
    }
  }

  // ========== CLEANUP ==========

  private releasePlayer(): void {
    this.stopAyahTracking();
    // @ai-start
    this.clearStartCheck();
    this.pausedFromOutside = false;
    this.settleUntil = 0;
    // @ai-end

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
      // @ai-start
      // Give the lock screen back before the player goes. On iOS a removed
      // player that still held the entry stayed on the lock screen after
      // Stop, and its play button started that surah again with nothing in
      // the app able to stop it. A no-op when it does not hold the entry.
      try {
        this.player.clearLockScreenControls();
      } catch {
        // ignore
      }
      // @ai-end
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
    this.verseSeekingEnabled = true;
    this.resetIntro(); // @ai
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
    this.verseSeekingEnabled = true;
    this.resetIntro(); // @ai
    audioCoordinator.sourceDidStop('mushaf');
    if (__DEV__) console.log('[MushafAudio] Stopped');
  }
}

export const mushafAudioService = MushafAudioService.getInstance();
export {MushafAudioService};
