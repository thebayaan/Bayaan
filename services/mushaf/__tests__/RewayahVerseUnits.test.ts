// @ai-generated
/**
 * RewayahVerseUnits: a rewayah's own verses as runs of word slots
 * (decision 3), on real slots of complete surahs from the Release 1 words
 * DBs (verseUnitsFixture.json). The expected units in the fixture come from
 * an independent Python walk (gen_verse_units_fixture.py); the verse map
 * cross-check uses the bundled <id>-versemap.json files.
 *
 * The same properties are checked on every slot of every words DB by
 * RewayahVerseUnits.alldbs.test.ts (local, BAYAAN_OVERLAY_DB_DIR).
 */
import {
  buildRewayahVerseUnits,
  crossCheckVerseUnits,
  formatAnchorKey,
  formatUnitRangeLabel,
  hafsKeysOfUnits,
  parseAnchorKey,
  parseUnitKey,
  parseVerseMarker,
  rewayahVerseLabel,
  sharedTranslationNote,
  unitsForStoredVerse,
  VerseUnitsBuildError,
  type RewayahVerseUnits,
  type VerseMapReader,
  type VerseUnit,
  type VerseUnitSlot,
} from '../RewayahVerseUnits';
import {rewayahVerseMapService} from '../RewayahVerseMapService';
import {joinSlotTexts} from '../lineWordSpans';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import {SURAHS} from '@/data/surahData';

type FixtureDb = 'hafs' | 'shouba' | 'warsh' | 'bazzi' | 'doori';
type ExpectedUnit = [number, number, number, number, string[], string, string];

interface VerseUnitsFixture {
  surahs: number[];
  ids: number[];
  locations: string[];
  texts: Record<FixtureDb, string[]>;
  expected: Record<FixtureDb, ExpectedUnit[]>;
  unnumbered: Record<FixtureDb, [number, number][]>;
}

const fixture =
  require('../__fixtures__/verseUnitsFixture.json') as VerseUnitsFixture;

const DBS: FixtureDb[] = ['hafs', 'shouba', 'warsh', 'bazzi', 'doori'];
const REWAYAH: Record<FixtureDb, RewayahId> = {
  hafs: 'hafs',
  shouba: 'shubah',
  warsh: 'warsh',
  bazzi: 'al-bazzi',
  doori: 'al-duri-abi-amr',
};

function slotsOf(
  db: FixtureDb,
  edit?: (slots: VerseUnitSlot[]) => void,
): VerseUnitSlot[] {
  const slots = fixture.ids.map((id, i) => {
    const [surah, ayah, word] = fixture.locations[i].split(':').map(Number);
    return {id, surah, ayah, word, text: fixture.texts[db][i]};
  });
  edit?.(slots);
  return slots;
}

function build(
  db: FixtureDb,
  edit?: (slots: VerseUnitSlot[]) => void,
): RewayahVerseUnits {
  return buildRewayahVerseUnits(REWAYAH[db], slotsOf(db, edit), `${db}@test`);
}

/** Replace the text of the slot at a Hafs location. */
function setText(slots: VerseUnitSlot[], location: string, text: string) {
  const [surah, ayah, word] = location.split(':').map(Number);
  const slot = slots.find(
    s => s.surah === surah && s.ayah === ayah && s.word === word,
  );
  if (!slot) throw new Error(`no slot ${location}`);
  slot.text = text;
}

const units: Record<FixtureDb, RewayahVerseUnits> = {} as never;
beforeAll(() => {
  for (const db of DBS) units[db] = build(db);
});

const keysOf = (list: readonly VerseUnit[]) => list.map(u => u.key);

