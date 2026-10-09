// @ai-generated
/**
 * RewayahVerseUnitsService: verse units read from the data service's caches
 * (main cache or side cache), cached per rewayah + data identity (C5), and
 * refused (fail closed) when they cannot be derived or disagree with the
 * bundled verse map. Never built on a caller's stack: peek() and getStatus()
 * build nothing, request() builds after interactions in chunks (the result
 * is the one-shot build's however it is chunked; a build that sees its words
 * change starts over), and the end of a build notifies subscribers.
 * Real words DBs: RewayahVerseUnitsService.chunked.alldbs.
 */
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {},
  getRewayahDataIdentityKey: (rewayah: string) => `${rewayah}@test`,
}));

import type {
  DKWordInfo,
  RewayahLoadState,
} from '@/services/mushaf/DigitalKhattDataService';
import {
  buildRewayahVerseUnits,
  type VerseMapReader,
  type VerseUnitSlot,
} from '../RewayahVerseUnits';
import {
  readRewayahSlots,
  RewayahVerseUnitsService,
  type VerseUnitsBuildScheduler,
  type VerseUnitsDataReader,
} from '../RewayahVerseUnitsService';
import {rewayahVerseMapService} from '../RewayahVerseMapService';
import {SURAHS} from '@/data/surahData';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

type FixtureDb = 'hafs' | 'warsh';
const fixture = require('../__fixtures__/verseUnitsFixture.json') as {
  locations: string[];
  texts: Record<FixtureDb, string[]>;
};

/** Slots with ids renumbered 1..n (the data service's ids are contiguous). */
function contiguousSlots(
  locations: string[],
  texts: string[],
): VerseUnitSlot[] {
  return locations.map((location, i) => {
    const [surah, ayah, word] = location.split(':').map(Number);
    return {id: i + 1, surah, ayah, word, text: texts[i]};
  });
}

const ARABIC_DIGITS =
  '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669';
const marker = (n: number) =>
  '\u06DD' + [...String(n)].map(d => ARABIC_DIGITS[Number(d)]).join('');

/**
 * A synthetic words DB shaped like Hafs (every surah, every Hafs verse: two
 * placeholder words and its marker slot). Not Quran text.
 */
function syntheticHafsSlots(): VerseUnitSlot[] {
  const slots: VerseUnitSlot[] = [];
  for (const surah of SURAHS) {
    for (let ayah = 1; ayah <= surah.verses_count; ayah++) {
      const texts = ['w', 'w', marker(ayah)];
      texts.forEach((text, i) =>
        slots.push({
          id: slots.length + 1,
          surah: surah.id,
          ayah,
          word: i + 1,
          text,
        }),
      );
    }
  }
  return slots;
}

/** Fake data service: one main cache plus side caches, like the real one. */
class FakeDataReader implements VerseUnitsDataReader {
  rewayah: RewayahId = 'hafs';
  initialized = true;
  readonly states = new Map<RewayahId, RewayahLoadState>();
  private readonly verses = new Map<RewayahId, Map<string, DKWordInfo[]>>();
  private infos: DKWordInfo[] = [];
  private texts: string[] = [];

  /** Make `rewayah` the main cache (its slots give the ids / locations). */
  setMain(rewayah: RewayahId, slots: VerseUnitSlot[]): void {
    this.rewayah = rewayah;
    this.infos = [];
    this.texts = [];
    for (const s of slots) {
      this.infos[s.id] = {
        text: s.text,
        verseKey: `${s.surah}:${s.ayah}`,
        wordPositionInVerse: s.word,
      };
      this.texts[s.id] = s.text;
    }
    this.setSide(rewayah, slots);
  }

  /** Put `rewayah` in a side cache (verse lists with blank slots). */
  setSide(rewayah: RewayahId, slots: VerseUnitSlot[]): void {
    const byVerse = new Map<string, DKWordInfo[]>();
    for (const s of slots) {
      const key = `${s.surah}:${s.ayah}`;
      const info = {text: s.text, verseKey: key, wordPositionInVerse: s.word};
      const list = byVerse.get(key);
      if (list) list.push(info);
      else byVerse.set(key, [info]);
    }
    this.verses.set(rewayah, byVerse);
    this.states.set(rewayah, 'ready');
  }

