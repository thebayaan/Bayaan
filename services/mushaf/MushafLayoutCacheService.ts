import {createMMKV, type MMKV} from 'react-native-mmkv';

import {type JustResultByLine, replacer, reviver} from './JustificationService';

// Bump this when font files change or layout computation logic changes.
// Incrementing invalidates all cached layouts and forces recomputation.
const SCHEMA_VERSION = 6;

function mmkvKey(fontFamily: string, pageNumber: number): string {
  return `dk:${fontFamily}:${pageNumber}`;
}

/**
 * Persistent MMKV cache for mushaf page layouts.
 *
 * Pages are computed on-demand by SkiaPage when first viewed, then persisted
 * here so subsequent app launches can read them synchronously without
 * recomputing. The FlatList windowSize={7} ensures adjacent pages are
 * pre-mounted and cached before the user swipes to them.
 */
class MushafLayoutCacheService {
  private mmkv: MMKV;

  constructor() {
    this.mmkv = createMMKV({id: 'mushaf-layouts'});

    // Invalidate on schema version change
    const storedVersion = this.mmkv.getNumber('dk_schema_version');
    if (storedVersion !== SCHEMA_VERSION) {
      this.mmkv.clearAll();
      this.mmkv.set('dk_schema_version', SCHEMA_VERSION);
    }
  }

  /**
   * Synchronous read of a single page layout from MMKV.
   * Returns undefined on miss.
   */
  getPageLayout(
    pageNumber: number,
    fontFamily: string,
  ): JustResultByLine[] | undefined {
    const key = mmkvKey(fontFamily, pageNumber);
    const json = this.mmkv.getString(key);
    if (!json) return undefined;
    const parsed = JSON.parse(json, reviver) as JustResultByLine[];
    // Guard: reject empty arrays (corrupted cache from race condition)
    if (parsed.length === 0) return undefined;
    return parsed;
  }

  /**
   * Synchronous write of a single page layout to MMKV.
   */
  setPageLayout(
    pageNumber: number,
    fontFamily: string,
    data: JustResultByLine[],
  ): void {
    const key = mmkvKey(fontFamily, pageNumber);
    this.mmkv.set(key, JSON.stringify(data, replacer));
  }

  /**
   * Clear all cached layouts (e.g., for debugging).
   */
  clearAll(): void {
    this.mmkv.clearAll();
    this.mmkv.set('dk_schema_version', SCHEMA_VERSION);
  }
}

export const mushafLayoutCacheService = new MushafLayoutCacheService();