describe('slot grammar and keys', () => {
  it('parses verse markers only', () => {
    expect(parseVerseMarker('\u06DD\u0661')).toBe(1);
    expect(parseVerseMarker('\u06DD\u0662\u0668\u0666')).toBe(286);
    expect(parseVerseMarker('\u06DD\u06F1\u06F2')).toBe(12);
    expect(parseVerseMarker('\u0661')).toBeNull();
    expect(parseVerseMarker('\u06DD')).toBeNull();
    expect(parseVerseMarker('\u06DD\u0661\u06F2')).toBeNull();
    expect(parseVerseMarker('عَلَيْهِمْ')).toBeNull();
  });

  it('formats labels like the existing Hafs citations', () => {
    expect(rewayahVerseLabel({surah: 2, ayah: 255})).toBe('2:255');
    const a = {surah: 2, ayah: 255};
    expect(formatUnitRangeLabel(a)).toBe('2:255');
    expect(formatUnitRangeLabel(a, {surah: 2, ayah: 257})).toBe('2:255-257');
    expect(
      formatUnitRangeLabel({surah: 2, ayah: 286}, {surah: 3, ayah: 2}),
    ).toBe('2:286 - 3:2');
  });

  it('parses unit keys and stored anchor keys', () => {
    expect(parseUnitKey('1:7')).toEqual({surah: 1, ayah: 7});
    expect(parseUnitKey('1:7:5')).toBeNull();
    expect(parseAnchorKey('1:7')).toEqual({
      surah: 1,
      ayah: 7,
      word: 1,
      hasWord: false,
    });
    expect(parseAnchorKey('1:7:1')).toEqual({
      surah: 1,
      ayah: 7,
      word: 1,
      hasWord: true,
    });
    expect(parseAnchorKey('1:7:5')).toEqual({
      surah: 1,
      ayah: 7,
      word: 5,
      hasWord: true,
    });
    for (const bad of ['', '0:1', '115:1', '1:0', '1:7:0', 'a:b', '1:7:5:1']) {
      expect(parseAnchorKey(bad)).toBeNull();
    }
    expect(formatAnchorKey('1:7', 1)).toBe('1:7');
    expect(formatAnchorKey('1:7', 5)).toBe('1:7:5');
    // A unit holding only part of its Hafs verse names its word, word 1 too.
    expect(formatAnchorKey('1:7', 1, false)).toBe('1:7:1');
    expect(formatAnchorKey('1:7', 5, false)).toBe('1:7:5');
  });
});

describe.each(DBS)('%s: units from real slots', db => {
  it('equal the independently computed units', () => {
    const u = units[db];
    const actual = u.units.map(unit => [
      unit.surah,
      unit.ayah,
      unit.firstWordId,
      unit.lastWordId,
      [...unit.hafsKeys],
      u.hafsAnchor(unit).key,
      u.unitText(unit),
    ]);
    expect(actual).toEqual(fixture.expected[db]);
    expect(u.unnumberedWordRanges().map(r => [r.first, r.last])).toEqual(
      fixture.unnumbered[db],
    );
    u.units.forEach((unit, i) => {
      expect(unit.index).toBe(i);
      expect(unit.rewayah).toBe(REWAYAH[db]);
      expect(unit.key).toBe(`${unit.surah}:${unit.ayah}`);
    });
  });

  it('put every slot in exactly one unit (the P10 basmala in none)', () => {
    const u = units[db];
    for (const id of fixture.ids) {
      const owners = u.units.filter(
        unit => id >= unit.firstWordId && id <= unit.lastWordId,
      );
      const unnumbered = u.isUnnumberedWordId(id);
      expect(owners.length + (unnumbered ? 1 : 0)).toBe(1);
      expect(u.unitForWordId(id)).toBe(owners[0] ?? null);
    }
  });

  it('number every surah 1..N', () => {
    const u = units[db];
    for (const surah of fixture.surahs) {
      const ayahs = u.unitsOfSurah(surah).map(unit => unit.ayah);
      expect(ayahs).toEqual(ayahs.map((_, i) => i + 1));
      expect(u.verseCount(surah)).toBe(ayahs.length);
    }
    expect(u.surahs()).toEqual(fixture.surahs);
  });

  it('agree with the bundled verse map', () => {
    expect(crossCheckVerseUnits(units[db], rewayahVerseMapService)).toEqual([]);
  });

  it('give every unit a distinct storage anchor that resolves back to it', () => {
    const u = units[db];
    const seen = new Set<string>();
    for (const unit of u.units) {
      const anchor = u.hafsAnchor(unit);
      expect(seen.has(anchor.key)).toBe(false);
      seen.add(anchor.key);
      expect(u.unitForAnchor(anchor.key)).toBe(unit);
      // A row at the anchor names exactly this unit.
      expect(u.unitsForStoredKey(anchor.key)).toEqual([unit]);
      // The anchor is the Hafs location of the unit's first slot, bare
      // ("S:A") only when the unit holds Hafs verse S:A alone.
      const loc = fixture.locations[fixture.ids.indexOf(unit.firstWordId)];
      expect(`${anchor.hafsKey}:${anchor.wordPosition}`).toBe(loc);
      const holders = u.unitsForHafsKey(anchor.hafsKey);
      const alone =
        anchor.wordPosition === 1 &&
        holders.length === 1 &&
        holders[0] === unit;
      expect(anchor.key).toBe(alone ? anchor.hafsKey : loc);
      expect(anchor.hafsKey).toBe(unit.hafsKeys[0]);
      expect(`${anchor.surah}:${anchor.ayah}`).toBe(anchor.hafsKey);
    }
    // A mid-verse anchor exactly where a Hafs verse is split.
    const midVerse = u.units.filter(x => u.hafsAnchor(x).wordPosition > 1);
    const split = new Set<string>();
    for (const unit of u.units) {
      for (const k of unit.hafsKeys) {
        if (u.unitsForHafsKey(k).length > 1) split.add(k);
      }
    }
    expect(midVerse.length).toBe(split.size);
    // Every part of a split Hafs verse that starts in it names its word.
    for (const hafsKey of split) {
      const range = u.hafsVerseWordRange(hafsKey)!;
      for (const part of u.unitsForHafsKey(hafsKey)) {
        if (part.firstWordId < range.first) continue; // starts earlier
        expect(u.hafsAnchor(part).key).toBe(
          `${hafsKey}:${part.firstWordId - range.first + 1}`,
        );
      }
    }
  });
});

