import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import {storage} from '@/utils/storage';

type BrowseViewMode = 'card' | 'list';
type BrowseSortOption = 'asc' | 'desc' | 'revelation';

type ReciterProfileViewMode = 'card' | 'list';
type ReciterProfileSortOption = 'asc' | 'desc' | 'revelation'; // Add revelation option

interface SettingsState {
  askEveryTime: boolean;
  setAskEveryTime: (value: boolean) => void;
  defaultReciterSelection: string | null;
  setDefaultReciterSelection: (value: string | null) => void;
  reciterPreferences: Record<string, string>; // reciterId -> rewayatId
  setReciterPreference: (reciterId: string, rewayatId: string) => void;
  getReciterPreference: (reciterId: string) => string | undefined;
  // Browse All Surahs settings
  browseViewMode: BrowseViewMode;
  setBrowseViewMode: (mode: BrowseViewMode) => void;
  browseSortOption: BrowseSortOption;
  setBrowseSortOption: (option: BrowseSortOption) => void;
  // Reciter Profile settings
  reciterProfileViewMode: ReciterProfileViewMode;
  setReciterProfileViewMode: (mode: ReciterProfileViewMode) => void;
  reciterProfileSortOption: ReciterProfileSortOption;
  setReciterProfileSortOption: (option: ReciterProfileSortOption) => void;
  // Onboarding tracking
  recitersViewOpenCount: number;
  incrementRecitersViewOpenCount: () => void;
  shouldShowNewToQuran: () => boolean;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
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
      getReciterPreference: (reciterId: string): string | undefined =>
        get().reciterPreferences[reciterId],
      browseViewMode: 'card' as BrowseViewMode, // Default to card view
      setBrowseViewMode: (mode: BrowseViewMode) => set({browseViewMode: mode}),
      browseSortOption: 'asc' as BrowseSortOption, // Default to ascending sort
      setBrowseSortOption: (option: BrowseSortOption) =>
        set({browseSortOption: option}),
      reciterProfileViewMode: 'card' as ReciterProfileViewMode, // Default to card view
      setReciterProfileViewMode: (mode: ReciterProfileViewMode) =>
        set({reciterProfileViewMode: mode}),
      reciterProfileSortOption: 'asc' as ReciterProfileSortOption, // Default to ascending sort
      setReciterProfileSortOption: (option: ReciterProfileSortOption) =>
        set({reciterProfileSortOption: option}),
      recitersViewOpenCount: 0,
      incrementRecitersViewOpenCount: () =>
        set(state => ({
          recitersViewOpenCount: state.recitersViewOpenCount + 1,
        })),
      shouldShowNewToQuran: () => get().recitersViewOpenCount < 5,
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => storage),
    },
  ),
);
