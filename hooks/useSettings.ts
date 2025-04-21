import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import {storage} from '@/utils/storage';

interface SettingsState {
  askEveryTime: boolean;
  setAskEveryTime: (value: boolean) => void;
  defaultReciterSelection: string | null;
  setDefaultReciterSelection: (value: string | null) => void;
  reciterPreferences: Record<string, string>; // reciterId -> rewayatId
  setReciterPreference: (reciterId: string, rewayatId: string) => void;
  getReciterPreference: (reciterId: string) => string | undefined;
}

export const useSettings = create<SettingsState>()(
  persist(
    set => ({
      askEveryTime: true,
      setAskEveryTime: value => set({askEveryTime: value}),
      defaultReciterSelection: null,
      setDefaultReciterSelection: value =>
        set({defaultReciterSelection: value}),
      reciterPreferences: {},
      setReciterPreference: (reciterId, rewayatId) =>
        set(state => ({
          reciterPreferences: {
            ...state.reciterPreferences,
            [reciterId]: rewayatId,
          },
        })),
      getReciterPreference: reciterId =>
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        useSettings.getState().reciterPreferences[reciterId],
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => storage),
    },
  ),
);
