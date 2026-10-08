// @ai-generated
/**
 * LOCAL-ONLY full-data check of the audio side of the verse units (skipped
 * unless BAYAAN_OVERLAY_DB_DIR is set; needs Node >= 22.5 for node:sqlite):
 *
 *   BAYAAN_OVERLAY_DB_DIR=/path/to/dbs npx jest timestampNumbering.units.alldbs --watchAll=false
 *
 * The directory holds the Release 1 words DBs (dk_words_<id>.db) and their
 * verse maps (<id>-versemap.json); see services/timestamps/__fixtures__/
 * allDbVerseUnits.ts. For every words DB, every surah and every verse, with
 * synthetic timing sets numbered by every rewayah (entries 1..N):
 *  - a set numbered by the shown rewayah: entry N is exactly unit N (band,
 *    start, range end and repeat span), contract 4.2;
 *  - every other set (Hafs-numbered, or numbered by any other rewayah): the
 *    band of an entry is units.unitsForHafsKeys(hafsKeysForEntry(entry)),
 *    a unit starts at startEntryForHafsAyah(hafsAnchor(unit).ayah) and ends
 *    at endEntryAyahForHafsAyah(its last Hafs ayah), contract 4.2;
 *  - Hafs shown: the Hafs answers themselves;
 *  - the audio target of a unit starts at its storage anchor's Hafs verse;
 *  - the verse maps the app ships equal those of the data directory (the
 *    timing numbering reads the shipped ones).
 */

import type {AyahTimestamp} from '@/types/timestamps';
import type {
  RewayahVerseUnits,
  VerseUnit,
} from '@/services/mushaf/RewayahVerseUnits';
import {
  VERSE_MAP_FILE_IDS,
  hafsVerseCount,
  type RewayahVerseMapService,
} from '@/services/mushaf/RewayahVerseMapService';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import {
  allDbDir,
  allDbVerseMaps,
  loadAllDbUnits,
  readBundledVerseMapJson,
  readVerseMapJson,
} from '@/services/timestamps/__fixtures__/allDbVerseUnits';
import {
  createTimingNumbering,
  formatUnitKeysLabel,
  toAudioUnitTarget,
  type TimingNumbering,
  type TimingNumberingMode,
} from '../timestampNumbering';

const DB_DIR = allDbDir();
const run = DB_DIR ? describe : describe.skip;

function entries(surah: number, count: number): AyahTimestamp[] {
  return Array.from({length: count}, (_, i) => ({
    surahNumber: surah,
    ayahNumber: i + 1,
    timestampFrom: i * 1000,
    timestampTo: (i + 1) * 1000,
    durationMs: 1000,
  }));
}

const keysOf = (units: readonly VerseUnit[]) => units.map(u => u.key);
const ayahOf = (key: string) => Number(key.split(':')[1]);