  isRewayahReady(rewayah: RewayahId): boolean {
    return this.states.get(rewayah) === 'ready';
  }
  getRewayahLoadState(rewayah: RewayahId): RewayahLoadState {
    return this.states.get(rewayah) ?? 'idle';
  }
  getWordInfo(wordId: number): DKWordInfo | undefined {
    return this.infos[wordId];
  }
  getWordText(wordId: number): string {
    return this.texts[wordId] ?? '';
  }
  getVerseWords(verseKey: string, rewayah?: RewayahId): DKWordInfo[] {
    // Like the real service: blank slots are omitted.
    const list = this.verses.get(rewayah ?? this.rewayah)?.get(verseKey) ?? [];
    return list.filter(w => w.text !== '');
  }
}

/** The adapter reuses one slot object: copy each slot while iterating. */
function copySlots(dk: VerseUnitsDataReader, rewayah: RewayahId) {
  return Array.from(readRewayahSlots(dk, rewayah)!, s => ({...s}));
}

describe('readRewayahSlots', () => {
  const hafs = contiguousSlots(fixture.locations, fixture.texts.hafs);
  const warsh = contiguousSlots(fixture.locations, fixture.texts.warsh);

  it('reads the main cache slot by slot', () => {
    const dk = new FakeDataReader();
    dk.setMain('warsh', warsh);
    expect(copySlots(dk, 'warsh')).toEqual(warsh);
  });

  it('rebuilds a side-cache rewayah with its blank slots', () => {
    const dk = new FakeDataReader();
    dk.setMain('hafs', hafs);
    dk.setSide('warsh', warsh);
    const read = copySlots(dk, 'warsh');
    expect(read).toEqual(warsh);
    expect(read.filter(s => s.text === '').length).toBeGreaterThan(0);
    const fromSide = buildRewayahVerseUnits('warsh', read, 'k');
    const direct = buildRewayahVerseUnits('warsh', warsh, 'k');
    expect(fromSide.units).toEqual(direct.units);
  });

  it('is null while the words are not in memory', () => {
    const dk = new FakeDataReader();
    dk.setMain('hafs', hafs);
    expect(readRewayahSlots(dk, 'warsh')).toBeNull();
    dk.initialized = false;
    expect(readRewayahSlots(dk, 'hafs')).toBeNull();
  });
});

/**
 * Runs a build's chunks when the test says so. The app's scheduler runs the
 * first chunk after interactions and each next one after a setTimeout(0).
 */
class ManualScheduler implements VerseUnitsBuildScheduler {
  readonly tasks: (() => void)[] = [];

  afterInteractions(task: () => void): void {
    this.tasks.push(task);
  }

  nextChunk(task: () => void): void {
    this.tasks.push(task);
  }

  /** Runs the next scheduled chunk; false when none is scheduled. */
  step(): boolean {
    const task = this.tasks.shift();
    if (!task) return false;
    task();
    return true;
  }

  /** Runs chunks until no build has work left; how many ran. */
  runAll(): number {
    let chunks = 0;
    while (this.step()) chunks += 1;
    return chunks;
  }
}

