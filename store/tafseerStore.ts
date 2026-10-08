import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {DownloadedTafseerMeta} from '@/types/tafseer';
import {tafseerApiService} from '@/services/tafseer/TafseerApiService';
import {tafseerDbService} from '@/services/tafseer/TafseerDbService';
import {AVAILABLE_TAFASEER} from '@/data/availableTafaseer';
import {
  installContent,
  isEngineManagingTafsir,
  removeContent,
} from '@/services/content/contentSync';

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
          let installedId = editionId;
          if (isEngineManagingTafsir()) {
            await installContent(`qf:tafsirs:${editionId}`);
            set({downloadProgress: 1});
          } else {
            // Pass the static edition entry when available so the provider
            // can skip its internal editions-list lookup (RFC-009 v2 review).
            const staticEdition = AVAILABLE_TAFASEER.find(
              e => e.identifier === editionId,
            );
            const {edition, verses} = await tafseerApiService.fetchFullTafseer(
              editionId,
              progress => set({downloadProgress: progress}),
              staticEdition,
            );

            installedId = edition.identifier;
            await tafseerDbService.saveTafseer(
              edition.identifier,
              edition.name,
              edition.englishName,
              edition.language,
              edition.direction,
              verses,
            );
          }

          // Refresh downloaded metadata
          const meta = await tafseerDbService.getDownloadedTafaseer();
          set({downloadedMeta: meta, downloadingId: null, downloadProgress: 0});

          // Auto-select if no tafseer is currently selected
          const {selectedTafseerId} = get();
          if (!selectedTafseerId) {
            set({selectedTafseerId: installedId});
          }
        } catch (error) {
          console.warn('[TafseerStore] Download failed:', editionId, error);
          set({downloadingId: null, downloadProgress: 0});
          throw error;
        }
      },

      deleteTafseer: async (editionId: string) => {
        try {
          if (isEngineManagingTafsir()) {
            await removeContent(`qf:tafsirs:${editionId}`);
          } else {
            await tafseerDbService.deleteTafseer(editionId);
          }
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
      version: 3,
      // Only persist selected tafseer
      partialize: state => ({
        selectedTafseerId: state.selectedTafseerId,
      }),
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as {selectedTafseerId?: string | null};
        if (version < 3) {
          // Existing users had null. '169' arrives via Content Sync auto-install
          // when the engine manages tafsir; forks without a content API start with
          // no installed tafsir (empty state) until the user downloads one.
          return {
            ...state,
            selectedTafseerId: state.selectedTafseerId || '169',
          };
        }
        return state;
      },
    },
  ),
);
