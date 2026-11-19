import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {Reciter, RECITERS} from '@/data/reciterData';
import {Surah, SURAHS} from '@/data/surahData';
import {persistStorage} from '@/utils/storage'; // @ai
import {usePlayerStore} from '@/services/player/store/playerStore';

export interface RecentlyPlayedTrack {
  reciter: Reciter;
  surah: Surah;
  rewayatId: string;
  progress: number;
  duration: number;
  timestamp: number;
  /** When true, this entry represents a user-uploaded recitation */
  isUserUpload?: boolean;
  /** ID into uploadsStore.recitations for uploaded tracks */
  userRecitationId?: string;
  /** Display title override for uploads (e.g., filename or custom title) */
  uploadTitle?: string;
  /** Display artist override for uploads (e.g., "My Recitations") */
  uploadArtist?: string;
}

// @ai How long after a new head card a tick for an older card's own surah
// is taken as that card's last report, not as what is playing now.
const STALE_TICK_WINDOW_MS = 5000;

/**
 * The key (`reciterId:surahId`) under which the player's current track
 * reports its progress to updateProgress(). None for an upload: it reports
 * through updateUploadProgress(), which never makes a card.
 */
function reportingTrackKey(): string | undefined {
  const {queue} = usePlayerStore.getState();
  const track = queue.tracks[queue.currentIndex];
  if (!track?.reciterId || !track.surahId) return undefined;
  if (track.isUserUpload && track.userRecitationId) return undefined;
  return `${track.reciterId}:${parseInt(track.surahId, 10)}`;
}

interface RecentlyPlayedState {
  recentTracks: RecentlyPlayedTrack[];
  progressMap: Record<string, number>;
  durationMap: Record<string, number>;
  /**
   * The track (`reciterId:surahId`) that was in the player when the user
   * cleared the list or removed that track's card. The track goes on
   * reporting its progress (on each tick, and whenever the app is left, even
   * while paused), and those reports do not make the card again. A report
   * from another track, or a new chain, ends this. Saved, because the player
   * restores the same track on the next launch.
   */
  dismissedKey?: string;

  /** Overwrites recentTracks[0] in place. Used for auto-advance and progress updates. */
  updateActiveChain: (
    reciter: Reciter,
    surah: Surah,
    progress: number,
    duration: number,
    rewayatId: string,
  ) => void;

  /** Pushes old [0] down, creates fresh [0]. Used for explicit user-initiated plays. */
  startNewChain: (
    reciter: Reciter,
    surah: Surah,
    progress: number,
    duration: number,
    rewayatId: string,
  ) => void;

  /** Promotes entry at index to [0] without duplication. Used when tapping a recent card. */
  resumeChain: (index: number) => void;

  /** High-frequency progress ticker. Updates maps + recentTracks[0] (handles auto-advance surah change). */
  updateProgress: (
    reciterId: string,
    surahId: number,
    progress: number,
    duration: number,
  ) => void;

  /** Pushes old [0] down, creates fresh [0] for an uploaded recitation. */
  startUploadChain: (
    reciter: Reciter,
    surah: Surah,
    progress: number,
    duration: number,
    rewayatId: string,
    uploadMeta: {
      userRecitationId: string;
      uploadTitle: string;
      uploadArtist: string;
    },
  ) => void;

  /** Updates progress for an upload track in recentTracks. */
  updateUploadProgress: (
    userRecitationId: string,
    progress: number,
    duration: number,
  ) => void;

  /** Removes a single track by index. */
  removeTrack: (index: number) => void;

  /** Clears all recent tracks. */
  clearRecentTracks: () => void;

  reset: () => void;
}