describe('RewayahVerseUnitsService', () => {
  let errorSpy: jest.SpyInstance;
  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => errorSpy.mockRestore());

  const synthetic = syntheticHafsSlots();

  function setup(
    options: {chunkMs?: number; sliceSlots?: number; map?: VerseMapReader} = {},
  ) {
    const dk = new FakeDataReader();
    dk.setMain('hafs', synthetic);
    let version = 1;
    const scheduler = new ManualScheduler();
    const service = new RewayahVerseUnitsService(
      dk,
      options.map ?? rewayahVerseMapService,
      rewayah =>
        rewayah === 'hisham' || rewayah === 'ishaq'
          ? null
          : `${rewayah}@v${version}`,
      {scheduler, chunkMs: options.chunkMs, sliceSlots: options.sliceSlots},
    );
    /** request() and every chunk it schedules. */
    const build = (rewayah: RewayahId) => {
      const done = service.request(rewayah);
      scheduler.runAll();
      return done;
    };
    return {dk, service, scheduler, build, bump: () => (version += 1)};
  }

  it('reads never build: request() builds after interactions', async () => {
    const {service, scheduler} = setup();
    expect(service.peek('hafs')).toBeNull();
    expect(service.getStatus('hafs')).toBe('idle');
    expect(scheduler.tasks).toHaveLength(0);

    const done = service.request('hafs');
    // Nothing is built on the caller's stack.
    expect(service.peek('hafs')).toBeNull();
    expect(service.getStatus('hafs')).toBe('loading');
    expect(scheduler.tasks).toHaveLength(1);
    // Another request joins the build.
    expect(service.request('hafs')).toBe(done);

    scheduler.runAll();
    const units = await done;
    expect(units?.units.length).toBe(6236);
    expect(service.peek('hafs')).toBe(units);
    expect(service.getStatus('hafs')).toBe('ready');
  });

  it('derives and caches the units of a loaded rewayah', async () => {
    const {service, scheduler, build, bump} = setup();
    const units = await build('hafs');
    expect(units?.units.length).toBe(6236);
    expect(units?.dataKey).toBe('hafs@v1');
    expect(service.getStatus('hafs')).toBe('ready');
    expect(service.getError('hafs')).toBeNull();
    expect(service.peek('hafs')).toBe(units);
    // Built once: a request resolves with them and schedules nothing.
    await expect(service.request('hafs')).resolves.toBe(units);
    expect(scheduler.tasks).toHaveLength(0);
    // A new data identity (another words DB) means new units, built anew.
    bump();
    expect(service.peek('hafs')).toBeNull();
    expect(service.getStatus('hafs')).toBe('idle');
    const rebuilt = await build('hafs');
    expect(rebuilt).not.toBe(units);
    expect(rebuilt?.dataKey).toBe('hafs@v2');
  });

  it('tells subscribers when a build ends', async () => {
    const {dk, service, build} = setup();
    const listener = jest.fn();
    const unsubscribe = service.subscribe(listener);
    const before = service.getVersion();
    await build('hafs');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(service.getVersion()).not.toBe(before);
    unsubscribe();
    dk.setSide('shubah', synthetic);
    expect((await build('shubah'))?.units.length).toBe(6236);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('yields between chunks; the units are exactly the one-shot build', async () => {
    // A budget of 0 ms: every slice (97 slots, or one surah's cross-check)
    // ends its chunk.
    const {service, scheduler} = setup({chunkMs: 0, sliceSlots: 97});
    const done = service.request('hafs');
    let chunks = 0;
    while (scheduler.step()) {
      chunks += 1;
      if (scheduler.tasks.length > 0) {
        // Between two chunks: nothing half-built is visible.
        expect(service.peek('hafs')).toBeNull();
        expect(service.getStatus('hafs')).toBe('loading');
      }
    }
    // One chunk per 97 slots, one per surah checked.
    expect(chunks).toBeGreaterThan(synthetic.length / 97 + 114);
    const units = await done;
    expect(units).toEqual(buildRewayahVerseUnits('hafs', synthetic, 'hafs@v1'));
  });

  it('follows the data service while the words are not in memory', async () => {
    const {dk, service, scheduler} = setup();
    for (const state of ['idle', 'loading', 'error'] as RewayahLoadState[]) {
      dk.states.set('warsh', state);
      expect(service.peek('warsh')).toBeNull();
      expect(service.getStatus('warsh')).toBe(state);
      // Nothing to build from: nothing is scheduled.
      await expect(service.request('warsh')).resolves.toBeNull();
      expect(scheduler.tasks).toHaveLength(0);
    }
    dk.states.set('hisham', 'unavailable');
    expect(service.peek('hisham')).toBeNull();
    expect(service.getStatus('hisham')).toBe('unavailable');
    // Words in memory but no data identity (a broken build): never ready.
    dk.setSide('ishaq', synthetic);
    expect(service.peek('ishaq')).toBeNull();
    expect(service.getStatus('ishaq')).toBe('error');
    await expect(service.request('ishaq')).resolves.toBeNull();
    expect(scheduler.tasks).toHaveLength(0);
  });

  it('drops the units when the data service drops the words', async () => {
    const {dk, service, build} = setup();
    const units = await build('hafs');
    dk.states.set('hafs', 'idle');
    expect(service.peek('hafs')).toBeNull();
    expect(service.getStatus('hafs')).toBe('idle');
    dk.states.set('hafs', 'ready');
    // Built again from the words now in memory.
    expect(service.peek('hafs')).toBeNull();
    expect(await build('hafs')).not.toBe(units);
  });

  it('refuses units that disagree with the verse map, once', async () => {
    const {dk, service, scheduler, build} = setup();
    // Hafs-numbered slots under the Warsh name: the Warsh map disagrees.
    dk.setSide('warsh', synthetic);
    await expect(build('warsh')).resolves.toBeNull();
    expect(service.peek('warsh')).toBeNull();
    expect(service.getStatus('warsh')).toBe('error');
    expect(String(service.getError('warsh'))).toMatch(
      /warsh words DB and verse map disagree: r2h 1:1: \[1:1\] vs map \[1:2\]/,
    );
    expect(errorSpy).toHaveBeenCalledTimes(1);
    // Refused units are not built again on every request.
    await expect(service.request('warsh')).resolves.toBeNull();
    expect(scheduler.tasks).toHaveLength(0);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('refuses data outside the slot model and incomplete data', async () => {
    const {dk, service, build} = setup();
    const broken = synthetic.map(s =>
      s.surah === 2 && s.ayah === 5 && s.word === 3 ? {...s, text: ''} : s,
    );
    dk.setSide('shubah', broken);
    await expect(build('shubah')).resolves.toBeNull();
    expect(String(service.getError('shubah'))).toMatch(
      /verse number 6, expected 5/,
    );
    const partial = synthetic.filter(s => s.surah === 1);
    dk.setSide('al-bazzi', partial);
    await build('al-bazzi');
    expect(service.getStatus('al-bazzi')).toBe('error');
    dk.setMain('hafs', partial);
    service.clearCache();
    await build('hafs');
    expect(String(service.getError('hafs'))).toMatch(/1 of 114 surahs/);
  });

  it('retry() builds refused units again', async () => {
    // A verse map missing at the first build, there at the second.
    let mapReady = false;
    const map: VerseMapReader = {
      hasVerseMap: r => mapReady && rewayahVerseMapService.hasVerseMap(r),
      verseCount: (r, s) => rewayahVerseMapService.verseCount(r, s),
      toHafsKeys: (r, k) => rewayahVerseMapService.toHafsKeys(r, k),
      toRiwayahKeys: (r, k) => rewayahVerseMapService.toRiwayahKeys(r, k),
    };
    const {service, scheduler, build} = setup({map});
    await expect(build('hafs')).resolves.toBeNull();
    expect(service.getStatus('hafs')).toBe('error');
    expect(String(service.getError('hafs'))).toMatch(/no verse map/);

    mapReady = true;
    const listener = jest.fn();
    service.subscribe(listener);
    const done = service.retry('hafs');
    // At once: no longer an error, and subscribers hear of it.
    expect(service.getStatus('hafs')).toBe('loading');
    expect(listener).toHaveBeenCalledTimes(1);
    scheduler.runAll();
    const units = await done;
    expect(units?.units.length).toBe(6236);
    expect(service.getStatus('hafs')).toBe('ready');
    // Units that were accepted are not built again.
    await expect(service.retry('hafs')).resolves.toBe(units);
    expect(scheduler.tasks).toHaveLength(0);
  });

  it('a build never reads across a switch: it starts over on the new cache', async () => {
    // Shu'bah has the Hafs verses (identity verse map); its slots here hold
    // other placeholder words than the Hafs ones.
    const shubah = synthetic.map(s =>
      s.text.startsWith('۝') ? s : {...s, text: 's'},
    );
    const {dk, service, scheduler} = setup({chunkMs: 0, sliceSlots: 97});
    dk.setMain('shubah', shubah);
    const done = service.request('shubah');
    for (let i = 0; i < 50; i++) scheduler.step();
    // The mushaf switches back to Hafs mid-build: Shu'bah moves to a side
    // cache, and the main cache's word texts are Hafs words now.
    dk.setMain('hafs', synthetic);
    dk.setSide('shubah', shubah);
    scheduler.runAll();
    const units = await done;
    expect(units).toEqual(
      buildRewayahVerseUnits('shubah', shubah, 'shubah@v1'),
    );
    expect(units?.unitText(units.units[0])).toBe('s s ۝١');
  });

  it('words evicted mid-build: no units, nothing refused', async () => {
    const {dk, service, scheduler, build} = setup({chunkMs: 0});
    dk.setSide('shubah', synthetic);
    const done = service.request('shubah');
    scheduler.step();
    scheduler.step();
    dk.states.set('shubah', 'idle');
    scheduler.runAll();
    await expect(done).resolves.toBeNull();
    expect(service.getStatus('shubah')).toBe('idle');
    expect(service.getError('shubah')).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
    // Back in memory: built on request.
    dk.states.set('shubah', 'ready');
    expect((await build('shubah'))?.units.length).toBe(6236);
  });

  it('a side copy waits for the main cache, and fails with it', async () => {
    const {dk, service, scheduler, build} = setup();
    // Startup has not loaded the main cache (word ids, Hafs locations) yet;
    // a Shu'bah side copy is in memory.
    dk.setSide('shubah', synthetic);
    dk.initialized = false;
    dk.states.set('hafs', 'loading');
    expect(service.getStatus('shubah')).toBe('loading');
    await expect(service.request('shubah')).resolves.toBeNull();
    expect(scheduler.tasks).toHaveLength(0);
    // Startup failed: an error to retry, never an endless 'loading'.
    dk.states.set('hafs', 'error');
    expect(service.getStatus('shubah')).toBe('error');
    expect(service.peek('shubah')).toBeNull();
    // Loaded at last (a retry): built on request.
    dk.initialized = true;
    dk.states.set('hafs', 'ready');
    expect(service.getStatus('shubah')).toBe('idle');
    expect((await build('shubah'))?.units.length).toBe(6236);
  });

  it('words in memory with no slot to read: refused, not built again and again', async () => {
    const {dk, service, scheduler} = setup();
    // A main cache without word 1 (a row whose location could not be read).
    dk.setMain('hafs', synthetic.slice(1));
    // Consumers ask again whenever a build ends without units (the hook's
    // effect, the pages' getShownVerseUnits).
    service.subscribe(() => {
      if (service.getStatus('hafs') === 'idle') service.request('hafs');
    });
    const done = service.request('hafs');
    for (let i = 0; i < 20 && scheduler.step(); i++);
    expect(scheduler.tasks).toHaveLength(0);
    await expect(done).resolves.toBeNull();
    expect(service.getStatus('hafs')).toBe('error');
    expect(String(service.getError('hafs'))).toMatch(/no word slots/);
  });

  it('clearCache() drops builds in progress', async () => {
    const {service, scheduler} = setup();
    const done = service.request('hafs');
    service.clearCache();
    await expect(done).resolves.toBeNull();
    scheduler.runAll();
    expect(service.peek('hafs')).toBeNull();
    expect(service.getStatus('hafs')).toBe('idle');
  });
});
