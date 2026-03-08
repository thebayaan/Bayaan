/**
 * Mushaf Player Store
 *
 * Zustand store for mushaf ayah-by-ayah audio player state.
 * Persists reciter preference, playback rate, and repeat counts across sessions.
 */

import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {AyahTimestamp} from '@/types/timestamps';
import {RECITERS} from '@/data/reciterData';
import {timestampService} from '@/services/timestamps/TimestampService';
import {timestampFetchService} from '@/services/timestamps/TimestampFetchService';
import {mushafAudioService} from '@/services/audio/MushafAudioService';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
import {resolveMushafAudioUrl} from '@/utils/mushafAudioUtils';

const STORAGE_KEY = 'mushaf-player-store';

type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused';

export interface AvailableReciter {
  rewayatId: string;
  reciterName: string;
  imageUrl: string | null;
  style: string;
}

interface RangeEndpoint {
  surah: number;
  ayah: number;
}

export interface MushafPlayerStoreState {
  // Runtime state (not persisted)
  playbackState: PlaybackState;
  currentSurah: number;
  currentAyah: number;
  currentVerseKey: string | null;
  currentPage: number | null;
  timestamps: AyahTimestamp[] | null;
  rangeStart: RangeEndpoint | null;
  rangeEnd: RangeEndpoint | null;
  availableReciters: AvailableReciter[];
  pendingStartVerseKey: string | null;
  timestampError: string | null;
  _versePlayCount: number;
  _rangePlayCount: number;

  // UI state (synced from MushafViewer, not persisted)
  isImmersive: boolean;
  isSearchMode: boolean;

  // Persisted preferences
  rewayatId: string | null;
  reciterName: string | null;
  rate: number;
  verseRepeatCount: number;
  rangeRepeatCount: number;

  // Actions
  setPlaybackState: (state: PlaybackState) => void;
  setCurrentAyah: (surah: number, ayah: number) => void;
  setReciter: (rewayatId: string, reciterName: string) => void;
  setRate: (rate: number) => void;
  setVerseRepeatCount: (count: number) => void;
  setRangeRepeatCount: (count: number) => void;
  setRange: (start: RangeEndpoint, end: RangeEndpoint) => void;
  clearRange: () => void;
  startPlayback: (page: number, startVerseKey?: string) => Promise<void>;
  stop: () => void;
  computeAvailableReciters: () => Promise<void>;
}

