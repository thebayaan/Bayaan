import {isNullableString, isRecord} from './guards';

export const WIDGET_CATALOG_VERSION = 1;

export interface WidgetCatalogReciter {
  id: string;
  name: string;
  artworkFile: string; // reciter-{id}.jpg; may not be cached yet
}

export interface WidgetCatalogDhikr {
  id: string;
  arabic: string;
  translation: string | null;
  repeatCount: number;
}

// Configuration pick lists. Written when reciters or adhkar change, not per snapshot.
export interface WidgetCatalog {
  version: typeof WIDGET_CATALOG_VERSION;
  reciters: WidgetCatalogReciter[];
  adhkar: WidgetCatalogDhikr[];
}

function isCatalogReciter(value: unknown): value is WidgetCatalogReciter {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.artworkFile === 'string'
  );
}

function isCatalogDhikr(value: unknown): value is WidgetCatalogDhikr {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.arabic === 'string' &&
    isNullableString(value.translation) &&
    typeof value.repeatCount === 'number'
  );
}

export function isWidgetCatalog(value: unknown): value is WidgetCatalog {
  return (
    isRecord(value) &&
    value.version === WIDGET_CATALOG_VERSION &&
    Array.isArray(value.reciters) &&
    value.reciters.every(isCatalogReciter) &&
    Array.isArray(value.adhkar) &&
    value.adhkar.every(isCatalogDhikr)
  );
}
