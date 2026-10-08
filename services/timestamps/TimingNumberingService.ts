/**
 * TimingNumberingService
 *
 * Resolves how the ayah timing entries of one (timing set, surah) are
 * numbered and returns a TimingNumbering that translates between timing
 * entries and Hafs verse keys (see utils/timestampNumbering.ts).
 *
 * Most surahs are decided from the surah's own entry count. Surahs whose Hafs
 * and rewayah counts are equal but whose verse boundaries differ need the
 * set-level classification: a vote over a sample of the surahs whose counts
 * discriminate (smallest first, so the extra downloads are a few KB). The
 * fetched timings go through TimestampService, which caches them in SQLite,
 * so the vote costs network only the first time a set is used.
 *
 * The rewayah of a set comes from its catalog name. The rewayah each set was
 * last listed with is remembered across launches (RewayahMemory), so a set
 * the loaded catalog no longer lists keeps its numbering instead of becoming
 * unknown (a Hafs recitation keeps the identity numbering). @ai
 */

import {RECITERS} from '@/data/reciterData';
import type {AyahTimestamp} from '@/types/timestamps';
import {
  ALL_REWAYAH_IDS, // @ai
  resolveRewayahFromName,
  type RewayahId,
} from '@/services/rewayah/RewayahIdentity';
import {
  hafsVerseCount,
  rewayahVerseMapService,
  type RewayahVerseMapService,
} from '@/services/mushaf/RewayahVerseMapService';
import {timestampService} from '@/services/timestamps/TimestampService';
import {timestampFetchService} from '@/services/timestamps/TimestampFetchService';
import {
  classifyTimingSet,
  createTimingNumbering,
  decideSurahNumbering,
  getTimingEntryStats,
  type TimingNumbering,
  type TimingSetClass,
} from '@/utils/timestampNumbering';

/** Discriminating surahs fetched for the set-level vote. */
export const SET_CLASS_SAMPLE_SIZE = 5;
/** Fewer successful observations than this leave the set unclassified. */
export const SET_CLASS_MIN_OBSERVATIONS = 3;

// @ai-start
/**
 * The rewayah each timing set was last listed with in the reciter catalog,
 * kept across launches.
 */
export interface RewayahMemory {
  get(rewayatId: string): RewayahId | null;
  /** Null: the set was last listed without a known rewayah. */
  set(rewayatId: string, rewayah: RewayahId | null): void;
  /** Forget every set (tests). */
  clear(): void;
}

/** Key-value storage RewayahMemory persists to (an MMKV instance). */
export interface RewayahMemoryStorage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): unknown;
  clearAll(): void;
}

const REWAYAH_MEMORY_STORAGE_ID = 'timing-set-rewayah';

function openRewayahMemoryStorage(): RewayahMemoryStorage | null {
  try {
    // Required lazily: MMKV is a native module (absent under Jest), and the
    // numbering must keep working without it, in memory only.
    const {createMMKV} =
      require('react-native-mmkv') as typeof import('react-native-mmkv');
    return createMMKV({id: REWAYAH_MEMORY_STORAGE_ID});
  } catch {
    return null;
  }
}

function isRewayahId(value: string | undefined): value is RewayahId {
  return (
    value !== undefined &&
    (ALL_REWAYAH_IDS as readonly string[]).includes(value)
  );
}

/**
 * RewayahMemory persisted with MMKV (opened on first use); kept in memory
 * only, for the session, when MMKV is unavailable.
 */
