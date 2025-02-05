import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer from 'react-native-track-player';
import {Track, ensureTrackFields} from '@/types/audio';
import {Reciter} from '@/data/reciterData';
import {Surah} from '@/data/surahData';

interface QueueState {
  queue: Track[];
  nextLoadIndex: number;
  allSurahs: Surah[];
  currentReciter: Reciter | null;
  addToQueue: (track: Track) => Promise<void>;
  removeFromQueue: (index: number) => Promise<void>;
  clearQueue: () => Promise<void>;
  getQueue: () => Promise<Track[]>;
  setQueueContext: (context: {
    nextLoadIndex: number;
    allSurahs: Surah[];
    currentReciter: Reciter;
  }) => void;
}

export const useQueueStore = create<QueueState>()(
  persist(
    (set, get) => ({
      queue: [],
      nextLoadIndex: 0,
      allSurahs: [],
      currentReciter: null,

      addToQueue: async (track: Track) => {
        const {queue} = get();
        const newQueue = [...queue, track];
        await TrackPlayer.add(track);
        set({queue: newQueue});
      },

      removeFromQueue: async (index: number) => {
        const {queue} = get();
        const newQueue = queue.filter((_, i) => i !== index);
        await TrackPlayer.remove(index);
        set({queue: newQueue});
      },

      clearQueue: async () => {
        await TrackPlayer.reset();
        set({
          queue: [],
          nextLoadIndex: 0,
          allSurahs: [],
          currentReciter: null,
        });
      },

      getQueue: async () => {
        const currentQueue = await TrackPlayer.getQueue();
        return currentQueue.map(queueTrack => ensureTrackFields(queueTrack));
      },

      setQueueContext: context => {
        set({
          nextLoadIndex: context.nextLoadIndex,
          allSurahs: context.allSurahs,
          currentReciter: context.currentReciter,
        });
      },
    }),
    {
      name: 'queue-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        queue: state.queue,
        // We don't persist these as they should be reset on app restart
        nextLoadIndex: 0,
        allSurahs: [],
        currentReciter: null,
      }),
    },
  ),
);