describe('Hafs and Shu’bah units are the Hafs verses', () => {
  it.each(['hafs', 'shouba'] as FixtureDb[])('%s', db => {
    const u = units[db];
    const slots = slotsOf(db);
    for (const unit of u.units) {
      expect(unit.hafsKeys).toEqual([unit.key]);
      expect(u.hafsAnchor(unit).key).toBe(unit.key);
      expect(u.unitsForStoredKey(unit.key)).toEqual([unit]);
      const verseSlots = slots.filter(s => `${s.surah}:${s.ayah}` === unit.key);
      expect(unit.firstWordId).toBe(verseSlots[0].id);
      expect(unit.lastWordId).toBe(verseSlots[verseSlots.length - 1].id);
      // What getVerseText(key) returns today (blank slots skipped).
      expect(u.unitText(unit)).toBe(joinSlotTexts(verseSlots));
      expect(u.unitsForHafsKey(unit.key)).toEqual([unit]);
      expect(u.translationParts(unit)).toEqual([
        {
          hafsKey: unit.key,
          shared: false,
          sharedWith: [unit.key],
          ownedHere: true,
        },
      ]);
    }
    for (const surah of fixture.surahs) {
      expect(u.verseCount(surah)).toBe(SURAHS[surah - 1].verses_count);
    }
    expect(u.unnumberedWordRanges()).toEqual([]);
  });
});

