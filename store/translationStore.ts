import {create} from 'zustand';
import type {DownloadedTranslationMeta} from '@/types/translation';
import {getForkTranslationProvider} from '@/services/translation/TranslationApiService';
import {translationDbService} from '@/services/translation/TranslationDbService';
import {
  getOfferedContent,
  installContent,
  isEngineManagingTranslations,
  removeContent,
} from '@/services/content/contentSync';
import {keyFor} from '@/services/content/contentKeys';
import {registerRemoteTranslationName} from '@/utils/translationLookup';
import {
  offeredFromManifest,
  offeredFromProvider,
  type OfferedEdition,
} from './translationPicker';

interface TranslationStoreState {
  // Metadata for downloaded translations (synced from SQLite)
  downloadedMeta: DownloadedTranslationMeta[];
  // Editions to offer; null until a catalog is known
  offeredTranslations: OfferedEdition[] | null;
  // Download state
  downloadingId: string | null;
  downloadProgress: number;

  // Actions
  downloadTranslation: (editionId: string) => Promise<void>;
  deleteTranslation: (editionId: string) => Promise<void>;
  loadDownloadedMeta: () => Promise<void>;
  loadOfferedTranslations: () => Promise<void>;
}

// The catalog: the cached manifest when the engine installs translations, a
// fork provider's list when one is set (RFC-009), otherwise none.
async function fetchOffered(): Promise<OfferedEdition[] | null> {
  if (isEngineManagingTranslations()) {
    const entries = await getOfferedContent('translation');
    return entries ? offeredFromManifest(entries) : null;
  }
  const provider = getForkTranslationProvider();
  if (provider) {
    return offeredFromProvider(await provider.fetchAvailableEditions());
  }
  return null;
}

// The reader labels verses with getTranslationName, so every edition the
// store learns of is named there; these two are the only registrations.
async function readDownloadedMeta(): Promise<DownloadedTranslationMeta[]> {
  const meta = await translationDbService.getDownloadedTranslations();
  for (const item of meta) {
    registerRemoteTranslationName(item.identifier, item.englishName);
  }
  return meta;
}

function registerOfferedNames(
  offered: OfferedEdition[] | null,
): OfferedEdition[] | null {
  for (const edition of offered ?? []) {
    registerRemoteTranslationName(edition.id, edition.name);
  }
  return offered;
}

export const useTranslationStore = create<TranslationStoreState>()(
  (set, get) => ({
    downloadedMeta: [],
    offeredTranslations: null,
    downloadingId: null,
    downloadProgress: 0,

    downloadTranslation: async (editionId: string) => {
      const {downloadingId} = get();
      if (downloadingId) return; // Already downloading

      set({downloadingId: editionId, downloadProgress: 0});

      try {
        const provider = getForkTranslationProvider();
        if (isEngineManagingTranslations()) {
          // The installer saves the rows and reloads the metadata.
          await installContent(keyFor('translation', editionId));
        } else if (provider) {
          const {edition, verses} = await provider.fetchFullTranslation(
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
        } else {
          throw new Error('translations_unavailable');
        }

        // Refresh downloaded metadata
        const meta = await readDownloadedMeta();
        set({downloadedMeta: meta, downloadingId: null, downloadProgress: 0});
      } catch (error) {
        console.warn('[TranslationStore] Download failed:', editionId, error);
        set({downloadingId: null, downloadProgress: 0});
        throw error;
      }
    },

    deleteTranslation: async (editionId: string) => {
      try {
        if (isEngineManagingTranslations()) {
          // Records user_removed so the engine never reinstalls it.
          await removeContent(keyFor('translation', editionId));
        } else {
          await translationDbService.deleteTranslation(editionId);
        }
        set({downloadedMeta: await readDownloadedMeta()});
      } catch (error) {
        console.warn('[TranslationStore] Delete failed:', editionId, error);
      }
    },

    loadDownloadedMeta: async () => {
      try {
        set({downloadedMeta: await readDownloadedMeta()});
      } catch (error) {
        console.warn(
          '[TranslationStore] Failed to load downloaded meta:',
          error,
        );
      }
    },

    loadOfferedTranslations: async () => {
      try {
        set({offeredTranslations: registerOfferedNames(await fetchOffered())});
      } catch (error) {
        console.warn(
          '[TranslationStore] Failed to load offered translations:',
          error,
        );
      }
    },
  }),
);
