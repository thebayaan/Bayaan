import {AVAILABLE_TAFASEER} from '@/data/availableTafaseer';
import {tafseerDbService} from '@/services/tafseer/TafseerDbService';
import {useTafseerStore} from '@/store/tafseerStore';
import type {ContentInstaller, ContentMeta} from '@/types/content';
import {parseTafsirSnapshot} from './tafsirSnapshot';

type TafsirDb = Pick<
  typeof tafseerDbService,
  'saveTafseer' | 'deleteTafseer' | 'getDownloadedTafaseer'
>;

// Manifest meta carries ISO codes; tafaseer.db stores display names.
const LANGUAGE_NAMES: Record<string, string> = {
  ar: 'Arabic',
  bn: 'Bengali',
  en: 'English',
  fa: 'Persian',
  fr: 'French',
  id: 'Indonesian',
  ku: 'Kurdish',
  ru: 'Russian',
  tr: 'Turkish',
  ur: 'Urdu',
};

export function tafsirIdFromKey(key: string): string {
  return key.slice(key.lastIndexOf(':') + 1);
}

export function displayLanguage(code: string | undefined): string | undefined {
  if (!code) return undefined;
  const known = LANGUAGE_NAMES[code.toLowerCase()];
  if (known) return known;
  // Already a display name (for example "English"); an unknown code falls through.
  return Object.values(LANGUAGE_NAMES).includes(code) ? code : undefined;
}

function bundledEdition(id: string) {
  return AVAILABLE_TAFASEER.find(item => item.identifier === id);
}

export function createTafsirInstaller(
  deps: {db?: TafsirDb; store?: typeof useTafseerStore} = {},
): ContentInstaller {
  const db = deps.db ?? tafseerDbService;
  const store = deps.store ?? useTafseerStore;
  return {
    kind: 'tafsir',
    supportsSchemaVersion: version => version === 1,
    async install(key, envelope, meta: ContentMeta | undefined) {
      const id = tafsirIdFromKey(key);
      // Parse before touching SQLite so a parser failure leaves the old rows alone.
      const verses = parseTafsirSnapshot(envelope.snapshot);
      const existing = (await db.getDownloadedTafaseer()).find(
        item => item.identifier === id,
      );
      const bundled = bundledEdition(id);
      // Fallback order: manifest meta, the installed row, the bundled list, defaults.
      const name =
        meta?.name ?? existing?.name ?? bundled?.name ?? `Tafsir ${id}`;
      const englishName =
        meta?.name ?? existing?.englishName ?? bundled?.englishName ?? name;
      // saveTafseer replaces the rows inside one SQLite transaction.
      await db.saveTafseer(
        id,
        name,
        englishName,
        displayLanguage(meta?.language) ??
          existing?.language ??
          bundled?.language ??
          'English',
        meta?.direction ?? existing?.direction ?? bundled?.direction ?? 'ltr',
        verses,
      );
      await store.getState().loadDownloadedMeta();
      const state = store.getState();
      // A selection pointing at nothing installed moves to this tafsir.
      if (
        !state.downloadedMeta.some(
          item => item.identifier === state.selectedTafseerId,
        )
      ) {
        state.setSelectedTafseerId(id);
      }
      return {name};
    },
    async remove(key) {
      await db.deleteTafseer(tafsirIdFromKey(key));
      await store.getState().loadDownloadedMeta();
    },
    async onWithdrawn(key) {
      const id = tafsirIdFromKey(key);
      const state = store.getState();
      // Idempotent: once the selection has moved off this id, nothing is left to do.
      if (state.selectedTafseerId !== id) return;
      const remaining = (await db.getDownloadedTafaseer()).filter(
        item => item.identifier !== id,
      );
      state.setSelectedTafseerId(remaining[0]?.identifier ?? null);
    },
    fallbackName(key) {
      return bundledEdition(tafsirIdFromKey(key))?.englishName;
    },
  };
}