run('verse units and timing entries on every words DB (local only)', () => {
  let all: Map<RewayahId, RewayahVerseUnits>;
  let verseMap: RewayahVerseMapService;
  beforeAll(() => {
    all = loadAllDbUnits(DB_DIR!);
    verseMap = allDbVerseMaps(DB_DIR!);
  });

  /** Failures are collected so one report lists them (at most 20). */
  function checker() {
    const failures: string[] = [];
    let count = 0;
    return {
      fail(msg: string) {
        count += 1;
        if (failures.length < 20) failures.push(msg);
      },
      done() {
        expect({count, failures}).toEqual({count: 0, failures: []});
      },
    };
  }

  function numbering(
    mode: TimingNumberingMode,
    reciter: RewayahId,
    surah: number,
    count: number,
  ): TimingNumbering {
    return createTimingNumbering({
      surah,
      mode,
      reciterRewayah: reciter,
      reason: 'alldbs',
      entries: entries(surah, count),
      verseMap,
    });
  }

  it('finds the eight words DBs', () => {
    expect([...all.keys()].sort()).toEqual(
      [
        'al-bazzi',
        'al-duri-abi-amr',
        'al-susi',
        'hafs',
        'qalun',
        'qunbul',
        'shubah',
        'warsh',
      ].sort(),
    );
  });

  it('ships the verse maps of the data directory', () => {
    for (const fileId of Object.values(VERSE_MAP_FILE_IDS)) {
      expect(readBundledVerseMapJson(fileId)).toEqual(
        readVerseMapJson(DB_DIR!, fileId),
      );
    }
  });

  it("audio targets start at the unit's storage anchor", () => {
    const c = checker();
    for (const units of all.values()) {
      for (const u of units.units) {
        const t = toAudioUnitTarget(u);
        const anchor = units.hafsAnchor(u);
        if (anchor.surah !== t.surah || anchor.ayah !== t.hafsFirstAyah) {
          c.fail(
            `${u.rewayah} ${u.key}: target ${t.hafsFirstAyah}, anchor ${anchor.key}`,
          );
        }
        const last = u.hafsKeys[u.hafsKeys.length - 1];
        if (ayahOf(last) !== t.hafsLastAyah)
          c.fail(`${u.rewayah} ${u.key}: last`);
      }
    }
    c.done();
  });

  it('a set numbered by the shown rewayah: one entry is exactly one unit', () => {
    const c = checker();
    for (const [rewayah, units] of all) {
      if (rewayah === 'hafs') continue;
      for (const surah of units.surahs()) {
        const list = units.unitsOfSurah(surah);
        const n = numbering('riwayah', rewayah, surah, list.length);
        for (const u of list) {
          const t = toAudioUnitTarget(u);
          const band = n.unitKeysForEntry(u.ayah, rewayah);
          if (
            band.length !== 1 ||
            band[0] !== units.unitByRef(surah, u.ayah)!.key
          ) {
            c.fail(`${rewayah} ${u.key}: band [${band}]`);
          }
          if (formatUnitKeysLabel(band) !== u.key)
            c.fail(`${rewayah} ${u.key}: label`);
          if (n.startEntryForUnit(t)?.ayahNumber !== u.ayah) {
            c.fail(`${rewayah} ${u.key}: start`);
          }
          if (n.endEntryAyahForUnit(t) !== u.ayah)
            c.fail(`${rewayah} ${u.key}: end`);
          const span = n.entryRangeForUnit(t);
          if (span?.start !== u.ayah || span.end !== u.ayah) {
            c.fail(`${rewayah} ${u.key}: repeat span`);
          }
          // the Hafs keys of the entry (page turns) are the unit's Hafs verses
          if (n.hafsKeysForEntry(u.ayah).join() !== u.hafsKeys.join()) {
            c.fail(`${rewayah} ${u.key}: Hafs keys`);
          }
        }
      }
    }
    c.done();
  });

  /** Contract 4.2 for a set that does not number `units`' rewayah. */
  function checkMappedSet(
    c: ReturnType<typeof checker>,
    units: RewayahVerseUnits,
    n: TimingNumbering,
    count: number,
    label: string,
  ) {
    const surah = n.surah;
    // Entries reciting each Hafs verse.
    const entriesOf = new Map<string, number[]>();
    for (let e = 1; e <= count; e++) {
      for (const k of n.hafsKeysForEntry(e)) {
        entriesOf.set(k, [...(entriesOf.get(k) ?? []), e]);
      }
    }
    for (let e = 1; e <= count; e++) {
      const expected = keysOf(units.unitsForHafsKeys(n.hafsKeysForEntry(e)));
      const band = n.unitKeysForEntry(e, units.rewayah);
      if (band.join() !== expected.join()) {
        c.fail(`${label} entry ${surah}:${e}: band [${band}] vs [${expected}]`);
      }
    }
    for (const u of units.unitsOfSurah(surah)) {
      const t = toAudioUnitTarget(u);
      const start = n.startEntryForHafsAyah(units.hafsAnchor(u).ayah);
      const end = n.endEntryAyahForHafsAyah(
        ayahOf(u.hafsKeys[u.hafsKeys.length - 1]),
      );
      if (n.startEntryForUnit(t) !== start) c.fail(`${label} ${u.key}: start`);
      if (n.endEntryAyahForUnit(t) !== end) c.fail(`${label} ${u.key}: end`);
      const span = n.entryRangeForUnit(t);
      // the span plays every entry holding the unit's words, none before
      const holding = new Set(u.hafsKeys.flatMap(k => entriesOf.get(k) ?? []));
      const lo = Math.min(...holding);
      const hi = Math.max(...holding);
      if (holding.size > 0 && (span?.start !== lo || span.end !== hi)) {
        c.fail(
          `${label} ${u.key}: repeat span ${JSON.stringify(span)} vs ${lo}-${hi}`,
        );
      }
    }
  }

  it('a Hafs-numbered set: every unit holding a word of the recited Hafs verse', () => {
    const c = checker();
    for (const [rewayah, units] of all) {
      for (const surah of units.surahs()) {
        const count = hafsVerseCount(surah);
        const n = numbering('hafs', rewayah, surah, count);
        checkMappedSet(c, units, n, count, `${rewayah} (Hafs-numbered)`);
      }
    }
    // the Fatiha basmala of the Madani / Basri counts lights nothing
    for (const rewayah of [
      'warsh',
      'qalun',
      'al-duri-abi-amr',
      'al-susi',
    ] as const) {
      const n = numbering('hafs', rewayah, 1, 7);
      if (n.unitKeysForEntry(1, rewayah).length !== 0)
        c.fail(`${rewayah} basmala`);
    }
    c.done();
  });

  it('a set numbered by another rewayah: the same safe mapping', () => {
    const c = checker();
    const rewayat = [...all.keys()].filter(r => r !== 'hafs' && r !== 'shubah');
    for (const reciter of rewayat) {
      for (const [shown, units] of all) {
        if (shown === reciter || shown === 'hafs') continue;
        for (const surah of units.surahs()) {
          const count = verseMap.verseCount(reciter, surah)!;
          const n = numbering('riwayah', reciter, surah, count);
          checkMappedSet(c, units, n, count, `${reciter} shown in ${shown}`);
        }
      }
    }
    c.done();
  });

  it('Hafs shown: the Hafs answers themselves', () => {
    const c = checker();
    const hafs = all.get('hafs')!;
    for (const reciter of all.keys()) {
      for (const surah of hafs.surahs()) {
        const modes: [TimingNumberingMode, number][] = [
          ['hafs', hafsVerseCount(surah)],
        ];
        if (reciter !== 'hafs' && reciter !== 'shubah') {
          modes.push(['riwayah', verseMap.verseCount(reciter, surah)!]);
        }
        for (const [mode, count] of modes) {
          const n = numbering(mode, reciter, surah, count);
          for (let e = 1; e <= count; e++) {
            if (
              n.unitKeysForEntry(e, 'hafs').join() !==
              n.hafsKeysForEntry(e).join()
            ) {
              c.fail(`${reciter} ${mode} ${surah}:${e}: Hafs band`);
            }
          }
          for (const u of hafs.unitsOfSurah(surah)) {
            const t = toAudioUnitTarget(u);
            if (
              n.startEntryForUnit(t) !== n.startEntryForHafsAyah(u.ayah) ||
              n.endEntryAyahForUnit(t) !== n.endEntryAyahForHafsAyah(u.ayah) ||
              JSON.stringify(n.entryRangeForUnit(t)) !==
                JSON.stringify(n.entryRangeForHafsAyah(u.ayah))
            ) {
              c.fail(`${reciter} ${mode} ${u.key}: Hafs unit`);
            }
          }
        }
      }
    }
    c.done();
  });
});
