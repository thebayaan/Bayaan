import {create} from 'zustand';
import type {DownloadedTranslationMeta} from '@/types/translation';
import {translationApiService} from '@/services/translation/TranslationApiService';
import {translationDbService} from '@/services/translation/TranslationDbService';
import {registerRemoteTranslationName} from '@/utils/translationLookup'; // @ai

// @ai-start
/**
 * Makes the names of the downloaded translations known to
 * getTranslationName, which every caption reads. Done wherever the list is
 * loaded, so it no longer depends on the Translations screen having been
 * opened in this session.
 */
function registerNames(meta: DownloadedTranslationMeta[]): void {
  for (const translation of meta) {
    registerRemoteTranslationName(
      translation.identifier,
      translation.englishName,
    );
  }
}
// @ai-end

interface TranslationStoreState {
  // Metadata for downloaded translations (synced from SQLite)
  downloadedMeta: DownloadedTranslationMeta[];
  // Download state
  downloadingId: string | null;
  downloadProgress: number;

  // Actions
  downloadTranslation: (editionId: string) => Promise<void>;
  deleteTranslation: (editionId: string) => Promise<void>;
  loadDownloadedMeta: () => Promise<void>;
}

export const useTranslationStore = create<TranslationStoreState>()(
  (set, get) => ({
    downloadedMeta: [],
    downloadingId: null,
    downloadProgress: 0,

    downloadTranslation: async (editionId: string) => {
      const {downloadingId} = get();
      if (downloadingId) return; // Already downloading

      set({downloadingId: editionId, downloadProgress: 0});

      try {
        const {edition, verses} =
          await translationApiService.fetchFullTranslation(
            editionId,
            progress => set({downloadProgress: progress}),
          );

        await translationDbService.saveTranslation(
          edition.identifier,
          edition.name,
          edition.englishName,
          edition.language,
          edition.direction,
          verses,
        );

        // Refresh downloaded metadata
        const meta = await translationDbService.getDownloadedTranslations();
        registerNames(meta); // @ai
        set({downloadedMeta: meta, downloadingId: null, downloadProgress: 0});
      } catch (error) {
        console.warn('[TranslationStore] Download failed:', editionId, error);
        set({downloadingId: null, downloadProgress: 0});
        throw error;
      }
    },

    deleteTranslation: async (editionId: string) => {
      try {
        await translationDbService.deleteTranslation(editionId);
        const meta = await translationDbService.getDownloadedTranslations();
        set({downloadedMeta: meta});
      } catch (error) {
        console.warn('[TranslationStore] Delete failed:', editionId, error);
      }
    },

    loadDownloadedMeta: async () => {
      try {
        const meta = await translationDbService.getDownloadedTranslations();
        registerNames(meta); // @ai
        set({downloadedMeta: meta});
      } catch (error) {
        console.warn(
          '[TranslationStore] Failed to load downloaded meta:',
          error,
        );
      }
    },
  }),
);
