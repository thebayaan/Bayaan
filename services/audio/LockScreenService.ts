/**
 * LockScreenService - Bridges playerStore state to system lock screen controls
 *
 * Uses expo-audio's built-in lock screen API (setActiveForLockScreen / updateLockScreenMetadata).
 * Remote commands (play, pause, seek, skip) are handled natively by expo-audio — no JS routing needed.
 *
 * This service only manages: which player is active for lock screen, and metadata updates.
 * The exception is adhkar's next / previous (patched expo-audio trackControls),
 * which the adhkar engine handles in JS.
 */

import {Platform} from 'react-native';
import type {AudioPlayer, AudioMetadata} from 'expo-audio';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {
  useMushafPlayerStore,
  type MushafPlayerStoreState, // @ai
} from '@/store/mushafPlayerStore';
import {expoAudioService} from './ExpoAudioService';
import {mushafAudioService} from './MushafAudioService';
import {audioCoordinator} from './AudioCoordinator';
import type {AdhkarSession} from '@/services/adhkar/playback/types';
import {
  cachedAdhkarArtworkUri,
  loadAdhkarArtworkUri,
} from '@/services/adhkar/playback/adhkarArtwork';
import {
  adhkarTrackControls,
  type AdhkarTrackControls,
} from '@/services/adhkar/playback/trackControls';
import branding from '@/config/branding';
import i18n from '@/i18n';

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

/** Lock screen title for adhkar playback: "Morning Adhkar · 4 of 23". */
export function adhkarLockScreenTitle(
  session: AdhkarSession,
  position: (current: number, total: number) => string,
): string {
  return `${session.listTitle} · ${position(session.index + 1, session.items.length)}`;
}

// Lists recited by Alafasy (the credits: morning and evening adhkar and the
// Quranic duas). The rest of Hisn al-Muslim, and Saved, show the app name.
const ALAFASY_LISTS: ReadonlySet<string> = new Set([
  'morning-adhkar',
  'evening-adhkar',
  'quranic-duas',
]);

export interface AdhkarLockScreenLabels {
  position: (current: number, total: number) => string;
  alafasy: string;
  appName: string;
}

/**
 * Lock screen metadata for adhkar playback: the dhikr's place in the list,
 * the reciter (or the app name), the list as the album, and the list's
 * artwork once resolved.
 */
export function adhkarLockScreenMetadata(
  session: AdhkarSession,
  labels: AdhkarLockScreenLabels,
  artworkUrl?: string,
): AudioMetadata {
  const metadata: AudioMetadata = {
    title: adhkarLockScreenTitle(session, labels.position),
    artist: ALAFASY_LISTS.has(session.listId) ? labels.alafasy : labels.appName,
    albumTitle: session.listTitle,
  };
  if (artworkUrl) metadata.artworkUrl = artworkUrl;
  return metadata;
}

function sameTrackControls(
  a: AdhkarTrackControls | null,
  b: AdhkarTrackControls | null,
): boolean {
  if (!a || !b) return a === b;
  return a.previous === b.previous && a.next === b.next;
}

function adhkarLabels(): AdhkarLockScreenLabels {
  return {
    position: (current, total) =>
      i18n.t('home:adhkar.position', {current, total}),
    alafasy: i18n.t('settings:credits.items.alafasyTitle'),
    appName: branding.appName,
  };
}

class LockScreenService {
  private static instance: LockScreenService;
  private storeUnsubscribe: (() => void) | null = null;
  private mushafStoreUnsubscribe: (() => void) | null = null;
  private lastTrackId: string | null = null;
  private isMushafActive = false;
  private lastMushafTitle: string | null = null; // @ai
  private carMode = false;
  private carAyahLabel: string | null = null;
  private adhkarPlayer: AudioPlayer | null = null;
  private adhkarActive = false;
  private adhkarSession: AdhkarSession | null = null;
  // The next / previous last given to the adhkar entry; null when off.
  private adhkarTrackControls: AdhkarTrackControls | null = null;

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
    if (this.adhkarPlayer) {
      this.clearPlayer(this.adhkarPlayer);
      this.adhkarPlayer = null;
      this.adhkarSession = null;
      this.adhkarTrackControls = null;
      this.adhkarActive = false;
    }

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