export function createRewayahMemory(
  openStorage: () => RewayahMemoryStorage | null = openRewayahMemoryStorage,
): RewayahMemory {
  const known = new Map<string, RewayahId | null>();
  let storage: RewayahMemoryStorage | null | undefined;
  const persisted = (): RewayahMemoryStorage | null => {
    if (storage === undefined) storage = openStorage();
    return storage;
  };
  const memory: RewayahMemory = {
    get(rewayatId) {
      if (!known.has(rewayatId)) {
        let saved: string | undefined;
        try {
          saved = persisted()?.getString(rewayatId);
        } catch {
          saved = undefined;
        }
        known.set(rewayatId, isRewayahId(saved) ? saved : null);
      }
      return known.get(rewayatId) ?? null;
    },
    set(rewayatId, rewayah) {
      if (memory.get(rewayatId) === rewayah) return;
      known.set(rewayatId, rewayah);
      try {
        if (rewayah) persisted()?.set(rewayatId, rewayah);
        else persisted()?.remove(rewayatId);
      } catch {
        // kept in memory for this session
      }
    },
    clear() {
      known.clear();
      try {
        persisted()?.clearAll();
      } catch {
        // nothing persisted
      }
    },
  };
  return memory;
}
// @ai-end

export interface TimingNumberingDeps {
  verseMap: RewayahVerseMapService;
  getTimestampsForSurah: (
    rewayatId: string,
    surah: number,
  ) => Promise<AyahTimestamp[] | null>;
  hasSurah: (rewayatId: string, surah: number) => boolean;
  findRewayatName: (rewayatId: string) => string | null;
  // @ai-start
  /** Whether the reciter catalog has loaded (RECITERS is filled in place). */
  catalogLoaded: () => boolean;
  /** The rewayah each set was last listed with. */
  rewayahMemory: RewayahMemory;
  // @ai-end
}

function findRewayatNameInCatalog(rewayatId: string): string | null {
  for (const reciter of RECITERS) {
    const rw = reciter.rewayat.find(r => r.id === rewayatId);
    if (rw) return rw.name;
  }
  return null;
}

const DEFAULT_DEPS: TimingNumberingDeps = {
  verseMap: rewayahVerseMapService,
  getTimestampsForSurah: (rewayatId, surah) =>
    timestampService.getTimestampsForSurah(rewayatId, surah),
  hasSurah: (rewayatId, surah) =>
    timestampFetchService.hasSurah(rewayatId, surah),
  findRewayatName: findRewayatNameInCatalog,
  catalogLoaded: () => RECITERS.length > 0, // @ai
  rewayahMemory: createRewayahMemory(), // @ai
};

export class TimingNumberingService {
  private readonly deps: TimingNumberingDeps;
  private readonly setClassCache = new Map<string, TimingSetClass>();
  private readonly inflight = new Map<string, Promise<TimingSetClass>>();

  constructor(deps: Partial<TimingNumberingDeps> = {}) {
    this.deps = {...DEFAULT_DEPS, ...deps};
  }

  /**
   * Rewayah of a timing set (catalog rewayat id), resolved through the
   * canonical rewayah resolver. Null when the set or its name is unknown.
   * A set the loaded catalog does not list keeps the rewayah it was last
   * listed with (RewayahMemory); before the catalog has loaded, nothing is
   * known about an unlisted set. @ai
   */
  resolveReciterRewayah(rewayatId: string): RewayahId | null {
    // @ai-start
    const name = this.deps.findRewayatName(rewayatId);
    if (name !== null) {
      const rewayah = resolveRewayahFromName(name);
      this.deps.rewayahMemory.set(rewayatId, rewayah);
      return rewayah;
    }
    return this.deps.catalogLoaded()
      ? this.deps.rewayahMemory.get(rewayatId)
      : null;
    // @ai-end
  }

  /**
   * Numbering decided without network, or null when the set-level class is
   * needed and not cached yet. `reciterRewayah` defaults to the catalog's.
   */
  resolveSync(
    rewayatId: string,
    surah: number,
    entries: readonly AyahTimestamp[],
    reciterRewayah: RewayahId | null = this.resolveReciterRewayah(rewayatId),
  ): TimingNumbering | null {
    const cachedClass = reciterRewayah
      ? this.setClassCache.get(this.setKey(rewayatId, reciterRewayah))
      : undefined;
    const setClass = cachedClass ?? null;
    const decision = decideSurahNumbering(
      {reciterRewayah, surah, entries, setClass},
      this.deps.verseMap,
    );
    if (decision.needsSetClass) return null;
    return createTimingNumbering({
      surah,
      mode: decision.mode,
      reciterRewayah,
      reason: decision.reason,
      entries,
      verseMap: this.deps.verseMap,
    });
  }

