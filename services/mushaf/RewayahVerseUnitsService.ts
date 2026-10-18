// @ai-generated
/**
 * RewayahVerseUnitsService: the verse units (RewayahVerseUnits.ts) of every
 * rewayah whose words are in memory, derived from the DigitalKhatt data
 * service's caches and cached per rewayah + data identity (contract C5).
 *
 * - Nothing here builds on a caller's stack, least of all during a render:
 *   the units of a whole words DB (about 84k slots, then the verse-map
 *   cross-check) take some 50 ms under node and several times that on a
 *   slow phone.
 *   - peek(rewayah) returns the units once they are built, else null, and
 *     getStatus(rewayah) says why. Neither builds nor loads anything.
 *   - request(rewayah) builds them once the rewayah's words are in memory:
 *     after interactions, in chunks of about BUILD_CHUNK_MS that yield to
 *     the event loop in between. However it is chunked, the result is
 *     exactly that of buildRewayahVerseUnits + crossCheckVerseUnits in one
 *     go. Words that change under a build (a mushaf switch moves them
 *     between the main and a side cache, an eviction drops them) start it
 *     over, so no build mixes two reads of the data service.
 *   - When a build ends (units accepted or refused), getVersion() changes
 *     and subscribers are called (useSyncExternalStore), so hooks and the
 *     mushaf pages render the units.
 *   useRewayahVerseUnits() loads the words on demand and requests the units.
 * - The cache key is getRewayahDataIdentityKey(rewayah)
 *   (`<rewayah>@<wordsSha8>.<layoutSha8>`), which changes exactly when the
 *   bundled words change. Units are dropped when the data service drops the
 *   rewayah's words, so memory follows the data service's own caches.
 * - Fail closed: units that cannot be derived (pre-Release-1 data, a
 *   malformed DB) or that disagree with the bundled verse map
 *   (<id>-versemap.json, Hafs: the identity map) are refused with status
 *   'error' and a console error. Consumers then show no rewayah verse
 *   numbers at all rather than guessed ones. retry(rewayah) builds them
 *   again.
 */

import {InteractionManager} from 'react-native';
import {
  digitalKhattDataService,
  getRewayahDataIdentityKey,
  type DKWordInfo,
  type RewayahLoadState,
} from './DigitalKhattDataService';
import {rewayahVerseMapService} from './RewayahVerseMapService';
import {
  createVerseUnitsBuilder,
  createVerseUnitsCrossCheck,
  type RewayahVerseUnits,
  type VerseMapReader,
  type VerseUnitsBuilder,
  type VerseUnitsCrossCheck,
  type VerseUnitSlot,
} from './RewayahVerseUnits';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

const TOTAL_SURAHS = 114;

/**
 * - 'ready': peek() returns the units;
 * - 'loading': the rewayah's words are loading, or its units are being
 *   built (request()), or wait for startup to load the main cache;
 * - 'idle': not asked for: its words are not in memory (ensureRewayahLoaded;
 *   the hook does it), or they are and its units were not requested yet
 *   (request(); the hook does it);
 * - 'error': the words failed to load, or the units were refused (malformed
 *   data or a verse-map mismatch), or startup failed to load the main cache:
 *   show no rewayah verse numbers;
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

/**
 * When the chunks of a build run. The app's: the first one after
 * interactions (InteractionManager), each next one after a setTimeout(0),
 * so touches, gestures and renders run between chunks. React Native 0.85
 * deprecates InteractionManager and its runAfterInteractions only waits for
 * the next tick there: the chunks are what keep the JS thread free.
 */
export interface VerseUnitsBuildScheduler {
  afterInteractions(task: () => void): void;
  nextChunk(task: () => void): void;
}

const APP_SCHEDULER: VerseUnitsBuildScheduler = {
  afterInteractions(task) {
    InteractionManager.runAfterInteractions(task);
  },
  nextChunk(task) {
    setTimeout(task, 0);
  },
};

export interface VerseUnitsBuildOptions {
  scheduler?: VerseUnitsBuildScheduler;
  /** A chunk yields once it has run this many milliseconds. */
  chunkMs?: number;
  /** Slots read and built between two looks at the clock. */
  sliceSlots?: number;
}

/**
 * Half a frame of work per chunk: on a slow phone a whole words DB then
 * takes a few dozen chunks instead of one stall of a second or so.
 */
export const BUILD_CHUNK_MS = 8;
// Well under a millisecond of work under node (83,668 slots build in about
// 50 ms there), so a chunk overruns its budget by little.
const SLICE_SLOTS = 512;

interface CacheEntry {
  dataKey: string;
  units: RewayahVerseUnits | null;
  error: unknown;
}

/** Where a build is: nothing read yet, reading slots, or cross-checking. */
type BuildPhase =
  | {readonly kind: 'start'}
  | {
      readonly kind: 'slots';
      readonly slots: Iterator<VerseUnitSlot>;
      readonly builder: VerseUnitsBuilder;
    }
  | {
      readonly kind: 'check';
      readonly units: RewayahVerseUnits;
      readonly check: VerseUnitsCrossCheck;
      readonly surahs: readonly number[];
      next: number;
    };