  /**
   * While a car is connected, hide the 10s skip buttons so CarPlay shows
   * previous / next surah instead. Restored on disconnect. On Android this
   * only affects the phone notification.
   */
  setCarMode(enabled: boolean): void {
    if (this.carMode === enabled) return;
    this.carMode = enabled;
    if (this.adhkarPlayer && this.adhkarActive && this.adhkarSession) {
      this.applyAdhkarTrackControls(
        this.adhkarPlayer,
        this.trackControlsFor(this.adhkarSession),
      );
    }
    if (this.isMushafActive || this.adhkarPlayer) return;
    const {queue} = usePlayerStore.getState();
    const track = queue.tracks[queue.currentIndex];
    if (track) this.activateMainPlayer(track);
  }

  /**
   * Car mode only: the current ayah ("Ayah 12 of 110") shown after the
   * reciter on CarPlay's Now Playing, which reads the lock screen metadata.
   * iOS only: Android Auto reads the car bridge's now playing instead, and
   * expo-audio on Android reloads the artwork on every metadata update.
   * Null clears it.
   */
  setCarAyahLabel(label: string | null): void {
    if (Platform.OS !== 'ios') return;
    if (this.carAyahLabel === label) return;
    this.carAyahLabel = label;
    if (this.isMushafActive || this.adhkarPlayer) return;
    const player = expoAudioService.getPlayer();
    const {queue} = usePlayerStore.getState();
    const track = queue.tracks[queue.currentIndex];
    if (!player || !track) return;
    try {
      player.updateLockScreenMetadata(this.mainMetadata(track));
    } catch {
      // Player may not be active for the lock screen yet
    }
  }

  /** True while the adhkar session holds the lock screen entry. */
  isAdhkarHeld(): boolean {
    return this.adhkarPlayer !== null;
  }

