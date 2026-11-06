import {translationDbService} from '@/services/translation/TranslationDbService';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useTranslationStore} from '@/store/translationStore';
import type {ContentInstaller, ContentMeta} from '@/types/content';
import {idFromKey} from './contentKeys';
import {resolveEditionMeta} from './editionMeta';
import {parseTranslationSnapshot} from './translationSnapshot';

type TranslationDb = Pick<
  typeof translationDbService,
  'saveTranslation' | 'deleteTranslation' | 'getDownloadedTranslations'
>;

type SettingsStore = {
  getState(): {
    selectedTranslationId: string;
    setSelectedTranslationId: (id: string) => void;
  };
};

type MetaStore = {
  getState(): {loadDownloadedMeta: () => Promise<void>};
};

// Where the selection goes when its edition is withdrawn: always bundled.
export const WITHDRAWN_TRANSLATION_FALLBACK = 'clear-quran';

export function createTranslationInstaller(
  deps: {
    db?: TranslationDb;
    store?: MetaStore;
    settings?: SettingsStore;
  } = {},
): ContentInstaller {
  const db = deps.db ?? translationDbService;
  const store = deps.store ?? useTranslationStore;
  const settings = deps.settings ?? useMushafSettingsStore;
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
      await store.getState().loadDownloadedMeta();
      return {name};
    },
    async remove(key) {
      await db.deleteTranslation(idFromKey(key));
      await store.getState().loadDownloadedMeta();
    },
    async onWithdrawn(key) {
      const state = settings.getState();
      // Idempotent: once the selection has moved off this id, nothing is left
      // to do. The engine already removed the rows (and reloaded the meta).
      if (state.selectedTranslationId !== idFromKey(key)) return;
      state.setSelectedTranslationId(WITHDRAWN_TRANSLATION_FALLBACK);
    },
  };
}