describe('Warsh al-Fatihah: unnumbered basmala and a split Hafs verse', () => {
  it('leaves the basmala out of every verse', () => {
    const u = units.warsh;
    for (let id = 1; id <= 5; id++) {
      expect(u.unitForWordId(id)).toBeNull();
      expect(u.isUnnumberedWordId(id)).toBe(true);
    }
    expect(u.unitsForHafsKey('1:1')).toEqual([]);
    expect(u.unitForAnchor('1:1')).toBeNull();
    // Navigation from the basmala lands on the first verse.
    expect(u.unitAtOrAfterWordId(1)?.key).toBe('1:1');
    expect(u.unitByRef(1, 1)?.hafsKeys).toEqual(['1:2']);
    expect(u.verseCount(1)).toBe(7);
  });

  it('splits Hafs 1:7 into Warsh 1:6 and 1:7', () => {
    const u = units.warsh;
    const v6 = u.unitByKey('1:6')!;
    const v7 = u.unitByKey('1:7')!;
    expect([
      v6.firstWordId,
      v6.lastWordId,
      v7.firstWordId,
      v7.lastWordId,
    ]).toEqual([27, 30, 31, 36]);
    expect(keysOf(u.unitsForHafsKey('1:7'))).toEqual(['1:6', '1:7']);
    expect(u.unitText(v6).endsWith(' \u06DD\u0666')).toBe(true);
    expect(u.unitText(v7).endsWith(' \u06DD\u0667')).toBe(true);
    expect(u.unitText(v6).startsWith('صِرَٰطَ ')).toBe(true);
    expect(u.unitText(v7).startsWith('غَي۟رِ ')).toBe(true);
    // Storage: two distinct word anchors. A bare "1:7" (a row saved before
    // verse units, when the reader marked all of Hafs 1:7) names both parts
    // and opens at Warsh 1:6.
    expect(u.hafsAnchor(v6).key).toBe('1:7:1');
    expect(u.hafsAnchor(v7).key).toBe('1:7:5');
    expect(u.unitsForStoredKey('1:7')).toEqual([v6, v7]);
    expect(u.unitsForStoredKey('1:7:1')).toEqual([v6]);
    expect(u.unitsForStoredKey('1:7:5')).toEqual([v7]);
    expect(u.unitsForStoredKey('1:7:11')).toEqual([]);
    expect(u.unitsForStoredKey('1:1')).toEqual([]); // the basmala
    expect(u.unitsForStoredKey('bad')).toEqual([]);
    expect(u.unitForAnchor('1:7')).toBe(v6);
    expect(u.unitForAnchor('1:7:1')).toBe(v6);
    expect(u.unitForAnchor('1:7:4')).toBe(v6);
    expect(u.unitForAnchor('1:7:5')).toBe(v7);
    expect(u.unitForAnchor('1:7:10')).toBe(v7);
    expect(u.unitForAnchor('1:7:11')).toBeNull();
    // Translations: Hafs 1:7 once, owned by Warsh 1:6, with a note.
    expect(u.translationParts(v6)).toEqual([
      {
        hafsKey: '1:7',
        shared: true,
        sharedWith: ['1:6', '1:7'],
        ownedHere: true,
      },
    ]);
    expect(u.translationParts(v7)[0].ownedHere).toBe(false);
    expect(sharedTranslationNote(u.translationParts(v7)[0], 'warsh')).toBe(
      'Translation of all of Hafs 1:7, which Warsh divides between verses 1:6 and 1:7.',
    );
  });

  it('numbers al-Fatihah like the Kufi and Makki counts in Hafs and al-Bazzi', () => {
    expect(units.bazzi.unitByKey('1:1')?.hafsKeys).toEqual(['1:1']);
    expect(units.hafs.unitByKey('1:7')?.hafsKeys).toEqual(['1:7']);
    expect(units.doori.unnumberedWordRanges()).toEqual([{first: 1, last: 5}]);
  });
});

