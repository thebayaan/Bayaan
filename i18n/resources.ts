// @ai-generated
import enCommon from './locales/en/common.json';
import enHome from './locales/en/home.json';
import enCollection from './locales/en/collection.json';
import enSettings from './locales/en/settings.json';
import enSheets from './locales/en/sheets.json';
import enPlayer from './locales/en/player.json';
import enContent from './locales/en/content.json';
import enReader from './locales/en/reader.json';
import arCommon from './locales/ar/common.json';
import arHome from './locales/ar/home.json';
import arCollection from './locales/ar/collection.json';
import arSettings from './locales/ar/settings.json';
import arSheets from './locales/ar/sheets.json';
import arPlayer from './locales/ar/player.json';
import arContent from './locales/ar/content.json';
import arReader from './locales/ar/reader.json';
import frCommon from './locales/fr/common.json';
import frHome from './locales/fr/home.json';
import frCollection from './locales/fr/collection.json';
import frSettings from './locales/fr/settings.json';
import frSheets from './locales/fr/sheets.json';
import frPlayer from './locales/fr/player.json';
import frContent from './locales/fr/content.json';
import frReader from './locales/fr/reader.json';

export const defaultNS = 'common';

export const resources = {
  en: {
    common: enCommon,
    home: enHome,
    collection: enCollection,
    settings: enSettings,
    sheets: enSheets,
    player: enPlayer,
    content: enContent,
    reader: enReader,
  },
  ar: {
    common: arCommon,
    home: arHome,
    collection: arCollection,
    settings: arSettings,
    sheets: arSheets,
    player: arPlayer,
    content: arContent,
    reader: arReader,
  },
  fr: {
    common: frCommon,
    home: frHome,
    collection: frCollection,
    settings: frSettings,
    sheets: frSheets,
    player: frPlayer,
    content: frContent,
    reader: frReader,
  },
} as const;

export const namespaces = Object.keys(resources.en) as Array<
  keyof typeof resources.en
>;