interface BuildJob {
  readonly rewayah: RewayahId;
  /** Settles with the units, or null when refused or not buildable. */
  readonly done: Promise<RewayahVerseUnits | null>;
  readonly settle: (units: RewayahVerseUnits | null) => void;
  /** Identity of the words being read, and whether from the main cache. */
  dataKey: string;
  active: boolean;
  phase: BuildPhase;
}

function createJob(rewayah: RewayahId, dataKey: string): BuildJob {
  let settle: (units: RewayahVerseUnits | null) => void = () => undefined;
  const done = new Promise<RewayahVerseUnits | null>(resolve => {
    settle = resolve;
  });
  return {
    rewayah,
    done,
    settle,
    dataKey,
    active: false,
    phase: {kind: 'start'},
  };
}

export class RewayahVerseUnitsService {
  private readonly cache = new Map<RewayahId, CacheEntry>();
  private readonly builds = new Map<RewayahId, BuildJob>();
  private readonly listeners = new Set<() => void>();
  private version = 0;
  private readonly scheduler: VerseUnitsBuildScheduler;
  private readonly chunkMs: number;
  private readonly sliceSlots: number;

  constructor(
    private readonly dk: VerseUnitsDataReader = digitalKhattDataService,
    private readonly verseMap: VerseMapReader = rewayahVerseMapService,
    private readonly dataKeyOf: (
      rewayah: RewayahId,
    ) => string | null = getRewayahDataIdentityKey,
    options: VerseUnitsBuildOptions = {},
  ) {
    this.scheduler = options.scheduler ?? APP_SCHEDULER;
    this.chunkMs = options.chunkMs ?? BUILD_CHUNK_MS;
    this.sliceSlots = Math.max(1, options.sliceSlots ?? SLICE_SLOTS);
  }

  /**
   * The rewayah's verse units once built, else null (see getStatus). Never
   * builds or loads anything: safe in a render.
   */
  peek(rewayah: RewayahId): RewayahVerseUnits | null {
    return this.entry(rewayah)?.units ?? null;
  }

  /** Never builds or loads anything: safe in a render. */
  getStatus(rewayah: RewayahId): VerseUnitsStatus {
    const load = this.dk.getRewayahLoadState(rewayah);
    if (load !== 'ready') return load;
    const entry = this.entry(rewayah);
    if (entry) return entry.units ? 'ready' : 'error';
    // Words in memory without a data identity: a broken build, never labels.
    if (this.dataKey(rewayah) === null) return 'error';
    // A side copy's slots take their word ids and Hafs locations from the
    // main cache: until startup loads it the units wait for it, and they
    // fail with it (an error to retry, not an endless 'loading').
    if (!this.dk.initialized) {
      return this.dk.getRewayahLoadState(this.dk.rewayah) === 'error'
        ? 'error'
        : 'loading';
    }
    return this.builds.has(rewayah) ? 'loading' : 'idle';
  }

  /** Why the units of a loaded rewayah were refused, or null. */
  getError(rewayah: RewayahId): unknown {
    return this.entry(rewayah)?.error ?? null;
  }

  /**
   * Builds the rewayah's units if they are not built or being built: after
   * interactions, in chunks (see the file comment). Resolves with the units,
   * or null when they are refused or its words are not in memory (nothing
   * is built then; request again once they are). Never rejects.
   */
  request(rewayah: RewayahId): Promise<RewayahVerseUnits | null> {
    const entry = this.entry(rewayah);
    if (entry) return Promise.resolve(entry.units);
    const pending = this.builds.get(rewayah);
    if (pending) return pending.done;
    const dataKey = this.dataKey(rewayah);
    if (!dataKey || !this.dk.initialized || !this.dk.isRewayahReady(rewayah)) {
      return Promise.resolve(null);
    }
    const job = createJob(rewayah, dataKey);
    this.builds.set(rewayah, job);
    this.scheduler.afterInteractions(() => this.runChunk(job));
    return job.done;
  }

  /** request(), first forgetting units that were refused. */
  retry(rewayah: RewayahId): Promise<RewayahVerseUnits | null> {
    const entry = this.entry(rewayah);
    if (!entry || entry.units) return this.request(rewayah);
    this.cache.delete(rewayah);
    const done = this.request(rewayah);
    // 'error' is now 'loading' (or 'idle'): consumers show it.
    this.notify();
    return done;
  }

  /**
   * For useSyncExternalStore: called whenever a build ends, refused units
   * are retried, or the cache is cleared.
   */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Changes whenever subscribers are called (see subscribe). */
  getVersion = (): number => this.version;

  /** Drop every cached unit set and every build (tests, dev tools). */
  clearCache(): void {
    this.cache.clear();
    const builds = [...this.builds.values()];
    this.builds.clear();
    for (const job of builds) job.settle(null);
    this.notify();
  }