describe('merged, split and partly overlapping verses', () => {
  it('Warsh al-‘Asr: 103:1 holds Hafs 103:1-2, Hafs 103:3 is split', () => {
    const u = units.warsh;
    expect(u.unitsOfSurah(103).map(x => [x.key, [...x.hafsKeys]])).toEqual([
      ['103:1', ['103:1', '103:2']],
      ['103:2', ['103:3']],
      ['103:3', ['103:3']],
    ]);
    // A legacy row on the second Hafs verse of a merge opens the merged verse.
    expect(u.unitForAnchor('103:2')?.key).toBe('103:1');
    expect(keysOf(u.unitsForHafsKey('103:2'))).toEqual(['103:1']);
    expect(keysOf(u.unitsForStoredKey('103:2'))).toEqual(['103:1']);
    // The merge starts with whole Hafs 103:1: bare. Hafs 103:3 is split.
    expect(u.unitsOfSurah(103).map(x => [x.key, u.hafsAnchor(x).key])).toEqual([
      ['103:1', '103:1'],
      ['103:2', '103:3:1'],
      ['103:3', '103:3:8'],
    ]);
    expect(keysOf(u.unitsForStoredKey('103:3'))).toEqual(['103:2', '103:3']);
    const merged = u.unitByKey('103:1')!;
    expect(u.translationParts(merged)).toEqual([
      {hafsKey: '103:1', shared: false, sharedWith: ['103:1'], ownedHere: true},
      {hafsKey: '103:2', shared: false, sharedWith: ['103:1'], ownedHere: true},
    ]);
  });

  it('al-Bazzi 71:24 starts inside Hafs 71:23 and ends inside Hafs 71:24', () => {
    const u = units.bazzi;
    const v = u.unitByKey('71:24')!;
    expect(v.hafsKeys).toEqual(['71:23', '71:24']);
    expect(u.hafsAnchor(v).key).toBe('71:23:10');
    // al-Bazzi 71:23 is the first part of split Hafs 71:23.
    expect(u.hafsAnchor(u.unitByKey('71:23')!).key).toBe('71:23:1');
    expect(keysOf(u.unitsForHafsKey('71:23'))).toEqual(['71:23', '71:24']);
    expect(keysOf(u.unitsForHafsKey('71:24'))).toEqual(['71:24', '71:25']);
    expect(
      u.translationParts(v).map(p => [p.hafsKey, p.shared, p.ownedHere]),
    ).toEqual([
      ['71:23', true, false],
      ['71:24', true, true],
    ]);
    // Hafs 71:24 is split again: al-Bazzi 71:25 starts at its 4th word.
    expect(u.hafsAnchor(u.unitByKey('71:25')!).key).toBe('71:24:4');
    expect(hafsKeysOfUnits(u.unitsInRange(u.unitByKey('71:23')!, v))).toEqual([
      '71:23',
      '71:24',
    ]);
  });
});

describe('ranges and navigation', () => {
  it('walks across surahs in reading order', () => {
    const u = units.warsh;
    // Warsh splits Hafs 106:4, so Quraysh has 5 verses there.
    expect(u.verseCount(106)).toBe(5);
    const from = u.unitByKey('106:5')!;
    const to = u.unitByKey('107:2')!;
    expect(keysOf(u.unitsInRange(from, to))).toEqual([
      '106:5',
      '107:1',
      '107:2',
    ]);
    expect(u.unitsInRange(to, from)).toEqual([]);
    expect(u.next(from)?.key).toBe('107:1');
    expect(u.previous(u.unitByKey('107:1')!)?.key).toBe('106:5');
    expect(u.previous(u.units[0])).toBeNull();
    expect(u.next(u.units[u.units.length - 1])).toBeNull();
  });

  it('maps word ranges and Hafs keys to units without repeats', () => {
    const u = units.warsh;
    expect(keysOf(u.unitsForWordRange(1, 12))).toEqual(['1:1', '1:2']);
    expect(keysOf(u.unitsForWordRange(29, 31))).toEqual(['1:6', '1:7']);
    expect(u.unitsForWordRange(31, 29)).toEqual([]);
    expect(keysOf(u.unitsForHafsKeys(['1:7', '1:6', '1:7']))).toEqual([
      '1:5',
      '1:6',
      '1:7',
    ]);
    expect(hafsKeysOfUnits(u.unitsForHafsKey('1:7'))).toEqual(['1:7']);
  });

  it('refuses units of another rewayah or data', () => {
    const v = units.bazzi.unitByKey('1:7')!;
    expect(() => units.warsh.unitText(v)).toThrow(/not a unit/);
    expect(() => units.warsh.hafsAnchor(v)).toThrow(/not a unit/);
    // Equal units of a rebuild of the same data are accepted.
    const again = build('warsh');
    const w = again.unitByKey('1:6')!;
    expect(units.warsh.unitText(w)).toBe(again.unitText(w));
  });
});