  /** Full resolution including the set-level vote. Never rejects. */
  async resolve(
    rewayatId: string,
    surah: number,
    entries: readonly AyahTimestamp[],
    reciterRewayah: RewayahId | null = this.resolveReciterRewayah(rewayatId),
  ): Promise<TimingNumbering> {
    const sync = this.resolveSync(rewayatId, surah, entries, reciterRewayah);
    if (sync) return sync;
    let setClass: TimingSetClass = 'unknown';
    try {
      setClass = await this.getSetClass(rewayatId, reciterRewayah!);
    } catch (error) {
      console.warn('[TimingNumbering] set classification failed:', error);
    }
    const decision = decideSurahNumbering(
      {reciterRewayah, surah, entries, setClass},
      this.deps.verseMap,
    );
    return createTimingNumbering({
      surah,
      mode: decision.mode,
      reciterRewayah,
      reason: decision.reason,
      entries,
      verseMap: this.deps.verseMap,
    });
  }

  /**
   * Set-level class: 'hafs' / 'riwayah' when at least SET_CLASS_THRESHOLD of
   * the sampled discriminating surahs match that count, else 'unknown'.
   * Conclusive results are cached per (set, rewayah); a vote that could not
   * gather enough observations (offline) is retried on the next call.
   */
  async getSetClass(
    rewayatId: string,
    rewayah: RewayahId,
  ): Promise<TimingSetClass> {
    const key = this.setKey(rewayatId, rewayah);
    const cached = this.setClassCache.get(key);
    if (cached) return cached;
    const running = this.inflight.get(key);
    if (running) return running;

    const promise = this.voteSetClass(rewayatId, rewayah).finally(() => {
      this.inflight.delete(key);
    });
    this.inflight.set(key, promise);
    return promise;
  }

  /** Forget cached set classes and remembered rewayat (tests). @ai */
  reset(): void {
    this.setClassCache.clear();
    this.inflight.clear();
    this.deps.rewayahMemory.clear(); // @ai
  }

  private async voteSetClass(
    rewayatId: string,
    rewayah: RewayahId,
  ): Promise<TimingSetClass> {
    const {verseMap} = this.deps;
    const sample: number[] = [];
    const candidates: number[] = [];
    for (let s = 1; s <= 114; s++) {
      const r = verseMap.verseCount(rewayah, s);
      if (r !== null && r !== hafsVerseCount(s)) candidates.push(s);
    }
    candidates.sort((a, b) => hafsVerseCount(a) - hafsVerseCount(b) || a - b);
    for (const s of candidates) {
      if (sample.length >= SET_CLASS_SAMPLE_SIZE) break;
      if (this.deps.hasSurah(rewayatId, s)) sample.push(s);
    }

    const results = await Promise.all(
      sample.map(s =>
        this.deps.getTimestampsForSurah(rewayatId, s).catch(() => null),
      ),
    );
    const votes = {hafs: 0, riwayah: 0, neither: 0};
    results.forEach((entries, i) => {
      if (!entries || entries.length === 0) return;
      const s = sample[i];
      const {count, contiguous} = getTimingEntryStats(entries);
      if (contiguous && count === hafsVerseCount(s)) votes.hafs += 1;
      else if (contiguous && count === verseMap.verseCount(rewayah, s)) {
        votes.riwayah += 1;
      } else votes.neither += 1;
    });

    const verdict = classifyTimingSet(votes, SET_CLASS_MIN_OBSERVATIONS);
    if (verdict === null) return 'unknown'; // not cached: retry later
    this.setClassCache.set(this.setKey(rewayatId, rewayah), verdict);
    if (__DEV__) {
      console.log(
        `[TimingNumbering] set ${rewayatId} (${rewayah}) classified ${verdict}`,
        votes,
      );
    }
    return verdict;
  }

  private setKey(rewayatId: string, rewayah: RewayahId): string {
    return `${rewayatId}|${rewayah}`;
  }
}

export const timingNumberingService = new TimingNumberingService();
