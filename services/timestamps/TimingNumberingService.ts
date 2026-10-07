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
 */

import {RECITERS} from '@/data/reciterData';
import type {AyahTimestamp} from '@/types/timestamps';
import {
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

export interface TimingNumberingDeps {
  verseMap: RewayahVerseMapService;
  getTimestampsForSurah: (
    rewayatId: string,
    surah: number,
  ) => Promise<AyahTimestamp[] | null>;
  hasSurah: (rewayatId: string, surah: number) => boolean;
  findRewayatName: (rewayatId: string) => string | null;
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
   */
  resolveReciterRewayah(rewayatId: string): RewayahId | null {
    return resolveRewayahFromName(this.deps.findRewayatName(rewayatId));
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

  /** Forget cached set classes (tests). */
  reset(): void {
    this.setClassCache.clear();
    this.inflight.clear();
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