  private notify(): void {
    this.version += 1;
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch (error) {
        console.error('[RewayahVerseUnits] Listener threw:', error);
      }
    }
  }

  private dataKey(rewayah: RewayahId): string | null {
    try {
      return this.dataKeyOf(rewayah);
    } catch {
      return null; // no manifest entry: the words cannot load either
    }
  }

  // The cached entry of the words in memory now; drops a stale one.
  private entry(rewayah: RewayahId): CacheEntry | null {
    const dataKey = this.dataKey(rewayah);
    if (!dataKey || !this.dk.isRewayahReady(rewayah)) {
      this.cache.delete(rewayah);
      return null;
    }
    const cached = this.cache.get(rewayah);
    if (!cached) return null;
    if (cached.dataKey === dataKey) return cached;
    this.cache.delete(rewayah);
    return null;
  }

  // One chunk of a build: slices of work until the chunk has run chunkMs,
  // then the next chunk is scheduled; the last one caches the result.
  private runChunk(job: BuildJob): void {
    if (this.builds.get(job.rewayah) !== job) return; // dropped meanwhile
    try {
      if (job.phase.kind === 'start' || !this.sameWords(job)) {
        if (!this.startJob(job)) {
          // Its words left memory: nothing to build (or refuse) now.
          this.endBuild(job, null);
          return;
        }
      }
      const startedAt = Date.now();
      while (!this.advance(job)) {
        if (Date.now() - startedAt >= this.chunkMs) {
          this.scheduler.nextChunk(() => this.runChunk(job));
          return;
        }
      }
      const phase = job.phase;
      // advance() is done only after the cross-check; never leave a build
      // pending (its requests would wait forever).
      if (phase.kind !== 'check') throw new Error('build ended unchecked');
      const {units} = phase;
      const problems = phase.check.result();
      if (units.surahs().length !== TOTAL_SURAHS) {
        problems.unshift(`${units.surahs().length} of ${TOTAL_SURAHS} surahs`);
      }
      if (problems.length > 0) {
        throw new Error(
          `${job.rewayah} words DB and verse map disagree: ${problems.join('; ')}`,
        );
      }
      this.cache.set(job.rewayah, {dataKey: job.dataKey, units, error: null});
      this.endBuild(job, units);
    } catch (error) {
      console.error(
        `[RewayahVerseUnits] ${job.rewayah} verse units refused; its verse numbering stays off:`,
        error,
      );
      this.cache.set(job.rewayah, {dataKey: job.dataKey, units: null, error});
      this.endBuild(job, null);
    }
  }

  // The words a build reads are still those it started on: same data, in
  // the same cache (main or side). A build never reads across a change.
  private sameWords(job: BuildJob): boolean {
    return (
      this.dk.initialized &&
      this.dk.isRewayahReady(job.rewayah) &&
      (this.dk.rewayah === job.rewayah) === job.active &&
      this.dataKey(job.rewayah) === job.dataKey
    );
  }

  // (Re)starts a build from the first slot of the words in memory now;
  // false when they are no longer in memory.
  private startJob(job: BuildJob): boolean {
    const dataKey = this.dataKey(job.rewayah);
    if (
      !dataKey ||
      !this.dk.initialized ||
      !this.dk.isRewayahReady(job.rewayah)
    ) {
      return false;
    }
    // Words in memory without a first slot are refused ('no word slots'),
    // not requested again on every build that ends.
    const slots: Iterable<VerseUnitSlot> =
      readRewayahSlots(this.dk, job.rewayah) ?? [];
    job.dataKey = dataKey;
    job.active = this.dk.rewayah === job.rewayah;
    job.phase = {
      kind: 'slots',
      slots: slots[Symbol.iterator](),
      builder: createVerseUnitsBuilder(job.rewayah, dataKey),
    };
    return true;
  }

  // One slice of a build (sliceSlots slots, or one surah's cross-check);
  // true once every slot is built and every surah cross-checked.
  private advance(job: BuildJob): boolean {
    const phase = job.phase;
    if (phase.kind === 'slots') {
      for (let i = 0; i < this.sliceSlots; i++) {
        const next = phase.slots.next();
        if (next.done) {
          const units = phase.builder.finish();
          job.phase = {
            kind: 'check',
            units,
            check: createVerseUnitsCrossCheck(units, this.verseMap),
            surahs: units.surahs(),
            next: 0,
          };
          return false;
        }
        phase.builder.push(next.value);
      }
      return false;
    }
    if (phase.kind === 'check' && phase.next < phase.surahs.length) {
      phase.check.checkSurah(phase.surahs[phase.next]);
      phase.next += 1;
      return false;
    }
    return phase.kind === 'check';
  }

  private endBuild(job: BuildJob, units: RewayahVerseUnits | null): void {
    if (this.builds.get(job.rewayah) === job) this.builds.delete(job.rewayah);
    job.settle(units);
    this.notify();
  }
}

export const rewayahVerseUnitsService = new RewayahVerseUnitsService();
