import {translationDbService} from '@/services/translation/TranslationDbService';
import {DEFAULT_TRANSLATION_ID} from '@/services/translation/translationRemap';
import type {ContentInstaller, ContentMeta} from '@/types/content';
import {idFromKey} from './contentKeys';
import {resolveEditionMeta} from './editionMeta';
import {parseTranslationSnapshot} from './translationSnapshot';

type TranslationDb = Pick<
  typeof translationDbService,
  'saveTranslation' | 'deleteTranslation' | 'getDownloadedTranslations'
>;

// The app state a translation install touches, supplied by the caller so
// this module does not import the settings or translation stores.
export interface TranslationHost {
  // The reader's translation selection.
  selectedTranslationId: () => string;
  // Moves the reader's selection (a withdrawn edition falls back).
  setSelectedTranslationId: (id: string) => void;
  // Refreshes the downloaded translations list.
  reloadTranslations: () => Promise<void>;
}

export function createTranslationInstaller(deps: {
  host: TranslationHost;
  db?: TranslationDb;
}): ContentInstaller {
  const {host} = deps;
  const db = deps.db ?? translationDbService;
  return {
    kind: 'translation',
    supportsSchemaVersion: version => version === 1,
    async install(key, envelope, meta: ContentMeta | undefined) {
      const id = idFromKey(key);
      // Parse before touching SQLite so a parser failure leaves the old rows alone.
      const {verses, footnotes} = parseTranslationSnapshot(envelope.snapshot);
      const existing = (await db.getDownloadedTranslations()).find(
        item => item.identifier === id,
      );
      const {name, englishName, language, direction} = resolveEditionMeta(
        meta,
        [existing],
        `Translation ${id}`,
      );
      // saveTranslation replaces verses, footnotes and metadata in one transaction.
      await db.saveTranslation(
        id,
        name,
        englishName,
        language,
        direction,
        verses,
        footnotes,
      );
      await host.reloadTranslations();
      return {name};
    },
    async remove(key) {
      await db.deleteTranslation(idFromKey(key));
      await host.reloadTranslations();
    },
    async onWithdrawn(key) {
      // Idempotent: once the selection has moved off this id, nothing is left
      // to do. The engine already removed the rows (and reloaded the meta).
      if (host.selectedTranslationId() !== idFromKey(key)) return;
      // The selection falls back to the bundled edition.
      host.setSelectedTranslationId(DEFAULT_TRANSLATION_ID);
    },
  };
}
