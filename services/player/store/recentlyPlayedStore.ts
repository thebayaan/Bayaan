import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {Reciter, RECITERS} from '@/data/reciterData';
import {Surah, SURAHS} from '@/data/surahData';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {usePlayerStore} from '@/services/player/store/playerStore';

export interface RecentlyPlayedTrack {
  reciter: Reciter;
  surah: Surah;
  rewayatId: string;
  progress: number;
  duration: number;
  timestamp: number;
}

interface RecentlyPlayedState {
  recentTracks: RecentlyPlayedTrack[];
  progressMap: Record<string, number>;
  durationMap: Record<string, number>;

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
          };
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
          };

          if (state.recentTracks.length === 0) {
            return maps;
          }

          const head = state.recentTracks[0];

          // Same reciter — update [0] in place (handles surah auto-advance)
          if (head.reciter.id === reciterId) {
            const surah =
              head.surah.id === surahId
                ? head.surah
                : SURAHS.find(s => s.id === surahId) ?? head.surah;
            return {
              recentTracks: [
                {...head, surah, progress, duration},
                ...state.recentTracks.slice(1),
              ],
              ...maps,
            };
          }

          // Different reciter at [0].
          // Check if this reciterId already exists below [0] — if so, it's a
          // stale transition update (startNewChain already ran, old reciter was
          // pushed down). Just update that existing entry's progress quietly.
          const belowIndex = state.recentTracks.findIndex(
            (t, i) => i > 0 && t.reciter.id === reciterId,
          );
          if (belowIndex !== -1) {
            const updated = [...state.recentTracks];
            updated[belowIndex] = {
              ...updated[belowIndex],
              progress,
              duration,
            };
            return {recentTracks: updated, ...maps};
          }

          // Genuinely new reciter from queue auto-advance — create new entry
          const newReciter = RECITERS.find(r => r.id === reciterId);
          const newSurah = SURAHS.find(s => s.id === surahId);
          if (!newReciter || !newSurah) {
            return maps;
          }

          const playerState = usePlayerStore.getState();
          const currentTrack =
            playerState.queue.tracks[playerState.queue.currentIndex];
          const rewayatId =
            currentTrack?.rewayatId ?? newReciter.rewayat[0]?.id ?? '';

          // Remove any existing entry for this reciter (one card per reciter)
          const withoutDupe = state.recentTracks.filter(
            t => t.reciter.id !== reciterId,
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

      clearRecentTracks: () =>
        set({recentTracks: [], progressMap: {}, durationMap: {}}),

      reset: () => {
        set({
          recentTracks: [],
          progressMap: {},
          durationMap: {},
        });
      },
    }),
    {
      name: 'player-recently-played-storage',
      storage: {
        getItem: async name => {
          const value = await AsyncStorage.getItem(name);
          return value ? JSON.parse(value) : null;
        },
        setItem: async (name, value) => {
          await AsyncStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: async name => {
          await AsyncStorage.removeItem(name);
        },
      },
      partialize: state =>
        ({
          recentTracks: state.recentTracks,
        } as unknown as RecentlyPlayedState),
    },
  ),
);
