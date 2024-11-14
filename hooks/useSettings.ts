import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import {storage} from '@/utils/storage';

interface SettingsState {
  askEveryTime: boolean;
  setAskEveryTime: (value: boolean) => void;
  defaultReciterSelection: string | null;
  setDefaultReciterSelection: (value: string | null) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    set => ({
      askEveryTime: true,
      setAskEveryTime: value => set({askEveryTime: value}),
      defaultReciterSelection: null,
      setDefaultReciterSelection: value =>
        set({defaultReciterSelection: value}),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => storage),
    },
  ),
);
