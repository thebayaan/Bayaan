import {tafseerDbService} from '@/services/tafseer/TafseerDbService';
import {useTafseerStore} from '@/store/tafseerStore';
import type {ContentInstaller} from '@/types/content';
import {parseTafsirSnapshot} from './tafsirSnapshot';

type TafsirDb = Pick<
  typeof tafseerDbService,
  'saveTafseer' | 'deleteTafseer' | 'getDownloadedTafaseer'
>;

export function tafsirIdFromKey(key: string): string {
  return key.slice(key.lastIndexOf(':') + 1);
}

export function createTafsirInstaller(
  deps: {db?: TafsirDb; store?: typeof useTafseerStore} = {},
): ContentInstaller {
  const db = deps.db ?? tafseerDbService;
  const store = deps.store ?? useTafseerStore;
  return {
    kind: 'tafsir',
    supportsSchemaVersion: version => version === 1,
    async install(key, envelope, meta) {
      const id = tafsirIdFromKey(key);
      // Parse before touching SQLite so a parser failure leaves the old rows alone.
      const verses = parseTafsirSnapshot(envelope.snapshot);
      const existing = (await db.getDownloadedTafaseer()).find(
        item => item.identifier === id,
      );
      const name = meta?.name ?? existing?.name ?? `Tafsir ${id}`;
      // saveTafseer replaces the rows inside one SQLite transaction.
      await db.saveTafseer(
        id,
        name,
        name,
        // Updates arrive without meta; keep an installed tafsir's language and direction.
        meta?.language ?? existing?.language ?? 'English',
        meta?.direction ?? existing?.direction ?? 'ltr',
        verses,
      );
      await store.getState().loadDownloadedMeta();
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
  };
}
