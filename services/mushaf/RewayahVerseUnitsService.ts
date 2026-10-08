// @ai-generated
/**
 * RewayahVerseUnitsService: the verse units (RewayahVerseUnits.ts) of every
 * rewayah whose words are in memory, derived from the DigitalKhatt data
 * service's caches and cached per rewayah + data identity (contract C5).
 *
 * - get(rewayah) never loads anything: it returns the units while the
 *   rewayah's words are in memory (the active main cache or a side cache)
 *   and null otherwise. useRewayahVerseUnits() loads on demand and
 *   re-renders when the words arrive.
 * - The cache key is getRewayahDataIdentityKey(rewayah)
 *   (`<rewayah>@<wordsSha8>.<layoutSha8>`), which changes exactly when the
 *   bundled words change. Units are dropped when the data service drops the
 *   rewayah's words, so memory follows the data service's own caches.
 * - Fail closed: units that cannot be derived (pre-Release-1 data, a
 *   malformed DB) or that disagree with the bundled verse map
 *   (<id>-versemap.json, Hafs: the identity map) are refused with status
 *   'error' and a console error. Consumers then show no rewayah verse
 *   numbers at all rather than guessed ones.
 */

import {
  digitalKhattDataService,
  getRewayahDataIdentityKey,
  type DKWordInfo,
  type RewayahLoadState,
} from './DigitalKhattDataService';
import {rewayahVerseMapService} from './RewayahVerseMapService';
import {
  buildRewayahVerseUnits,
  crossCheckVerseUnits,
  type RewayahVerseUnits,
  type VerseMapReader,
  type VerseUnitSlot,
} from './RewayahVerseUnits';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

const TOTAL_SURAHS = 114;

/**
 * - 'ready': get() returns the units;
 * - 'loading' / 'idle': the rewayah's words are loading / not requested
 *   (ensureRewayahLoaded; the hook does it);
 * - 'error': the words failed to load, or the units were refused (malformed
 *   data or a verse-map mismatch): show no rewayah verse numbers;
 * - 'unavailable': no words DB is bundled for this rewayah.
 */
export type VerseUnitsStatus =
  | 'ready'
  | 'loading'
  | 'idle'
  | 'error'
  | 'unavailable';

/** The DigitalKhattDataService read API the units need (fakes in tests). */
export interface VerseUnitsDataReader {
  readonly rewayah: RewayahId;
  readonly initialized: boolean;
  isRewayahReady(rewayah: RewayahId): boolean;
  getRewayahLoadState(rewayah: RewayahId): RewayahLoadState;
  getWordInfo(wordId: number): DKWordInfo | undefined;
  getWordText(wordId: number): string;
  getVerseWords(verseKey: string, rewayah?: RewayahId): DKWordInfo[];
}

/**
 * Every slot of `rewayah` in id order, read from the data service, or null
 * while its words are not in memory. Word ids and Hafs locations are the
 * same in every words DB (contract C1), so they come from the main cache
 * whatever rewayah it holds. A side-cache rewayah contributes its texts
 * through getVerseWords, which keeps each visible slot's Hafs word position
 * and omits blank slots (those stay '').
 *
 * The iterator yields ONE reused object (no allocation per slot); a caller
 * that keeps slots must copy them (buildRewayahVerseUnits does not keep any).
 */
