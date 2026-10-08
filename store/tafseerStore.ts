import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {DownloadedTafseerMeta, TafseerEdition} from '@/types/tafseer';
import {tafseerApiService} from '@/services/tafseer/TafseerApiService';
import {tafseerDbService} from '@/services/tafseer/TafseerDbService';
import {AVAILABLE_TAFASEER} from '@/data/availableTafaseer';
import {
  getOfferedTafsirIds,
  installContent,
  isEngineManagingTafsir,
  removeContent,
} from '@/services/content/contentSync';
import {setInstallActivityListener} from '@/services/content/installActivity';

const TAFSIR_KEY_PREFIX = 'qf:tafsirs:';
// The id of an engine install the user did not start, while it runs.
let engineDownloadingId: string | null = null;

// Catalog editions the user can still download: not installed, and offered by
// the last known manifest (every edition when no manifest is known).
export function browsableTafaseer(
  catalog: readonly TafseerEdition[],
  installedIds: ReadonlySet<string>,
  offeredIds: ReadonlySet<string> | null,
): TafseerEdition[] {
  return catalog.filter(
    edition =>
      !installedIds.has(edition.identifier) &&
      (offeredIds === null || offeredIds.has(edition.identifier)),
  );
}

interface TafseerStoreState {
  // Metadata for downloaded tafaseer (synced from SQLite)
  downloadedMeta: DownloadedTafseerMeta[];
  // Active tafseer selection
  selectedTafseerId: string | null;
  // Download state
  downloadingId: string | null;
  downloadProgress: number;
  // Ids the cached content manifest offers; null shows the full catalog
  offeredTafsirIds: ReadonlySet<string> | null;

  // Actions
  downloadTafseer: (editionId: string) => Promise<void>;
  deleteTafseer: (editionId: string) => Promise<void>;
  loadDownloadedMeta: () => Promise<void>;
  loadOfferedTafsirs: () => Promise<void>;
  setSelectedTafseerId: (id: string | null) => void;
}

export const useTafseerStore = create<TafseerStoreState>()(
  persist(
    (set, get) => ({
      downloadedMeta: [],
      selectedTafseerId: '169',
      downloadingId: null,
      downloadProgress: 0,
      offeredTafsirIds: null,

      downloadTafseer: async (editionId: string) => {
        const {downloadingId} = get();
        // A request for the tafsir the engine is already installing joins it:
        // installContent waits in the queue and skips the duplicate download.
        const joining =
          downloadingId === editionId && engineDownloadingId === editionId;
        if (downloadingId && !joining) return; // Already downloading

        if (!joining) set({downloadingId: editionId, downloadProgress: 0});

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

          // Auto-select when the selection is empty or points at nothing installed
          const {selectedTafseerId} = get();
          if (
            !selectedTafseerId ||
            !meta.some(item => item.identifier === selectedTafseerId)
          ) {
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

      loadOfferedTafsirs: async () => {
        try {
          set({offeredTafsirIds: await getOfferedTafsirIds()});
        } catch (error) {
          console.warn(
            '[TafseerStore] Failed to load offered tafaseer:',
            error,
          );
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

// Engine installs the user did not start (the first-launch Ibn Kathir) show as
// downloading. No byte progress is available, so progress stays 0 (indeterminate).
setInstallActivityListener((key, phase) => {
  if (!key.startsWith(TAFSIR_KEY_PREFIX)) return;
  const id = key.slice(TAFSIR_KEY_PREFIX.length);
  const {downloadingId} = useTafseerStore.getState();
  if (phase === 'started') {
    // A user download already owns the indicator; leave it alone.
    if (downloadingId !== null) return;
    engineDownloadingId = id;
    useTafseerStore.setState({downloadingId: id, downloadProgress: 0});
    return;
  }
  if (engineDownloadingId !== id) return;
  engineDownloadingId = null;
  if (downloadingId === id) {
    useTafseerStore.setState({downloadingId: null, downloadProgress: 0});
  }
});
