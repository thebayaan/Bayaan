// @ai-start
import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Counts = Record<string, number>;

interface MomentsState {
  /** Reciter id to how many of their moments were played. */
  plays: Counts;
  /** Reciter id to how many of their moments were swiped away quickly. */
  skips: Counts;
  /** Reciter id to how many of their moments were heard to the end. */
  completes: Counts;
  recordPlay: (reciterId: string) => void;
  recordSkip: (reciterId: string) => void;
  recordComplete: (reciterId: string) => void;
}

function increment(counts: Counts, reciterId: string): Counts {
  return {...counts, [reciterId]: (counts[reciterId] ?? 0) + 1};
}

export const useMomentsStore = create<MomentsState>()(
  persist(
    set => ({
      plays: {},
      skips: {},
      completes: {},
      recordPlay: (reciterId: string) =>
        set(state => ({plays: increment(state.plays, reciterId)})),
      recordSkip: (reciterId: string) =>
        set(state => ({skips: increment(state.skips, reciterId)})),
      recordComplete: (reciterId: string) =>
        set(state => ({completes: increment(state.completes, reciterId)})),
    }),
    {
      name: 'moments-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
// @ai-end
