import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {DownloadedTafseerMeta} from '@/types/tafseer';
import {tafseerApiService} from '@/services/tafseer/TafseerApiService';
import {tafseerDbService} from '@/services/tafseer/TafseerDbService';

interface TafseerStoreState {
  // Metadata for downloaded tafaseer (synced from SQLite)
  downloadedMeta: DownloadedTafseerMeta[];
  // Active tafseer selection
  selectedTafseerId: string | null;
  // Download state
  downloadingId: string | null;
  downloadProgress: number;

  // Actions
  downloadTafseer: (editionId: string) => Promise<void>;
  deleteTafseer: (editionId: string) => Promise<void>;
  loadDownloadedMeta: () => Promise<void>;
  setSelectedTafseerId: (id: string | null) => void;
}

export const useTafseerStore = create<TafseerStoreState>()(
  persist(
    (set, get) => ({
      downloadedMeta: [],
      selectedTafseerId: '169',
      downloadingId: null,
      downloadProgress: 0,

      downloadTafseer: async (editionId: string) => {
        const {downloadingId} = get();
        if (downloadingId) return; // Already downloading

        set({downloadingId: editionId, downloadProgress: 0});

        try {
          const {edition, verses} = await tafseerApiService.fetchFullTafseer(
            editionId,
            progress => set({downloadProgress: progress}),
          );

          await tafseerDbService.saveTafseer(
            edition.identifier,
            edition.name,
            edition.englishName,
            edition.language,
            edition.direction,
            verses,
          );

          // Refresh downloaded metadata
          const meta = await tafseerDbService.getDownloadedTafaseer();
          set({downloadedMeta: meta, downloadingId: null, downloadProgress: 0});

          // Auto-select if no tafseer is currently selected
          const {selectedTafseerId} = get();
          if (!selectedTafseerId) {
            set({selectedTafseerId: edition.identifier});
          }
        } catch (error) {
          console.warn('[TafseerStore] Download failed:', editionId, error);
          set({downloadingId: null, downloadProgress: 0});
          throw error;
        }
      },

      deleteTafseer: async (editionId: string) => {
        try {
          await tafseerDbService.deleteTafseer(editionId);
          const meta = await tafseerDbService.getDownloadedTafaseer();
          set({downloadedMeta: meta});

          // If we deleted the selected tafseer, switch to the first available or null
          const {selectedTafseerId} = get();
          if (selectedTafseerId === editionId) {
            set({
              selectedTafseerId: meta.length > 0 ? meta[0].identifier : null,
            });
          }
        } catch (error) {
          console.warn('[TafseerStore] Delete failed:', editionId, error);
        }
      },

      loadDownloadedMeta: async () => {
        try {
          const meta = await tafseerDbService.getDownloadedTafaseer();
          set({downloadedMeta: meta});
        } catch (error) {
          console.warn('[TafseerStore] Failed to load downloaded meta:', error);
        }
      },

      setSelectedTafseerId: (id: string | null) => {
        set({selectedTafseerId: id});
      },
    }),
    {
      name: 'tafseer-store',
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      // Only persist selected tafseer
      partialize: state => ({
        selectedTafseerId: state.selectedTafseerId,
      }),
    },
  ),
);