  /** True while the adhkar entry shows its own next / previous. */
  hasAdhkarTrackControls(): boolean {
    return this.adhkarTrackControls !== null;
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

  private mainMetadata(track: {
    title: string;
    artist: string;
    artwork?: string;
  }): AudioMetadata {
    const label = this.carMode ? this.carAyahLabel : null;
    return {
      title: track.title,
      artist: label ? `${track.artist} · ${label}` : track.artist,
      artworkUrl: track.artwork,
    };
  }

  private activateMainPlayer(track: {
    title: string;
    artist: string;
    artwork?: string;
    duration?: number;
  }): void {
    const player = expoAudioService.getPlayer();
    if (!player) return;

    const metadata = this.mainMetadata(track);

    try {
      player.setActiveForLockScreen(true, metadata, {
        showSeekForward: !this.carMode,
        showSeekBackward: !this.carMode,
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

  /**
   * Adhkar keeps its lock screen entry while paused, so lock screen play can
   * resume it. Whenever the Quran or mushaf takes the lock screen, that entry
   * goes, because the engine never hears about a start on an already paused
   * session.
   */
  private dropAdhkarEntry(): void {
    if (!this.adhkarPlayer) return;
    this.clearPlayer(this.adhkarPlayer);
    this.adhkarPlayer = null;
    this.adhkarSession = null;
    this.adhkarTrackControls = null;
    this.adhkarActive = false;
    this.lastTrackId = null;
  }

  private subscribeToStore(): void {
    this.storeUnsubscribe = usePlayerStore.subscribe(state => {
      if (this.isMushafActive) return;
      // A held adhkar entry blocks main track changes only until the main
      // player actually plays; then the entry is dropped and main takes over.
      // The coordinator decides who plays: right after adhkarWillPlay paused
      // the main player, its store can still read 'playing' for a moment.
      if (this.adhkarPlayer) {
        if (
          state.playback?.state !== 'playing' ||
          audioCoordinator.getActiveSource() === 'adhkar'
        )
          return;
        this.dropAdhkarEntry();
      }

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
        // Also on a paused to playing resume, which keeps isMushafActive.
        if (
          this.adhkarPlayer &&
          audioCoordinator.getActiveSource() !== 'adhkar'
        )
          this.dropAdhkarEntry();
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

        // Clear mushaf lock screen and restore main player, unless adhkar
        // holds the lock screen.
        this.clearPlayer(mushafAudioService.getPlayer());
        this.lastTrackId = null;
        if (!this.adhkarPlayer) this.syncCurrentState();

        if (__DEV__) console.log('[LockScreenService] Mushaf override cleared');
      }
    });
  }

  /**
   * Show the adhkar session on the lock screen. Called once per track; the
   * same player already active only gets new metadata.
   */
  activateAdhkar(player: AudioPlayer, session: AdhkarSession): void {
    const artworkUrl = cachedAdhkarArtworkUri(session.listId);
    const metadata = adhkarLockScreenMetadata(
      session,
      adhkarLabels(),
      artworkUrl,
    );
    const trackControls = this.trackControlsFor(session);

    try {
      if (this.adhkarPlayer === player && this.adhkarActive) {
        this.adhkarSession = session;
        player.updateLockScreenMetadata(metadata);
        this.applyAdhkarTrackControls(player, trackControls);
      } else {
        this.adhkarPlayer = player;
        this.adhkarSession = session;
        // adhkarWillPlay leaves the mushaf 'paused', not 'idle', so its
        // override would otherwise outlive it and restore main on a later stop.
        this.isMushafActive = false;
        this.lastMushafTitle = null; // @ai
        this.clearPlayer(expoAudioService.getPlayer());
        this.clearPlayer(mushafAudioService.getPlayer());
        player.setActiveForLockScreen(true, metadata, {
          showSeekForward: false,
          showSeekBackward: false,
          ...(trackControls ? {trackControls} : {}),
        });
        this.adhkarActive = true;
        this.adhkarTrackControls = trackControls;
      }
    } catch (error) {
      if (__DEV__)
        console.warn(
          '[LockScreenService] Failed to activate adhkar player:',
          error,
        );
      return;
    }
    if (!artworkUrl) this.loadAdhkarArtwork(player, session.listId);
  }

  /**
   * The adhkar entry's next / previous. Off on iOS while a car is connected:
   * CarPlay registers its own next / previous on the shared remote command
   * center and sends them through the car bridge, which routes them to the
   * session (two targets would skip twice).
   */
  private trackControlsFor(session: AdhkarSession): AdhkarTrackControls | null {
    if (this.carMode && Platform.OS === 'ios') return null;
    return adhkarTrackControls(session);
  }

  /** Updates the entry's next / previous when they change. */
  private applyAdhkarTrackControls(
    player: AudioPlayer,
    controls: AdhkarTrackControls | null,
  ): void {
    if (sameTrackControls(this.adhkarTrackControls, controls)) return;
    this.adhkarTrackControls = controls;
    try {
      // Absent on binaries built without the expo-audio patch.
      player.setLockScreenTrackControls?.(controls);
    } catch (error) {
      if (__DEV__)
        console.warn(
          '[LockScreenService] Adhkar track controls failed:',
          error,
        );
    }
  }

  /**
   * Adds the list's artwork once its file is ready, if the same player still
   * holds the lock screen for the same list.
   */
  private loadAdhkarArtwork(player: AudioPlayer, listId: string): void {
    loadAdhkarArtworkUri(listId)
      .then(uri => {
        const session = this.adhkarSession;
        if (
          !uri ||
          this.adhkarPlayer !== player ||
          !this.adhkarActive ||
          session?.listId !== listId
        )
          return;
        player.updateLockScreenMetadata(
          adhkarLockScreenMetadata(session, adhkarLabels(), uri),
        );
      })
      .catch(error => {
        if (__DEV__)
          console.warn('[LockScreenService] Adhkar artwork failed:', error);
      });
  }

  /**
   * Remove the adhkar entry and restore the main player's. A no-op when the
   * entry already went to another source, and main is not restored over a
   * playing mushaf.
   */
  clearAdhkar(player: AudioPlayer): void {
    if (this.adhkarPlayer !== player) return;
    this.clearPlayer(player);
    this.adhkarPlayer = null;
    this.adhkarSession = null;
    this.adhkarTrackControls = null;
    this.adhkarActive = false;
    this.lastTrackId = null;
    if (!this.isMushafActive) this.syncCurrentState();
  }
}

export const lockScreenService = LockScreenService.getInstance();
