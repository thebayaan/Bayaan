// @ai-start
import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface MomentsState {
  /** Reciter id to how many of their moments were played. */
  plays: Record<string, number>;
  recordPlay: (reciterId: string) => void;
}

export const useMomentsStore = create<MomentsState>()(
  persist(
    set => ({
      plays: {},
      recordPlay: (reciterId: string) =>
        set(state => ({
          plays: {
            ...state.plays,
            [reciterId]: (state.plays[reciterId] ?? 0) + 1,
          },
        })),
    }),
    {
      name: 'moments-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
// @ai-end