export function readRewayahSlots(
  dk: VerseUnitsDataReader,
  rewayah: RewayahId,
): Iterable<VerseUnitSlot> | null {
  if (!dk.initialized || !dk.isRewayahReady(rewayah)) return null;
  if (!dk.getWordInfo(1)) return null;
  const active = rewayah === dk.rewayah;
  // One reused object: the builder copies what it needs from each slot.
  const slot: VerseUnitSlot = {id: 0, surah: 0, ayah: 0, word: 0, text: ''};
  function* slots(): Generator<VerseUnitSlot> {
    let verseKey = '';
    let verseTexts = new Map<number, string>();
    for (let id = 1; ; id++) {
      const info = dk.getWordInfo(id);
      if (!info) return;
      if (info.verseKey !== verseKey) {
        verseKey = info.verseKey;
        const colon = verseKey.indexOf(':');
        slot.surah = Number(verseKey.slice(0, colon));
        slot.ayah = Number(verseKey.slice(colon + 1));
        if (!active) {
          verseTexts = new Map();
          for (const w of dk.getVerseWords(verseKey, rewayah)) {
            verseTexts.set(w.wordPositionInVerse, w.text);
          }
        }
      }
      slot.id = id;
      slot.word = info.wordPositionInVerse;
      slot.text = active
        ? dk.getWordText(id)
        : (verseTexts.get(info.wordPositionInVerse) ?? '');
      yield slot;
    }
  }
  return slots();
}

interface CacheEntry {
  dataKey: string;
  units: RewayahVerseUnits | null;
  error: unknown;
}

export class RewayahVerseUnitsService {
  private readonly cache = new Map<RewayahId, CacheEntry>();

  constructor(
    private readonly dk: VerseUnitsDataReader = digitalKhattDataService,
    private readonly verseMap: VerseMapReader = rewayahVerseMapService,
    private readonly dataKeyOf: (
      rewayah: RewayahId,
    ) => string | null = getRewayahDataIdentityKey,
  ) {}

  /**
   * The rewayah's verse units, or null while its words are not in memory or
   * when the units were refused (see getStatus). Never triggers a load.
   */
  get(rewayah: RewayahId): RewayahVerseUnits | null {
    return this.entry(rewayah)?.units ?? null;
  }

  getStatus(rewayah: RewayahId): VerseUnitsStatus {
    const load = this.dk.getRewayahLoadState(rewayah);
    if (load !== 'ready') return load;
    const entry = this.entry(rewayah);
    // Words in memory without a data identity: a broken build, never labels.
    if (!entry) return this.dataKey(rewayah) === null ? 'error' : 'loading';
    return entry.units ? 'ready' : 'error';
  }

  /** Why the units of a loaded rewayah were refused, or null. */
  getError(rewayah: RewayahId): unknown {
    return this.entry(rewayah)?.error ?? null;
  }

  /** Drop every cached unit set (tests, dev tools). */
  clearCache(): void {
    this.cache.clear();
  }

  private dataKey(rewayah: RewayahId): string | null {
    try {
      return this.dataKeyOf(rewayah);
    } catch {
      return null; // no manifest entry: the words cannot load either
    }
  }

  private entry(rewayah: RewayahId): CacheEntry | null {
    const dataKey = this.dataKey(rewayah);
    if (!dataKey || !this.dk.isRewayahReady(rewayah)) {
      this.cache.delete(rewayah);
      return null;
    }
    const cached = this.cache.get(rewayah);
    if (cached && cached.dataKey === dataKey) return cached;
    const slots = readRewayahSlots(this.dk, rewayah);
    if (!slots) return null;
    let entry: CacheEntry;
    try {
      const units = buildRewayahVerseUnits(rewayah, slots, dataKey);
      const problems = crossCheckVerseUnits(units, this.verseMap);
      if (units.surahs().length !== TOTAL_SURAHS) {
        problems.unshift(`${units.surahs().length} of ${TOTAL_SURAHS} surahs`);
      }
      if (problems.length > 0) {
        throw new Error(
          `${rewayah} words DB and verse map disagree: ${problems.join('; ')}`,
        );
      }
      entry = {dataKey, units, error: null};
    } catch (error) {
      console.error(
        `[RewayahVerseUnits] ${rewayah} verse units refused; its verse numbering stays off:`,
        error,
      );
      entry = {dataKey, units: null, error};
    }
    this.cache.set(rewayah, entry);
    return entry;
  }
}

export const rewayahVerseUnitsService = new RewayahVerseUnitsService();
