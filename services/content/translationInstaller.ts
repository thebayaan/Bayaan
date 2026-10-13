import {translationDbService} from '@/services/translation/TranslationDbService';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useTranslationStore} from '@/store/translationStore';
import type {ContentInstaller, ContentMeta} from '@/types/content';
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

// The manifest carries QF's language_name ("english", "bosnian"); the picker
// shows English display names. Irregular names are listed; the rest are
// title-cased when known.
const IRREGULAR_LANGUAGE_NAMES: Record<string, string> = {
  azeri: 'Azerbaijani',
  divehi: 'Dhivehi',
  farsi: 'Persian',
  sinhalese: 'Sinhala',
};

const KNOWN_LANGUAGES = new Set([
  'albanian',
  'amharic',
  'arabic',
  'assamese',
  'azerbaijani',
  'bengali',
  'bosnian',
  'bulgarian',
  'chechen',
  'chinese',
  'czech',
  'dari',
  'dhivehi',
  'dutch',
  'english',
  'finnish',
  'french',
  'german',
  'gujarati',
  'hausa',
  'hebrew',
  'hindi',
  'indonesian',
  'italian',
  'japanese',
  'kannada',
  'kazakh',
  'khmer',
  'kinyarwanda',
  'korean',
  'kurdish',
  'kyrgyz',
  'malay',
  'malayalam',
  'maranao',
  'marathi',
  'nepali',
  'norwegian',
  'oromo',
  'pashto',
  'persian',
  'polish',
  'portuguese',
  'punjabi',
  'romanian',
  'russian',
  'sindhi',
  'sinhala',
  'somali',
  'spanish',
  'swahili',
  'swedish',
  'tagalog',
  'tajik',
  'tamil',
  'tatar',
  'telugu',
  'thai',
  'turkish',
  'ukrainian',
  'urdu',
  'uyghur',
  'uzbek',
  'vietnamese',
  'yoruba',
]);

// The contract fixtures carry ISO codes, as AlQuranCloud editions do.
const ISO_LANGUAGE_NAMES: Record<string, string> = {
  ar: 'Arabic',
  bn: 'Bengali',
  en: 'English',
  fa: 'Persian',
  fr: 'French',
  id: 'Indonesian',
  tr: 'Turkish',
  ur: 'Urdu',
};

export function translationIdFromKey(key: string): string {
  return key.slice(key.lastIndexOf(':') + 1);
}

// Maps a manifest language to the picker's display name; an unknown value is
// kept as sent so nothing is lost.
export function translationLanguageName(
  language: string | undefined,
): string | undefined {
  const raw = language?.trim();
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  const irregular =
    IRREGULAR_LANGUAGE_NAMES[lower] ?? ISO_LANGUAGE_NAMES[lower];
  if (irregular) return irregular;
  if (KNOWN_LANGUAGES.has(lower))
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  return raw;
}

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
      const id = translationIdFromKey(key);
      // Parse before touching SQLite so a parser failure leaves the old rows alone.
      const {verses, footnotes} = parseTranslationSnapshot(envelope.snapshot);
      const existing = (await db.getDownloadedTranslations()).find(
        item => item.identifier === id,
      );
      // Fallback order: manifest meta, the installed row, defaults.
      const name = meta?.name ?? existing?.name ?? `Translation ${id}`;
      // The picker and the verse source label show englishName.
      const englishName = meta?.name ?? existing?.englishName ?? name;
      // saveTranslation replaces verses, footnotes and metadata in one transaction.
      await db.saveTranslation(
        id,
        name,
        englishName,
        translationLanguageName(meta?.language) ??
          existing?.language ??
          'English',
        meta?.direction ?? existing?.direction ?? 'ltr',
        verses,
        footnotes,
      );
      await store.getState().loadDownloadedMeta();
      return {name};
    },
    async remove(key) {
      await db.deleteTranslation(translationIdFromKey(key));
      await store.getState().loadDownloadedMeta();
    },
    async onWithdrawn(key) {
      const id = translationIdFromKey(key);
      const state = settings.getState();
      // Idempotent: once the selection has moved off this id, nothing is left to do.
      if (state.selectedTranslationId !== id) return;
      state.setSelectedTranslationId(WITHDRAWN_TRANSLATION_FALLBACK);
      await store.getState().loadDownloadedMeta();
    },
  };
}
