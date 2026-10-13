import {create} from 'zustand';
import type {
  DownloadedTranslationMeta,
  RemoteTranslationEdition,
} from '@/types/translation';
import {BUNDLED_TRANSLATIONS} from '@/types/translation';
import {getForkTranslationProvider} from '@/services/translation/TranslationApiService';
import {translationDbService} from '@/services/translation/TranslationDbService';
import {
  getOfferedTranslations,
  installContent,
  isEngineInstallingTranslations,
  removeContent,
  type OfferedTranslation,
} from '@/services/content/contentSync';
import {translationLanguageName} from '@/services/content/translationInstaller';
import {registerRemoteTranslationName} from '@/utils/translationLookup';

const TRANSLATION_KEY_PREFIX = 'qf:translations:';
const UNKNOWN_LANGUAGE = 'Other';

// One edition the picker can download, from the manifest or a fork provider.
export interface OfferedEdition {
  id: string;
  name: string;
  author: string | null;
  language: string;
  bytes: number | null;
}

// One picker row.
export interface PickerTranslation {
  id: string;
  name: string;
  author: string | null;
  language: string;
  bytes: number | null;
  isBundled: boolean;
  isDownloaded: boolean;
}

export interface TranslationPicker {
  // Bundled and downloaded editions, the active one excluded, by name.
  installed: PickerTranslation[];
  // Editions to download, grouped by language (English first).
  groups: {language: string; rows: PickerTranslation[]}[];
  // No catalog is known yet (first launch offline): say how to get one.
  needsCatalog: boolean;
}

function languageOf(language: string | undefined): string {
  return translationLanguageName(language) ?? UNKNOWN_LANGUAGE;
}

// The cached manifest's active translations as picker editions.
export function offeredFromManifest(
  entries: readonly OfferedTranslation[],
): OfferedEdition[] {
  return entries.map(entry => ({
    id: entry.id,
    name: entry.meta?.name ?? `Translation ${entry.id}`,
    author: entry.meta?.author ?? null,
    language: languageOf(entry.meta?.language),
    bytes: entry.bytes ?? null,
  }));
}

// A fork provider's editions (RFC-009) as picker editions.
export function offeredFromProvider(
  editions: readonly RemoteTranslationEdition[],
): OfferedEdition[] {
  return editions.map(edition => ({
    id: edition.identifier,
    name: edition.englishName,
    author: edition.name !== edition.englishName ? edition.name : null,
    language: languageOf(edition.language),
    bytes: null,
  }));
}

// Search over name, author and language; an empty query matches everything.
export function matchesTranslationQuery(
  row: Pick<PickerTranslation, 'name' | 'author' | 'language'>,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [row.name, row.author ?? '', row.language].some(field =>
    field.toLowerCase().includes(needle),
  );
}

function byName(a: PickerTranslation, b: PickerTranslation): number {
  return a.name.localeCompare(b.name);
}

export function buildTranslationPicker(input: {
  downloaded: readonly DownloadedTranslationMeta[];
  offered: readonly OfferedEdition[] | null;
  selectedId: string;
  query: string;
}): TranslationPicker {
  const {downloaded, offered, selectedId, query} = input;
  const offeredById = new Map((offered ?? []).map(item => [item.id, item]));
  const rows: PickerTranslation[] = [];
  for (const info of Object.values(BUNDLED_TRANSLATIONS)) {
    rows.push({
      id: info.id,
      name: info.name,
      author: info.author,
      language: info.language,
      bytes: null,
      isBundled: true,
      isDownloaded: true,
    });
  }
  const downloadedIds = new Set<string>();
  for (const meta of downloaded) {
    if (Object.hasOwn(BUNDLED_TRANSLATIONS, meta.identifier)) continue;
    downloadedIds.add(meta.identifier);
    const listed = offeredById.get(meta.identifier);
    rows.push({
      id: meta.identifier,
      name: listed?.name ?? meta.englishName,
      author: listed?.author ?? null,
      language: listed?.language ?? languageOf(meta.language),
      bytes: listed?.bytes ?? null,
      isBundled: false,
      isDownloaded: true,
    });
  }
  for (const item of offered ?? []) {
    if (downloadedIds.has(item.id)) continue;
    if (Object.hasOwn(BUNDLED_TRANSLATIONS, item.id)) continue;
    rows.push({...item, isBundled: false, isDownloaded: false});
  }

  const visible = rows.filter(row => matchesTranslationQuery(row, query));
  const installed = visible
    .filter(row => row.isDownloaded && row.id !== selectedId)
    .sort(byName);
  const byLanguage = new Map<string, PickerTranslation[]>();
  for (const row of visible) {
    if (row.isDownloaded) continue;
    const group = byLanguage.get(row.language) ?? [];
    group.push(row);
    byLanguage.set(row.language, group);
  }
  const groups = [...byLanguage.entries()]
    .sort(([a], [b]) => {
      if (a === 'English') return -1;
      if (b === 'English') return 1;
      return a.localeCompare(b);
    })
    .map(([language, group]) => ({language, rows: group.sort(byName)}));
  return {installed, groups, needsCatalog: offered === null};
}

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
  if (isEngineInstallingTranslations()) {
    const entries = await getOfferedTranslations();
    return entries ? offeredFromManifest(entries) : null;
  }
  const provider = getForkTranslationProvider();
  if (provider) {
    return offeredFromProvider(await provider.fetchAvailableEditions());
  }
  return null;
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
        if (isEngineInstallingTranslations()) {
          // The installer saves the rows and reloads the metadata.
          await installContent(`${TRANSLATION_KEY_PREFIX}${editionId}`);
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
        const meta = await translationDbService.getDownloadedTranslations();
        set({downloadedMeta: meta, downloadingId: null, downloadProgress: 0});
      } catch (error) {
        console.warn('[TranslationStore] Download failed:', editionId, error);
        set({downloadingId: null, downloadProgress: 0});
        throw error;
      }
    },

    deleteTranslation: async (editionId: string) => {
      try {
        if (isEngineInstallingTranslations()) {
          // Records user_removed so the engine never reinstalls it.
          await removeContent(`${TRANSLATION_KEY_PREFIX}${editionId}`);
        } else {
          await translationDbService.deleteTranslation(editionId);
        }
        const meta = await translationDbService.getDownloadedTranslations();
        set({downloadedMeta: meta});
      } catch (error) {
        console.warn('[TranslationStore] Delete failed:', editionId, error);
      }
    },

    loadDownloadedMeta: async () => {
      try {
        const meta = await translationDbService.getDownloadedTranslations();
        // The reader labels verses with getTranslationName.
        for (const item of meta) {
          registerRemoteTranslationName(item.identifier, item.englishName);
        }
        set({downloadedMeta: meta});
      } catch (error) {
        console.warn(
          '[TranslationStore] Failed to load downloaded meta:',
          error,
        );
      }
    },

    loadOfferedTranslations: async () => {
      try {
        set({offeredTranslations: await fetchOffered()});
      } catch (error) {
        console.warn(
          '[TranslationStore] Failed to load offered translations:',
          error,
        );
      }
    },
  }),
);
