// @ai-generated
/**
 * LOCAL-ONLY (skipped unless BAYAAN_OVERLAY_DB_DIR is set; needs Node >= 22.13
 * for node:sqlite):
 *
 *   BAYAAN_OVERLAY_DB_DIR=bundled npx jest RewayahVerseUnitsService.chunked.alldbs --watchAll=false
 *
 * The verse units the app builds off the render path, chunk by chunk, are
 * exactly the units of the one-shot build. The real DigitalKhattDataService
 * loads the real Hafs, Warsh and al-Bazzi words DBs (the words the app
 * reads); the real RewayahVerseUnitsService builds from them with the app's
 * scheduler (after interactions, then setTimeout 0 between chunks) and with
 * chunks forced down to one slice. Each result must equal, field by field,
 * buildRewayahVerseUnits over the DB rows read directly, which the bundled
 * verse map accepts (crossCheckVerseUnits: no difference). Also when the
 * rewayah becomes the mushaf's text in the middle of a build: the build
 * starts over on the main cache and still gives the same units.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-sqlite', () =>
  jest
    .requireActual('@/services/mushaf/__fixtures__/bundledDkSqlite')
    .bundledDkSqliteModule(),
);
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///data/user/0/app.test/files/',
  readDirectoryAsync: async () => [],
  getInfoAsync: async () => ({exists: false}),
}));

import {
  DigitalKhattDataService,
  getRewayahDataIdentityKey,
} from '../DigitalKhattDataService';
import {
  buildRewayahVerseUnits,
  crossCheckVerseUnits,
  type RewayahVerseUnits,
  type VerseUnitSlot,
} from '../RewayahVerseUnits';
import {
  RewayahVerseUnitsService,
  type VerseUnitsBuildScheduler,
} from '../RewayahVerseUnitsService';
import {rewayahVerseMapService} from '../RewayahVerseMapService';
import {bundledDkFile, hasNodeSqlite} from '../__fixtures__/bundledDkSqlite';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

interface SqliteDb {
  prepare(sql: string): {all(): Record<string, unknown>[]};
  close(): void;
}

// Every words DB has the Hafs rows (contract C1): 83,668 slots.
const SLOTS = 83668;
const SLICE = 997;
// One chunk per slice of slots, one per surah cross-checked, one to finish.
const CHUNKS = Math.ceil(SLOTS / SLICE) + 114 + 1;

const CASES: [RewayahId, string, number][] = [
  // rewayah, words DB base, verses
  ['warsh', 'dk_words_warsh', 6214],
  ['al-bazzi', 'dk_words_bazzi', 6220],
];

/** The words DB's slots, read directly (not through the data service). */
function readSlots(base: string): VerseUnitSlot[] {
  const {DatabaseSync} = require('node:sqlite') as {
    DatabaseSync: new (file: string, options?: object) => SqliteDb;
  };
  const db = new DatabaseSync(bundledDkFile(base), {readOnly: true});
  try {
    return db
      .prepare('SELECT id, surah, ayah, word, text FROM words ORDER BY id')
      .all()
      .map(r => ({
        id: Number(r.id),
        surah: Number(r.surah),
        ayah: Number(r.ayah),
        word: Number(r.word),
        text: (r.text as string | null) ?? '',
      }));
  } finally {
    db.close();
  }
}

/** Runs chunks only when the test says so, counting them. */
class SteppedScheduler implements VerseUnitsBuildScheduler {
  readonly tasks: (() => void)[] = [];
  chunks = 0;

  afterInteractions(task: () => void): void {
    this.tasks.push(task);
  }

  nextChunk(task: () => void): void {
    this.tasks.push(task);
  }

  step(): boolean {
    const task = this.tasks.shift();
    if (!task) return false;
    this.chunks += 1;
    task();
    return true;
  }
}

const run =
  process.env.BAYAAN_OVERLAY_DB_DIR && hasNodeSqlite()
    ? describe
    : describe.skip;

run('chunked verse units = one-shot verse units (local only)', () => {
  let spies: jest.SpyInstance[] = [];
  beforeAll(() => {
    spies = [
      jest.spyOn(console, 'log').mockImplementation(() => undefined),
      jest.spyOn(console, 'warn').mockImplementation(() => undefined),
    ];
  });
  afterAll(() => {
    for (const spy of spies) spy.mockRestore();
  });

  for (const [rewayah, base, verses] of CASES) {
    // The tests of one rewayah run in order on one data service: a Hafs
    // mushaf with the rewayah in a side cache (the player, a list row),
    // until the third test makes it the mushaf's text.
    describe(rewayah, () => {
      let oneShot: RewayahVerseUnits;
      let dk: DigitalKhattDataService;
      beforeAll(async () => {
        const dataKey = getRewayahDataIdentityKey(rewayah);
        expect(dataKey).not.toBeNull();
        oneShot = buildRewayahVerseUnits(
          rewayah,
          readSlots(base),
          dataKey ?? '',
        );
        expect(oneShot.units.length).toBe(verses);
        expect(crossCheckVerseUnits(oneShot, rewayahVerseMapService)).toEqual(
          [],
        );
        useMushafSettingsStore.setState({rewayah: 'hafs'});
        dk = new DigitalKhattDataService();
        await dk.initialize();
        await dk.ensureRewayahLoaded(rewayah);
      });

      it('side cache, the app scheduler', async () => {
        expect(dk.rewayah).toBe('hafs');
        const service = new RewayahVerseUnitsService(dk);
        const units = await service.request(rewayah);
        expect(units).toEqual(oneShot);
        expect(service.peek(rewayah)).toBe(units);
      });

      it('side cache, one slice per chunk', async () => {
        const scheduler = new SteppedScheduler();
        const service = new RewayahVerseUnitsService(
          dk,
          rewayahVerseMapService,
          getRewayahDataIdentityKey,
          {scheduler, chunkMs: 0, sliceSlots: SLICE},
        );
        const done = service.request(rewayah);
        while (scheduler.step()) {
          // Nothing half-built is visible between chunks.
          if (scheduler.tasks.length > 0) {
            expect(service.peek(rewayah)).toBeNull();
          }
        }
        expect(scheduler.chunks).toBe(CHUNKS);
        expect(await done).toEqual(oneShot);
      });

      it('the mushaf switches to it mid-build: starts over, same units', async () => {
        const scheduler = new SteppedScheduler();
        const service = new RewayahVerseUnitsService(
          dk,
          rewayahVerseMapService,
          getRewayahDataIdentityKey,
          {scheduler, chunkMs: 0, sliceSlots: SLICE},
        );
        const done = service.request(rewayah);
        for (let i = 0; i < 40; i++) scheduler.step();
        // Half way through its slots, read from the side cache, it becomes
        // the main cache's text (and Hafs a side copy).
        await dk.switchRewayah(rewayah);
        expect(dk.rewayah).toBe(rewayah);
        const before = scheduler.chunks;
        while (scheduler.step());
        // Started over: every slot read again, from the main cache.
        expect(scheduler.chunks - before).toBe(CHUNKS);
        expect(await done).toEqual(oneShot);
      });

      it('main cache (the mushaf shows it), the app scheduler', async () => {
        expect(dk.rewayah).toBe(rewayah);
        const service = new RewayahVerseUnitsService(dk);
        expect(await service.request(rewayah)).toEqual(oneShot);
      });
    });
  }
});