describe('stored rows (bookmarks / notes / highlights)', () => {
  it('resolve exactly in their own rewayah', () => {
    expect(
      keysOf(
        unitsForStoredVerse(units.warsh, {
          verseKey: '1:7:5',
          rewayahId: 'warsh',
        }).units,
      ),
    ).toEqual(['1:7']);
    expect(
      unitsForStoredVerse(units.hafs, {verseKey: '2:255', rewayahId: null}),
    ).toEqual({units: [], exact: true}); // surah 2 is not in the fixture
    expect(
      keysOf(
        unitsForStoredVerse(units.hafs, {verseKey: '1:7', rewayahId: null})
          .units,
      ),
    ).toEqual(['1:7']); // legacy rows count as Hafs
  });

  it('read a bare "S:A" row as every verse holding that Hafs verse', () => {
    // Saved before verse units: a Warsh reader marked what the app showed
    // as 1:7, all of Hafs 1:7. It marks both parts in its own rewayah, and
    // in another rewayah given its units (exact) or not.
    const legacy = {verseKey: '1:7', rewayahId: 'warsh' as RewayahId};
    const own = unitsForStoredVerse(units.warsh, legacy);
    expect([keysOf(own.units), own.exact]).toEqual([['1:6', '1:7'], true]);
    expect(
      keysOf(unitsForStoredVerse(units.doori, legacy, units.warsh).units),
    ).toEqual(['1:6', '1:7']);
    expect(keysOf(unitsForStoredVerse(units.doori, legacy).units)).toEqual([
      '1:6',
      '1:7',
    ]);
    // A row written now names its own part only (Hafs: the Hafs verse
    // holding its words).
    const first = {verseKey: '1:7:1', rewayahId: 'warsh' as RewayahId};
    expect(keysOf(unitsForStoredVerse(units.warsh, first).units)).toEqual([
      '1:6',
    ]);
    expect(
      keysOf(unitsForStoredVerse(units.doori, first, units.warsh).units),
    ).toEqual(['1:6']);
    expect(
      keysOf(unitsForStoredVerse(units.hafs, first, units.warsh).units),
    ).toEqual(['1:7']);
    // A bare key on a merged verse still names that one verse.
    expect(
      keysOf(
        unitsForStoredVerse(units.warsh, {
          verseKey: '103:2',
          rewayahId: 'warsh',
        }).units,
      ),
    ).toEqual(['103:1']);
    expect(
      unitsForStoredVerse(units.warsh, {verseKey: '1:1', rewayahId: 'warsh'})
        .units,
    ).toEqual([]); // the unnumbered basmala
  });

  it('map a bare row of another rewayah like the rows of its parts', () => {
    // Every Hafs verse of the fixture: a bare row saved in one rewayah marks,
    // shown in another (exact, units supplied), what the rows of the verses
    // holding that Hafs verse there mark together.
    const pairs: [FixtureDb, FixtureDb][] = [
      ['bazzi', 'warsh'],
      ['warsh', 'doori'],
      ['doori', 'bazzi'],
      ['warsh', 'hafs'],
    ];
    let split = 0;
    for (const [savedDb, displayDb] of pairs) {
      const saved = units[savedDb];
      const display = units[displayDb];
      for (const surah of fixture.surahs) {
        for (let ayah = 1; ; ayah++) {
          const hafsKey = `${surah}:${ayah}`;
          if (!saved.hafsVerseWordRange(hafsKey)) break;
          const parts = saved.unitsForHafsKey(hafsKey);
          if (parts.length > 1) split += 1;
          const union = new Map<number, VerseUnit>();
          for (const part of parts) {
            const partRow = {
              verseKey: saved.hafsAnchor(part).key,
              rewayahId: saved.rewayah,
            };
            for (const x of unitsForStoredVerse(display, partRow, saved)
              .units) {
              union.set(x.index, x);
            }
          }
          const bare = unitsForStoredVerse(
            display,
            {verseKey: hafsKey, rewayahId: saved.rewayah},
            saved,
          );
          expect([hafsKey, keysOf(bare.units)]).toEqual([
            hafsKey,
            keysOf([...union.values()].sort((a, b) => a.index - b.index)),
          ]);
        }
      }
    }
    expect(split).toBeGreaterThan(5);
  });

  it('map a Hafs row to every display verse holding its words', () => {
    const r = unitsForStoredVerse(units.warsh, {
      verseKey: '1:7',
      rewayahId: 'hafs',
    });
    expect([keysOf(r.units), r.exact]).toEqual([['1:6', '1:7'], true]);
    expect(
      unitsForStoredVerse(units.warsh, {verseKey: '1:1', rewayahId: 'hafs'})
        .units,
    ).toEqual([]);
  });

  it('map another rewayah exactly when its units are supplied', () => {
    const row = {verseKey: '103:1', rewayahId: 'warsh' as RewayahId};
    const approx = unitsForStoredVerse(units.hafs, row);
    expect([keysOf(approx.units), approx.exact]).toEqual([['103:1'], false]);
    const exact = unitsForStoredVerse(units.hafs, row, units.warsh);
    expect([keysOf(exact.units), exact.exact]).toEqual([
      ['103:1', '103:2'],
      true,
    ]);
    const second = {verseKey: '1:7:5', rewayahId: 'warsh' as RewayahId};
    expect(keysOf(unitsForStoredVerse(units.hafs, second).units)).toEqual([
      '1:7',
    ]);
    expect(keysOf(unitsForStoredVerse(units.doori, second).units)).toEqual([
      '1:7',
    ]);
    expect(
      keysOf(unitsForStoredVerse(units.doori, second, units.warsh).units),
    ).toEqual(['1:7']);
    expect(
      unitsForStoredVerse(units.hafs, {verseKey: 'x', rewayahId: 'warsh'})
        .units,
    ).toEqual([]);
  });
});