export const useRecentlyPlayedStore = create<RecentlyPlayedState>()(
  persist(
    (set, _get) => ({
      recentTracks: [],
      progressMap: {},
      durationMap: {},

      updateActiveChain: (reciter, surah, progress, duration, rewayatId) =>
        set(state => {
          const key = `${reciter.id}:${surah.id}`;
          const entry: RecentlyPlayedTrack = {
            reciter,
            surah,
            rewayatId,
            progress,
            duration,
            timestamp: Date.now(),
          };
          const updated = [...state.recentTracks];
          if (updated.length === 0) {
            updated.push(entry);
          } else {
            updated[0] = entry;
          }
          return {
            recentTracks: updated,
            progressMap: {...state.progressMap, [key]: progress},
            durationMap: {...state.durationMap, [key]: duration},
          };
        }),

      startNewChain: (reciter, surah, progress, duration, rewayatId) =>
        set(state => {
          const key = `${reciter.id}:${surah.id}`;
          // Remove any existing entry for this reciter (one card per reciter)
          const withoutDupe = state.recentTracks.filter(
            t => t.reciter.id !== reciter.id,
          );
          return {
            recentTracks: [
              {
                reciter,
                surah,
                rewayatId,
                progress,
                duration,
                timestamp: Date.now(),
              },
              ...withoutDupe,
            ].slice(0, 10),
            progressMap: {...state.progressMap, [key]: progress},
            durationMap: {...state.durationMap, [key]: duration},
            // A new play ends a dismissal (see dismissedKey).
            dismissedKey: undefined,
          };
        }),

      startUploadChain: (
        reciter,
        surah,
        progress,
        duration,
        rewayatId,
        uploadMeta,
      ) =>
        set(state => {
          const key = `upload:${uploadMeta.userRecitationId}`;
          // Remove any existing entry for this upload
          const withoutDupe = state.recentTracks.filter(
            t => t.userRecitationId !== uploadMeta.userRecitationId,
          );
          return {
            recentTracks: [
              {
                reciter,
                surah,
                rewayatId,
                progress,
                duration,
                timestamp: Date.now(),
                isUserUpload: true,
                userRecitationId: uploadMeta.userRecitationId,
                uploadTitle: uploadMeta.uploadTitle,
                uploadArtist: uploadMeta.uploadArtist,
              },
              ...withoutDupe,
            ].slice(0, 10),
            progressMap: {...state.progressMap, [key]: progress},
            durationMap: {...state.durationMap, [key]: duration},
            // A new play ends a dismissal (see dismissedKey).
            dismissedKey: undefined,
          };
        }),

      updateUploadProgress: (userRecitationId, progress, duration) =>
        set(state => {
          const key = `upload:${userRecitationId}`;
          const maps = {
            progressMap: {...state.progressMap, [key]: progress},
            durationMap: {...state.durationMap, [key]: duration},
            // Another track is playing now (see dismissedKey).
            dismissedKey: undefined,
          };

          // Find and update the upload entry
          const idx = state.recentTracks.findIndex(
            t => t.userRecitationId === userRecitationId,
          );
          if (idx === -1) return maps;

          const updated = [...state.recentTracks];
          updated[idx] = {...updated[idx], progress, duration};
          return {recentTracks: updated, ...maps};
        }),

      resumeChain: (index: number) =>
        set(state => {
          if (index <= 0 || index >= state.recentTracks.length) return state;
          const updated = [...state.recentTracks];
          const [entry] = updated.splice(index, 1);
          updated.unshift({...entry, timestamp: Date.now()});
          return {recentTracks: updated};
        }),

      updateProgress: (reciterId, surahId, progress, duration) =>
        set(state => {
          const key = `${reciterId}:${surahId}`;
          const maps = {
            progressMap: {...state.progressMap, [key]: progress},
            durationMap: {...state.durationMap, [key]: duration},
            // A report from another track ends a dismissal (see dismissedKey).
            dismissedKey: state.dismissedKey === key ? key : undefined,
          };

          // @ai-start
          // The ticker reports the player's current track, so its rewayah is
          // the one that is playing.
          const playerState = usePlayerStore.getState();
          const currentTrack =
            playerState.queue.tracks[playerState.queue.currentIndex];
          const playingRewayatId =
            currentTrack?.reciterId === reciterId &&
            currentTrack?.surahId === String(surahId)
              ? currentTrack.rewayatId
              : undefined;

          const head: RecentlyPlayedTrack | undefined = state.recentTracks[0];

          // Same reciter — update [0] in place (handles surah auto-advance).
          // The rewayah follows the track too: a queue can hold the same
          // reciter in two rewayat. An upload's card is never the same
          // recitation as a catalogue track, whoever it is tagged with.
          if (head && !head.isUserUpload && head.reciter.id === reciterId) {
            const surah =
              head.surah.id === surahId
                ? head.surah
                : (SURAHS.find(s => s.id === surahId) ?? head.surah);
            return {
              recentTracks: [
                {
                  ...head,
                  surah,
                  rewayatId: playingRewayatId ?? head.rewayatId,
                  progress,
                  duration,
                },
                ...state.recentTracks.slice(1),
              ],
              ...maps,
            };
          }

          // A different card is at [0], and this reciter has one further
          // down. Right after startNewChain() pushed that card down, the old
          // track can still report a last tick before the new one loads:
          // that tick only updates its own card. It is recognised by being
          // for the surah that the card already shows, just after a new
          // head was made.
          const belowIndex = state.recentTracks.findIndex(
            (t, i) => i > 0 && !t.isUserUpload && t.reciter.id === reciterId,
          );
          const below =
            belowIndex === -1 ? undefined : state.recentTracks[belowIndex];
          if (
            below &&
            head &&
            below.surah.id === surahId &&
            Date.now() - head.timestamp < STALE_TICK_WINDOW_MS
          ) {
            const updated = [...state.recentTracks];
            updated[belowIndex] = {...below, progress, duration};
            return {recentTracks: updated, ...maps};
          }

          // The user cleared the list, or removed this track's card, while
          // it was in the player. Its reports do not bring the card back.
          if (state.dismissedKey === key) {
            return maps;
          }

          // Otherwise this is what is playing now, reached without a new
          // chain: a queue that mixes reciters (Loved, a playlist, Downloads)
          // moved on to this track, or playback began from a screen that
          // starts no chain. It becomes the head. This used to write the
          // progress onto the reciter's old card, leaving that card on
          // another surah with this track's position, and leaving a track
          // that had finished as the one that the app restored on launch.
          const newReciter =
            RECITERS.find(r => r.id === reciterId) ?? below?.reciter;
          const newSurah = SURAHS.find(s => s.id === surahId);
          if (!newReciter || !newSurah) {
            return maps;
          }

          const rewayatId =
            playingRewayatId ??
            (below?.surah.id === surahId ? below.rewayatId : undefined) ??
            newReciter.rewayat[0]?.id ??
            '';
          // @ai-end

          // Remove any existing entry for this reciter (one card per reciter).
          // An upload's card stays: it is another recitation.
          const withoutDupe = state.recentTracks.filter(
            t => t.isUserUpload || t.reciter.id !== reciterId,
          );
          return {
            recentTracks: [
              {
                reciter: newReciter,
                surah: newSurah,
                rewayatId,
                progress,
                duration,
                timestamp: Date.now(),
              },
              ...withoutDupe,
            ].slice(0, 10),
            ...maps,
          };
        }),

      removeTrack: (index: number) =>
        set(state => {
          if (index < 0 || index >= state.recentTracks.length) return state;
          const updated = [...state.recentTracks];
          const [removed] = updated.splice(index, 1);
          // The card of the track in the player: that track's next report
          // would make it again.
          const playingKey = reportingTrackKey();
          if (
            playingKey &&
            !removed.isUserUpload &&
            `${removed.reciter?.id}:${removed.surah?.id}` === playingKey
          ) {
            return {recentTracks: updated, dismissedKey: playingKey};
          }
          return {recentTracks: updated};
        }),

      clearRecentTracks: () =>
        set({
          recentTracks: [],
          progressMap: {},
          durationMap: {},
          // The track in the player would otherwise make its card again.
          dismissedKey: reportingTrackKey(),
        }),

      reset: () => {
        set({
          recentTracks: [],
          progressMap: {},
          durationMap: {},
          dismissedKey: undefined,
        });
      },
    }),
    {
      name: 'player-recently-played-storage',
      storage: persistStorage(), // @ai
      partialize: state =>
        ({
          recentTracks: state.recentTracks,
          dismissedKey: state.dismissedKey,
        }) as unknown as RecentlyPlayedState,
    },
  ),
);