export const useMushafPlayerStore = create<MushafPlayerStoreState>()(
  persist(
    (set, get) => ({
      // Runtime state defaults
      playbackState: 'idle',
      currentSurah: 0,
      currentAyah: 0,
      currentVerseKey: null,
      currentPage: null,
      timestamps: null,
      rangeStart: null,
      rangeEnd: null,
      availableReciters: [],
      pendingStartVerseKey: null,
      timestampError: null,
      _versePlayCount: 1,
      _rangePlayCount: 1,
      isImmersive: false,
      isSearchMode: false,

      // Persisted preferences defaults
      rewayatId: null,
      reciterName: null,
      rate: 1.0,
      verseRepeatCount: 1,
      rangeRepeatCount: 1,

      setPlaybackState: (state: PlaybackState) => {
        set({playbackState: state});
      },

      setCurrentAyah: (surah: number, ayah: number) => {
        const verseKey = `${surah}:${ayah}`;
        set({
          currentSurah: surah,
          currentAyah: ayah,
          currentVerseKey: verseKey,
        });
      },

      setReciter: (rewayatId: string, reciterName: string) => {
        set({rewayatId, reciterName});
      },

      setRate: (rate: number) => {
        const clamped = Math.max(0.5, Math.min(2.0, rate));
        mushafAudioService.setRate(clamped);
        set({rate: clamped});
      },

      setVerseRepeatCount: (count: number) => {
        set({verseRepeatCount: count});
      },

      setRangeRepeatCount: (count: number) => {
        set({rangeRepeatCount: count});
      },

      setRange: (start: RangeEndpoint, end: RangeEndpoint) => {
        set({rangeStart: start, rangeEnd: end});
      },

      clearRange: () => {
        set({rangeStart: null, rangeEnd: null});
      },

      startPlayback: async (page: number, startVerseKey?: string) => {
        const {rewayatId, rate, rangeStart, pendingStartVerseKey} = get();
        if (!rewayatId) return;

        set({
          playbackState: 'loading',
          currentPage: page,
          pendingStartVerseKey: null,
          timestampError: null,
          _versePlayCount: 1,
          _rangePlayCount: 1,
        });

        try {
          let targetKey = startVerseKey || pendingStartVerseKey;
          if (!targetKey && rangeStart) {
            targetKey = `${rangeStart.surah}:${rangeStart.ayah}`;
          }
          if (!targetKey) {
            const orderedKeys =
              mushafVerseMapService.getOrderedVerseKeysForPage(page);
            if (orderedKeys.length === 0) {
              set({playbackState: 'idle'});
              return;
            }
            targetKey = orderedKeys[0];
          }

          const [surahStr, ayahStr] = targetKey.split(':');
          const surahNumber = parseInt(surahStr, 10);
          const ayahNumber = parseInt(ayahStr, 10);

          const timestamps = await timestampService.getTimestampsForSurah(
            rewayatId,
            surahNumber,
          );
          if (!timestamps) {
            console.warn(
              `[MushafPlayerStore] No timestamps for rewayat=${rewayatId} surah=${surahNumber}`,
            );
            set({
              playbackState: 'idle',
              timestampError:
                'Timestamps unavailable for this reciter on this surah. Try a different reciter.',
            });
            return;
          }

          const audioUrl = resolveMushafAudioUrl(rewayatId, surahNumber);

          // Set up the audio service callbacks
          mushafAudioService.setOnAyahChange((surah, ayah) => {
            const state = useMushafPlayerStore.getState();

            // Bail out if playback was stopped (stale callback)
            if (state.playbackState === 'idle') return;

            const prevSurah = state.currentSurah;
            const prevAyah = state.currentAyah;
            state.setCurrentAyah(surah, ayah);

            // Verse repeat logic
            if (state.verseRepeatCount !== 1 && prevAyah > 0) {
              const ayahActuallyChanged =
                surah !== prevSurah || ayah !== prevAyah;
              if (ayahActuallyChanged) {
                if (state.verseRepeatCount === 0) {
                  // Infinite loop — always seek back
                  mushafAudioService.seekToAyah(prevAyah);
                  // Restore previous ayah in state
                  set({
                    currentSurah: prevSurah,
                    currentAyah: prevAyah,
                    currentVerseKey: `${prevSurah}:${prevAyah}`,
                  });
                  return;
                }
                if (state._versePlayCount < state.verseRepeatCount) {
                  set({_versePlayCount: state._versePlayCount + 1});
                  mushafAudioService.seekToAyah(prevAyah);
                  set({
                    currentSurah: prevSurah,
                    currentAyah: prevAyah,
                    currentVerseKey: `${prevSurah}:${prevAyah}`,
                  });
                  return;
                }
                // Exhausted verse repeats — reset counter and let it advance
                set({_versePlayCount: 1});
              }
            }

            // Range boundary check
            if (state.rangeEnd) {
              const pastEnd =
                surah > state.rangeEnd.surah ||
                (surah === state.rangeEnd.surah && ayah > state.rangeEnd.ayah);
              if (pastEnd && state.rangeStart) {
                if (state.rangeRepeatCount === 0) {
                  // Infinite range loop
                  mushafAudioService.seekToAyah(state.rangeStart.ayah);
                  set({
                    currentSurah: state.rangeStart.surah,
                    currentAyah: state.rangeStart.ayah,
                    currentVerseKey: `${state.rangeStart.surah}:${state.rangeStart.ayah}`,
                    _versePlayCount: 1,
                  });
                  return;
                }
                if (state._rangePlayCount < state.rangeRepeatCount) {
                  set({
                    _rangePlayCount: state._rangePlayCount + 1,
                    _versePlayCount: 1,
                  });
                  mushafAudioService.seekToAyah(state.rangeStart.ayah);
                  set({
                    currentSurah: state.rangeStart.surah,
                    currentAyah: state.rangeStart.ayah,
                    currentVerseKey: `${state.rangeStart.surah}:${state.rangeStart.ayah}`,
                  });
                  return;
                }
                // Range exhausted — stop playback
                mushafAudioService.stop();
                set({
                  playbackState: 'idle',
                  currentVerseKey: null,
                  _versePlayCount: 1,
                  _rangePlayCount: 1,
                });
                return;
              }
            }
          });

          mushafAudioService.setOnSurahEnd(() => {
            const state = useMushafPlayerStore.getState();

            // Bail out if playback was stopped (stale callback)
            if (state.playbackState === 'idle') return;

            // Range boundary check at surah end
            if (state.rangeEnd && state.rangeStart) {
              if (state.rangeRepeatCount === 0) {
                mushafAudioService.seekToAyah(state.rangeStart.ayah);
                mushafAudioService.play();
                set({_versePlayCount: 1});
                return;
              }
              if (state._rangePlayCount < state.rangeRepeatCount) {
                set({
                  _rangePlayCount: state._rangePlayCount + 1,
                  _versePlayCount: 1,
                });
                mushafAudioService.seekToAyah(state.rangeStart.ayah);
                mushafAudioService.play();
                return;
              }
              // Range exhausted
              set({
                playbackState: 'idle',
                currentVerseKey: null,
                _versePlayCount: 1,
                _rangePlayCount: 1,
              });
              mushafAudioService.stop();
              return;
            }

            // Default: advance to next surah
            const nextSurah = state.currentSurah + 1;
            if (nextSurah > 114) {
              set({playbackState: 'idle', currentVerseKey: null});
              mushafAudioService.stop();
              return;
            }

            (async () => {
              try {
                const {rewayatId, rate: currentRate} = get();
                if (!rewayatId) return;

                set({playbackState: 'loading'});

                const nextTimestamps =
                  await timestampService.getTimestampsForSurah(
                    rewayatId,
                    nextSurah,
                  );
                if (!nextTimestamps) {
                  set({playbackState: 'idle', currentVerseKey: null});
                  mushafAudioService.stop();
                  return;
                }

                const nextUrl = resolveMushafAudioUrl(rewayatId, nextSurah);
                mushafAudioService.loadSurah(
                  nextSurah,
                  nextUrl,
                  nextTimestamps,
                );
                mushafAudioService.setRate(currentRate);
                mushafAudioService.seekToAyah(1);
                mushafAudioService.play();

                set({
                  playbackState: 'playing',
                  currentSurah: nextSurah,
                  currentAyah: 1,
                  currentVerseKey: `${nextSurah}:1`,
                  timestamps: nextTimestamps,
                  _versePlayCount: 1,
                });
              } catch (error) {
                console.error(
                  '[MushafPlayerStore] Failed to advance to next surah:',
                  error,
                );
                set({playbackState: 'idle', currentVerseKey: null});
                mushafAudioService.stop();
              }
            })();
          });

          // Load and play
          mushafAudioService.loadSurah(surahNumber, audioUrl, timestamps);
          mushafAudioService.setRate(rate);
          mushafAudioService.seekToAyah(ayahNumber);
          mushafAudioService.play();

          set({
            playbackState: 'playing',
            currentSurah: surahNumber,
            currentAyah: ayahNumber,
            currentVerseKey: targetKey,
            timestamps,
          });
        } catch (error) {
          console.error('[MushafPlayerStore] Failed to start playback:', error);
          set({playbackState: 'idle'});
        }
      },

      stop: () => {
        mushafAudioService.stop();
        set({
          playbackState: 'idle',
          currentSurah: 0,
          currentAyah: 0,
          currentVerseKey: null,
          currentPage: null,
          timestamps: null,
          rangeStart: null,
          rangeEnd: null,
          timestampError: null,
          _versePlayCount: 1,
          _rangePlayCount: 1,
        });
      },

      computeAvailableReciters: async () => {
        try {
          const available: AvailableReciter[] = [];
          for (const reciter of RECITERS) {
            for (const rewayat of reciter.rewayat) {
              if (
                timestampFetchService.getSourceForRewayat(rewayat.id) !== null
              ) {
                available.push({
                  rewayatId: rewayat.id,
                  reciterName: reciter.name,
                  imageUrl: reciter.image_url,
                  style: rewayat.style,
                });
              }
            }
          }

          set({availableReciters: available});
        } catch (error) {
          console.error(
            '[MushafPlayerStore] Failed to compute available reciters:',
            error,
          );
        }
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        rewayatId: state.rewayatId,
        reciterName: state.reciterName,
        rate: state.rate,
        verseRepeatCount: state.verseRepeatCount,
        rangeRepeatCount: state.rangeRepeatCount,
      }),
    },
  ),
);