describe('fails closed on data outside the slot model', () => {
  const cases: [string, FixtureDb, (s: VerseUnitSlot[]) => void, RegExp][] = [
    [
      'an inline verse end lost (pre-Release-1 data)',
      'warsh',
      s => setText(s, '1:7:4', 'عَلَي۟هِم۟'),
      /verse number 7, expected 6/,
    ],
    [
      'the Fatiha basmala numbered in a Madani DB',
      'warsh',
      s => setText(s, '1:1:5', '۝١'),
      /verse number 1, expected 2/,
    ],
    [
      'a marker that is not the last token of its slot',
      'warsh',
      s => setText(s, '1:7:4', 'عَلَي۟هِم۟ ۝٦ غَي۟رِ'),
      /not the last token/,
    ],
    [
      'two markers in one slot',
      'hafs',
      s => setText(s, '1:2:4', 'ٱلْعَٰلَمِينَ ۝١ ۝٢'),
      /not the last token/,
    ],
    [
      'a verse number before any word',
      'hafs',
      s => setText(s, '1:3:1', '۝٣'),
      /verse number 3, expected 2|before any word/,
    ],
    [
      'a surah ending inside a verse',
      'hafs',
      s => setText(s, '114:6:4', ''),
      /surah 114 ends inside a verse/,
    ],
    [
      'malformed spacing',
      'hafs',
      s => setText(s, '1:2:1', 'ٱلْحَمْدُ  لِلَّهِ'),
      /malformed spacing/,
    ],
    ['slots out of order', 'hafs', s => s.splice(10, 1), /out of order/],
    [
      'a surah that does not start at its first word',
      'hafs',
      s => s.splice(0, 1),
      /does not start at its first word/,
    ],
  ];
  it.each(cases)('%s', (_name, db, edit, message) => {
    let error: unknown;
    try {
      build(db, edit);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(VerseUnitsBuildError);
    expect((error as Error).message).toMatch(message);
  });

  it('rejects an empty slot list', () => {
    expect(() => buildRewayahVerseUnits('hafs', [], 'x')).toThrow(
      /no word slots/,
    );
  });

  it('reports a verse map that does not belong to the words', () => {
    const real = rewayahVerseMapService;
    const shifted: VerseMapReader = {
      hasVerseMap: r => real.hasVerseMap(r),
      verseCount: (r, s) => (s === 103 ? 2 : real.verseCount(r, s)),
      toHafsKeys: (r, k) => (k === '1:6' ? ['1:6'] : real.toHafsKeys(r, k)),
      toRiwayahKeys: (r, k) => real.toRiwayahKeys(r, k),
    };
    const problems = crossCheckVerseUnits(units.warsh, shifted);
    expect(problems).toEqual([
      'r2h 1:6: [1:7] vs map [1:6]',
      'surah 103: 3 verses, verse map says 2',
    ]);
    const none: VerseMapReader = {...shifted, hasVerseMap: () => false};
    expect(crossCheckVerseUnits(units.warsh, none)).toEqual([
      'warsh: no verse map to check against',
    ]);
  });
});
