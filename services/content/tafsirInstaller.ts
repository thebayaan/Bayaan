import {AVAILABLE_TAFASEER} from '@/data/availableTafaseer';
import {tafseerDbService} from '@/services/tafseer/TafseerDbService';
import {useTafseerStore} from '@/store/tafseerStore';
import type {ContentInstaller, ContentMeta} from '@/types/content';
import {idFromKey} from './contentKeys';
import {resolveEditionMeta} from './editionMeta';
import {parseTafsirSnapshot} from './tafsirSnapshot';

type TafsirDb = Pick<
  typeof tafseerDbService,
  'saveTafseer' | 'deleteTafseer' | 'getDownloadedTafaseer'
>;

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
      const id = idFromKey(key);
      // Parse before touching SQLite so a parser failure leaves the old rows alone.
      const verses = parseTafsirSnapshot(envelope.snapshot);
      const existing = (await db.getDownloadedTafaseer()).find(
        item => item.identifier === id,
      );
      const {name, englishName, language, direction} = resolveEditionMeta(
        meta,
        [existing, bundledEdition(id)],
        `Tafsir ${id}`,
      );
      // saveTafseer replaces the rows inside one SQLite transaction.
      await db.saveTafseer(id, name, englishName, language, direction, verses);
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
      await db.deleteTafseer(idFromKey(key));
      await store.getState().loadDownloadedMeta();
    },
    async onWithdrawn(key) {
      const id = idFromKey(key);
      const state = store.getState();
      // Idempotent: once the selection has moved off this id, nothing is left to do.
      if (state.selectedTafseerId !== id) return;
      const remaining = (await db.getDownloadedTafaseer()).filter(
        item => item.identifier !== id,
      );
      state.setSelectedTafseerId(remaining[0]?.identifier ?? null);
    },
    fallbackName(key) {
      return bundledEdition(idFromKey(key))?.englishName;
    },
  };
}
