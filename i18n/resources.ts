// @ai-generated
// Locale files per language. English is imported eagerly: it is the source
// language, the fallback for every key and the type of every namespace.
// Other languages load on first access, so a session only evaluates the
// languages it reads (the active one, plus English as the fallback).
import enCommon from './locales/en/common.json';
import enHome from './locales/en/home.json';
import enCollection from './locales/en/collection.json';
import enSettings from './locales/en/settings.json';
import enSheets from './locales/en/sheets.json';
import enPlayer from './locales/en/player.json';
import enContent from './locales/en/content.json';
import enReader from './locales/en/reader.json';
import {type AppLanguage} from './languages';

export const defaultNS = 'common';

const en = {
  common: enCommon,
  home: enHome,
  collection: enCollection,
  settings: enSettings,
  sheets: enSheets,
  player: enPlayer,
  content: enContent,
  reader: enReader,
} as const;

/** One language's namespaces. Other languages may lack keys while in progress. */
export type LocaleResources = {
  [Namespace in keyof typeof en]: (typeof en)[Namespace];
};

// Metro needs literal require paths, so each language lists its files once.
const LOADERS: Readonly<
  Record<Exclude<AppLanguage, 'en'>, () => LocaleResources>
> = {
  ar: () => ({
    common: require('./locales/ar/common.json'),
    home: require('./locales/ar/home.json'),
    collection: require('./locales/ar/collection.json'),
    settings: require('./locales/ar/settings.json'),
    sheets: require('./locales/ar/sheets.json'),
    player: require('./locales/ar/player.json'),
    content: require('./locales/ar/content.json'),
    reader: require('./locales/ar/reader.json'),
  }),
  am: () => ({
    common: require('./locales/am/common.json'),
    home: require('./locales/am/home.json'),
    collection: require('./locales/am/collection.json'),
    settings: require('./locales/am/settings.json'),
    sheets: require('./locales/am/sheets.json'),
    player: require('./locales/am/player.json'),
    content: require('./locales/am/content.json'),
    reader: require('./locales/am/reader.json'),
  }),
};

type Resources = {en: typeof en} & Record<
  Exclude<AppLanguage, 'en'>,
  LocaleResources
>;

/**
 * Every language's resources. Non-source languages are getters that require
 * their files on first access, then replace themselves with the value.
 */
export const resources = {en} as Resources;
for (const [language, load] of Object.entries(LOADERS) as [
  Exclude<AppLanguage, 'en'>,
  () => LocaleResources,
][]) {
  Object.defineProperty(resources, language, {
    enumerable: true,
    configurable: true,
    get() {
      const value = load();
      Object.defineProperty(resources, language, {
        value,
        enumerable: true,
        writable: false,
      });
      return value;
    },
  });
}

export const namespaces = Object.keys(en) as Array<keyof typeof en>;
