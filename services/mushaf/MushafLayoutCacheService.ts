import {createMMKV, type MMKV} from 'react-native-mmkv';

import {
  digitalKhattDataService,
  getRewayahDataIdentityKey,
} from './DigitalKhattDataService';
import {type JustResultByLine, replacer, reviver} from './JustificationService';
import type {RewayahId} from '@/store/mushafSettingsStore';

// Bump this when font files change or layout computation logic changes.
// Incrementing invalidates all cached layouts and forces recomputation.
// v9: layouts are now keyed by rewayah (word widths differ per transmission
// — sharing a cache across rewayahs leaves Shouba lines under-stretched).
// v10: layouts are keyed by the identity of the text they were computed from
// (active rewayah + words-DB and layout-DB content hashes, read from
// DigitalKhattDataService), so corrected rewayah DBs never reuse layouts of
// the old text, and a settings-store/data mismatch can no longer file a
// layout under the wrong rewayah. The bump also purges layouts that v9 races
// saved under the wrong rewayah or with non-finite spacing.
const SCHEMA_VERSION = 10;
const SCHEMA_VERSION_KEY = 'dk_schema_version';
const KEY_PREFIX = 'dk';

/**
 * MMKV key of one page layout: `dk:<font>:<identity>:<page>`, where identity
 * is DigitalKhattDataService's `<rewayah>@<wordsSha8>.<layoutSha8>`.
 */
export function layoutCacheKey(
  fontFamily: string,
  identityKey: string,
  pageNumber: number,
): string {
  return `${KEY_PREFIX}:${fontFamily}:${identityKey}:${pageNumber}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Structural check of a page layout before it is persisted or served: at
 * least one line, every spacing / ratio / font-feature value a finite number
 * (Infinity, e.g. from justifying an empty line, serializes to null and later
 * collapses word spacing), and, when `expectedLineCount` is given, one entry
 * per layout line of the page.
 */
export function isUsablePageLayout(
  data: unknown,
  expectedLineCount?: number,
): data is JustResultByLine[] {
  if (!Array.isArray(data) || data.length === 0) return false;
  if (expectedLineCount !== undefined && data.length !== expectedLineCount) {
    return false;
  }
  for (const line of data as unknown[]) {
    if (typeof line !== 'object' || line === null) return false;
    const {simpleSpacing, ayaSpacing, fontSizeRatio, fontFeatures} =
      line as Partial<JustResultByLine>;
    if (
      !isFiniteNumber(simpleSpacing) ||
      !isFiniteNumber(ayaSpacing) ||
      !isFiniteNumber(fontSizeRatio) ||
      !(fontFeatures instanceof Map)
    ) {
      return false;
    }
    for (const features of fontFeatures.values()) {
      if (!Array.isArray(features)) return false;
      for (const feature of features) {
        if (!isFiniteNumber((feature as {value?: unknown})?.value)) {
          return false;
        }
      }
    }
  }
  return true;
}

/**
 * Persistent MMKV cache for mushaf page layouts.
 *
 * Pages are computed on-demand by SkiaPage when first viewed, then persisted
 * here so subsequent app launches can read them synchronously without
 * recomputing. The FlatList windowSize={7} ensures adjacent pages are
 * pre-mounted and cached before the user swipes to them.
 *
 * Reads and writes use the data identity of the text DigitalKhattDataService
 * serves at call time. Layouts are computed synchronously from that text
 * (JustService.getPageLayout) and saved right after, so a layout is always
 * filed under the identity it was computed from. Before the data service has
 * loaded, nothing is read or written.
 */
class MushafLayoutCacheService {
  private mmkv: MMKV;
  private pruned = false;

  constructor() {
    this.mmkv = createMMKV({id: 'mushaf-layouts'});

    // Invalidate on schema version change
    const storedVersion = this.mmkv.getNumber(SCHEMA_VERSION_KEY);
    if (storedVersion !== SCHEMA_VERSION) {
      this.mmkv.clearAll();
      this.mmkv.set(SCHEMA_VERSION_KEY, SCHEMA_VERSION);
      this.pruned = true;
    }
  }

  /**
   * Synchronous read of a single page layout from MMKV.
   * Returns undefined on miss, before the data service has loaded, or when
   * the stored entry is unusable (it is then dropped).
   */
  getPageLayout(
    pageNumber: number,
    fontFamily: string,
  ): JustResultByLine[] | undefined {
    const identityKey = digitalKhattDataService.getLayoutIdentityKey();
    if (!identityKey) return undefined;
    this.pruneOnce();
    const key = layoutCacheKey(fontFamily, identityKey, pageNumber);
    const json = this.mmkv.getString(key);
    if (!json) return undefined;
    let parsed: unknown;
    try {
      parsed = JSON.parse(json, reviver);
    } catch {
      parsed = undefined;
    }
    if (!isUsablePageLayout(parsed)) {
      this.mmkv.remove(key);
      return undefined;
    }
    return parsed;
  }

  /**
   * Synchronous write of a single page layout to MMKV, filed under the
   * identity of the text the data service serves now. Skipped before the data
   * service has loaded and for layouts that fail isUsablePageLayout (wrong
   * line count for the page, non-finite numbers).
   */
  setPageLayout(
    pageNumber: number,
    fontFamily: string,
    data: JustResultByLine[],
  ): void {
    const identityKey = digitalKhattDataService.getLayoutIdentityKey();
    if (!identityKey) return;
    const lineCount = digitalKhattDataService.getPageLines(pageNumber).length;
    if (!isUsablePageLayout(data, lineCount)) {
      console.warn(
        `[MushafLayoutCache] Not persisting unusable layout for page ${pageNumber} (${fontFamily}, ${identityKey})`,
      );
      return;
    }
    this.pruneOnce();
    const key = layoutCacheKey(fontFamily, identityKey, pageNumber);
    this.mmkv.set(key, JSON.stringify(data, replacer));
  }

  /**
   * Removes layouts whose data identity is no longer what this build loads
   * for their rewayah (left behind by a data update), and malformed `dk:`
   * keys. Returns the number of removed entries.
   */
  pruneStaleEntries(): number {
    const currentByRewayah = new Map<string, string | null>();
    let removed = 0;
    for (const key of this.mmkv.getAllKeys()) {
      if (key === SCHEMA_VERSION_KEY) continue;
      const parts = key.split(':');
      if (parts[0] !== KEY_PREFIX) continue;
      const identity = parts.length === 4 ? parts[2] : '';
      const rewayah = identity.split('@')[0];
      if (!currentByRewayah.has(rewayah)) {
        let current: string | null = null;
        try {
          current = getRewayahDataIdentityKey(rewayah as RewayahId);
        } catch {
          current = null;
        }
        currentByRewayah.set(rewayah, current);
      }
      if (identity === '' || identity !== currentByRewayah.get(rewayah)) {
        this.mmkv.remove(key);
        removed += 1;
      }
    }
    return removed;
  }

  private pruneOnce(): void {
    if (this.pruned) return;
    this.pruned = true;
    try {
      const removed = this.pruneStaleEntries();
      if (removed > 0) {
        console.log(`[MushafLayoutCache] Pruned ${removed} stale layouts`);
      }
    } catch (error) {
      console.warn('[MushafLayoutCache] Pruning failed:', error);
    }
  }

  /**
   * Clear all cached layouts (e.g., for debugging).
   */
  clearAll(): void {
    this.mmkv.clearAll();
    this.mmkv.set(SCHEMA_VERSION_KEY, SCHEMA_VERSION);
  }
}

export const mushafLayoutCacheService = new MushafLayoutCacheService();
