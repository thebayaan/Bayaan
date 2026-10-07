/**
 * LockScreenService - Bridges playerStore state to system lock screen controls
 *
 * Uses expo-audio's built-in lock screen API (setActiveForLockScreen / updateLockScreenMetadata).
 * Remote commands (play, pause, seek, skip) are handled natively by expo-audio — no JS routing needed.
 *
 * This service only manages: which player is active for lock screen, and metadata updates.
 */

import type {AudioPlayer, AudioMetadata} from 'expo-audio';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {
  useMushafPlayerStore,
  type MushafPlayerStoreState, // @ai
} from '@/store/mushafPlayerStore';
import {expoAudioService} from './ExpoAudioService';
import {mushafAudioService} from './MushafAudioService';
import {audioCoordinator} from './AudioCoordinator';

// @ai-start
function surahNameOf(surah: number): string | null {
  const surahData = require('@/data/surahData.json') as Array<{
    id: number;
    name: string;
  }>;
  return surahData.find(s => s.id === surah)?.name ?? null;
}

/**
 * Lock screen title for mushaf playback: "Al-Baqarah · 2:4", with the verse
 * in the numbering of the mushaf on screen (the player bar's label). The
 * surah name alone when the surah plays without verse tracking, or when what
 * is recited has no verse number in that mushaf. Null until the first verse
 * of a tracked surah is known (the title is left as it is meanwhile).
 */
export function mushafLockScreenTitle(
  state: Pick<
    MushafPlayerStoreState,
    'currentSurah' | 'currentVerseKey' | 'currentVerseLabel' | 'numberingMode'
  >,
  surahName: (surah: number) => string | null = surahNameOf,
): string | null {
  const {currentSurah, currentVerseKey, currentVerseLabel, numberingMode} =
    state;
  if (currentSurah <= 0) return null;
  const name = surahName(currentSurah);
  if (numberingMode === 'disabled') return name;
  if (!currentVerseKey) return null;
  if (!currentVerseLabel) return name;
  return name ? `${name} · ${currentVerseLabel}` : currentVerseLabel;
}
// @ai-end

class LockScreenService {
  private static instance: LockScreenService;
  private storeUnsubscribe: (() => void) | null = null;
  private mushafStoreUnsubscribe: (() => void) | null = null;
  private lastTrackId: string | null = null;
  private isMushafActive = false;
  private lastMushafTitle: string | null = null; // @ai

  private constructor() {}

  static getInstance(): LockScreenService {
    if (!LockScreenService.instance) {
      LockScreenService.instance = new LockScreenService();
    }
    return LockScreenService.instance;
  }

  /**
   * Start syncing store state to lock screen metadata.
   * expo-audio handles remote commands and playback state natively.
   */
  async startSync(): Promise<void> {
    this.subscribeToStore();
    this.subscribeToMushafStore();
    this.syncCurrentState();

    if (__DEV__) console.log('[LockScreenService] Sync started');
  }

  /**
   * Stop all syncing and clear lock screen.
   */
  stopSync(): void {
    if (this.storeUnsubscribe) {
      this.storeUnsubscribe();
      this.storeUnsubscribe = null;
    }
    if (this.mushafStoreUnsubscribe) {
      this.mushafStoreUnsubscribe();
      this.mushafStoreUnsubscribe = null;
    }

    // Clear lock screen for both players
    this.clearPlayer(expoAudioService.getPlayer());
    this.clearPlayer(mushafAudioService.getPlayer());

    this.lastTrackId = null;
    this.isMushafActive = false;
    this.lastMushafTitle = null; // @ai

    if (__DEV__) console.log('[LockScreenService] Sync stopped');
  }

  /**
   * Alias for stopSync — no separate native teardown needed with expo-audio.
   */
  async cleanup(): Promise<void> {
    this.stopSync();
    if (__DEV__) console.log('[LockScreenService] Cleaned up');
  }

  // ========== PRIVATE ==========

  private clearPlayer(player: AudioPlayer | null): void {
    try {
      player?.clearLockScreenControls();
    } catch {
      // Player may already be removed
    }
  }

  private syncCurrentState(): void {
    const state = usePlayerStore.getState();
    const {queue} = state;
    const currentTrack = queue.tracks[queue.currentIndex];

    if (currentTrack) {
      this.lastTrackId = currentTrack.id;
      this.activateMainPlayer(currentTrack);
    }
  }

  private activateMainPlayer(track: {
    title: string;
    artist: string;
    artwork?: string;
    duration?: number;
  }): void {
    const player = expoAudioService.getPlayer();
    if (!player) return;

    const metadata: AudioMetadata = {
      title: track.title,
      artist: track.artist,
      artworkUrl: track.artwork,
    };

    try {
      player.setActiveForLockScreen(true, metadata, {
        showSeekForward: true,
        showSeekBackward: true,
      });
    } catch (error) {
      if (__DEV__)
        console.warn(
          '[LockScreenService] Failed to activate main player:',
          error,
        );
    }
  }

  private activateMushafPlayer(title: string, artist: string): void {
    const player = mushafAudioService.getPlayer();
    if (!player) return;

    // Deactivate main player first
    this.clearPlayer(expoAudioService.getPlayer());

    const metadata: AudioMetadata = {
      title,
      artist,
    };

    try {
      player.setActiveForLockScreen(true, metadata, {
        showSeekForward: false,
        showSeekBackward: false,
      });
    } catch (error) {
      if (__DEV__)
        console.warn(
          '[LockScreenService] Failed to activate mushaf player:',
          error,
        );
    }
  }

  private subscribeToStore(): void {
    this.storeUnsubscribe = usePlayerStore.subscribe(state => {
      if (this.isMushafActive) return;

      const {queue} = state;
      const currentTrack = queue.tracks[queue.currentIndex];

      // Update when track changes
      if (currentTrack && currentTrack.id !== this.lastTrackId) {
        this.lastTrackId = currentTrack.id;
        this.activateMainPlayer(currentTrack);
      }
    });
  }

  private subscribeToMushafStore(): void {
    this.mushafStoreUnsubscribe = useMushafPlayerStore.subscribe(state => {
      const {playbackState, reciterName} = state; // @ai

      // Detect mushaf becoming active
      if (playbackState === 'playing' || playbackState === 'loading') {
        if (!this.isMushafActive) {
          this.isMushafActive = true;
          if (__DEV__)
            console.log('[LockScreenService] Mushaf override activated');
        }
      }

      // @ai-start
      // Update metadata when the title changes: a new verse, or a new surah
      // even when it has no verse tracking (it must not keep the previous
      // surah's title).
      const title = this.isMushafActive ? mushafLockScreenTitle(state) : null;
      if (title && title !== this.lastMushafTitle) {
        this.lastMushafTitle = title;
        try {
          const player = mushafAudioService.getPlayer();
          if (player) {
            player.updateLockScreenMetadata({
              title,
              artist: reciterName || 'Quran',
            });
          }
        } catch {
          // Silently ignore metadata update failures
        }
      }
      // @ai-end

      // Detect mushaf becoming idle — revert to main player
      if (this.isMushafActive && playbackState === 'idle') {
        this.isMushafActive = false;
        this.lastMushafTitle = null; // @ai

        // Clear mushaf lock screen and restore main player
        this.clearPlayer(mushafAudioService.getPlayer());
        this.lastTrackId = null;
        this.syncCurrentState();

        if (__DEV__) console.log('[LockScreenService] Mushaf override cleared');
      }
    });
  }
}

export const lockScreenService = LockScreenService.getInstance();
