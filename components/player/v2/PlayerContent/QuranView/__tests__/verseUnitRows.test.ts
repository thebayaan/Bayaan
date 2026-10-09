// @ai-generated
/**
 * Verse rows of the player list (decision 3): one row per rewayah verse in
 * its own numbering, the unnumbered Fatiha basmala, the list pairing of the
 * Hafs-aligned content, the follow-along band, the storage keys and the
 * verse-actions payload. Real slots of complete surahs (the core's
 * verse-units fixture); every slot of every words DB is checked by
 * verseUnitRows.alldbs.test.ts (BAYAAN_OVERLAY_DB_DIR).
 */
import {
  buildVerseUnitRows,
  isVerseUnitRow,
  playbackBandKeysId,
  playbackBandUnits,
  rowIndexForHafsReference,
  unitVerseActionsPayload,
  UNNUMBERED_BASMALA_ROW_KEY,
  wordByWordNotice,
  type VerseUnitRow,
} from '../verseUnitRows';
import {
  FIXTURE_SURAHS,
  fixtureSlots,
  fixtureUnits,
  mergedOpeningUnits,
  type FixtureDb,
} from '../__fixtures__/verseUnitsFixtures';
import {layoutWords} from '@/services/mushaf/lineWordSpans';
import type {RewayahVerseUnits} from '@/services/mushaf/RewayahVerseUnits';
import type {
  RegisteredTimingNumbering,
  TimingNumbering,
} from '@/utils/timestampNumbering';

const DBS: FixtureDb[] = ['hafs', 'shouba', 'warsh', 'bazzi', 'doori'];
const content = (hafsKey: string) => ({
  translation: `T(${hafsKey})`,
  transliteration: `TL(${hafsKey})`,
});

const rowsOf = (db: FixtureDb, surah: number) =>
  buildVerseUnitRows(fixtureUnits(db), surah, content);

const byKey = (rows: VerseUnitRow[], key: string) => {
  const row = rows.find(r => r.verse_key === key);
  if (!row) throw new Error(`no row ${key}`);
  return row;
};

const partsOf = (row: VerseUnitRow) =>
  row.parts.map(p => [
    p.hafsKey,
    p.owned,
    p.firstWord,
    p.lastWord,
    p.wholeVerse,
  ]);

function numbering(
  mode: 'hafs' | 'riwayah' | 'disabled',
  reciterRewayah: TimingNumbering['reciterRewayah'],
): TimingNumbering {
  return {
    surah: 1,
    mode,
    reciterRewayah,
    reason: 'test',
    hafsKeysForEntry: () => [],
    entryAyahsForHafsAyah: () => [],
    startEntryForHafsAyah: () => null,
    endEntryAyahForHafsAyah: () => null,
    entryRangeForHafsAyah: () => null,
    // Verse-unit answers of fix/r1-v-audio (unused here). @ai
    numbersVersesOf: rewayah =>
      mode === 'riwayah' && reciterRewayah === rewayah,
    startEntryForUnit: () => null,
    endEntryAyahForUnit: () => null,
    entryRangeForUnit: () => null,
    unitKeysForEntry: () => [],
  };
}

const tracking = (
  verseKeys: string[] | undefined,
  reciterVerseKey?: string,
) => ({
  surahNumber: Number(verseKeys?.[0]?.split(':')[0] ?? 1),
  ayahNumber: Number(verseKeys?.[0]?.split(':')[1] ?? 1),
  verseKey: verseKeys?.[0] ?? '1:1',
  timestampFrom: 0,
  timestampTo: 1,
  ...(verseKeys ? {verseKeys} : {}),
  ...(reciterVerseKey ? {reciterVerseKey} : {}),
});

const bandKeys = (
  units: RewayahVerseUnits,
  state: ReturnType<typeof tracking> | null,
  n?: RegisteredTimingNumbering,
) => playbackBandUnits(units, state, n).map(u => u.key);

describe('Warsh al-Fatihah: the unnumbered basmala and a split Hafs verse', () => {
  const rows = rowsOf('warsh', 1);

  it('lists the basmala without a number, then verses 1..7', () => {
    expect(rows.map(r => r.verse_key)).toEqual([
      UNNUMBERED_BASMALA_ROW_KEY,
      '1:1',
      '1:2',
      '1:3',
      '1:4',
      '1:5',
      '1:6',
      '1:7',
    ]);
    expect(rows.map(r => r.label)).toEqual([
      null,
      '1:1',
      '1:2',
      '1:3',
      '1:4',
      '1:5',
      '1:6',
      '1:7',
    ]);
    // The row is VerseItem's `verse`: numbers in Warsh's numbering.
    expect(rows.map(r => r.ayah_number)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    for (const r of rows) {
      expect(r.surah_number).toBe(1);
      expect(r.rewayah).toBe('warsh');
      expect([r.text, r.translation, r.transliteration]).toEqual(['', '', '']);
    }
  });

  it('draws the basmala exactly as the words DB holds it, and owns Hafs 1:1', () => {
    const basmala = rows[0];
    const slots = fixtureSlots('warsh').filter(
      s => s.surah === 1 && s.ayah === 1,
    );
    expect(basmala.unit).toBeNull();
    expect(basmala.anchor).toBeNull();
    expect(layoutWords(basmala.words).text).toBe(
      slots
        .map(s => s.text)
        .filter(Boolean)
        .join(' '),
    );
    expect(basmala.words.map(w => [w.verseKey, w.wordPositionInVerse])).toEqual(
      [
        ['1:1', 1],
        ['1:1', 2],
        ['1:1', 3],
        ['1:1', 4],
      ],
    );
    expect(partsOf(basmala)).toEqual([['1:1', true, 1, 5, true]]);
    expect(basmala.parts[0].note).toBeNull();
    expect(basmala.parts[0].translation).toBe('T(1:1)');
  });

  it('Warsh 1:1 is Hafs 1:2 (a renumbered whole verse)', () => {
    const v1 = byKey(rows, '1:1');
    expect(partsOf(v1)).toEqual([['1:2', true, 1, 5, true]]);
    expect(v1.anchor?.key).toBe('1:2');
  });

  it('splits Hafs 1:7: the translation once under 1:6, the note under both', () => {
    const v6 = byKey(rows, '1:6');
    const v7 = byKey(rows, '1:7');
    const units = fixtureUnits('warsh');
    expect(layoutWords(v6.words).text).toBe(units.unitText(v6.unit!));
    expect(layoutWords(v7.words).text).toBe(units.unitText(v7.unit!));
    expect(layoutWords(v6.words).text.endsWith(' ۝٦')).toBe(true);
    expect(layoutWords(v7.words).text.endsWith(' ۝٧')).toBe(true);
    // Hafs words 1-4 / 5-10 (the marker slot) of Hafs 1:7.
    expect(partsOf(v6)).toEqual([['1:7', true, 1, 4, false]]);
    expect(partsOf(v7)).toEqual([['1:7', false, 5, 10, false]]);
    const note =
      'Translation of all of Hafs 1:7, which Warsh divides between verses 1:6 and 1:7.';
    expect(v6.parts[0].note).toBe(note);
    expect(v7.parts[0].note).toBe(note);
    // Storage: two rows, two word anchors (Hafs 1:7 is split).
    expect([v6.anchor?.key, v7.anchor?.key]).toEqual(['1:7:1', '1:7:5']);
  });
});

describe('merged and partly overlapping verses', () => {
  it('Warsh al-‘Asr: 103:1 holds Hafs 103:1-2, Hafs 103:3 is split', () => {
    const rows = rowsOf('warsh', 103);
    expect(rows.map(r => r.verse_key)).toEqual(['103:1', '103:2', '103:3']);
    const [v1, v2, v3] = rows;
    // Both translations under 103:1, in order, no note.
    expect(partsOf(v1)).toEqual([
      ['103:1', true, 1, 2, true],
      ['103:2', true, 1, 5, true],
    ]);
    expect(v1.parts.map(p => [p.note, p.translation])).toEqual([
      [null, 'T(103:1)'],
      [null, 'T(103:2)'],
    ]);
    expect(v1.anchor?.key).toBe('103:1');
    expect(v2.parts[0]).toMatchObject({hafsKey: '103:3', owned: true});
    expect(v3.parts[0]).toMatchObject({hafsKey: '103:3', owned: false});
    expect(v2.parts[0].note).toContain('verses 103:2 and 103:3');
    expect(v3.parts[0].note).toBe(v2.parts[0].note);
    expect(v3.anchor?.wordPosition).toBeGreaterThan(1);
  });

  it('al-Bazzi 71:24 starts inside Hafs 71:23 and ends inside Hafs 71:24', () => {
    const rows = rowsOf('bazzi', 71);
    const v24 = byKey(rows, '71:24');
    const units = fixtureUnits('bazzi');
    expect(v24.parts.map(p => [p.hafsKey, p.owned, p.wholeVerse])).toEqual([
      ['71:23', false, false],
      ['71:24', true, false],
    ]);
    expect(v24.parts[0].firstWord).toBe(10);
    expect(v24.parts[1]).toMatchObject({firstWord: 1, lastWord: 3});
    expect(v24.parts.every(p => p.note !== null)).toBe(true);
    expect(v24.anchor?.key).toBe('71:23:10');
    expect(units.unitForAnchor('71:23:10')?.key).toBe('71:24');
  });

  it('Kufi and Makki counts number the basmala: no unnumbered row', () => {
    for (const db of ['hafs', 'shouba', 'bazzi'] as FixtureDb[]) {
      const rows = rowsOf(db, 1);
      expect(rows[0].verse_key).toBe('1:1');
      expect(rows[0].unit?.hafsKeys).toEqual(['1:1']);
      expect(rows.some(r => r.unit === null)).toBe(false);
    }
    expect(rowsOf('doori', 1)[0].verse_key).toBe(UNNUMBERED_BASMALA_ROW_KEY);
  });
});

describe.each(DBS)('%s: rows of every fixture surah', db => {
  const units = fixtureUnits(db);

  it.each([...FIXTURE_SURAHS])('surah %i', surah => {
    const rows = buildVerseUnitRows(units, surah, content);
    // One row per verse, in order, plus the unnumbered basmala.
    expect(rows.filter(r => r.unit).map(r => r.unit)).toEqual([
      ...units.unitsOfSurah(surah),
    ]);
    const owners = new Map<string, number>();
    const coverage = new Map<string, number[]>();
    for (const row of rows) {
      // The row draws exactly the verse: its own slots, its own marker.
      if (row.unit) {
        expect(layoutWords(row.words).text).toBe(units.unitText(row.unit));
        expect(row.parts.map(p => p.hafsKey)).toEqual([...row.unit.hafsKeys]);
        expect(row.anchor).toBe(units.hafsAnchor(row.unit));
      }
      for (const p of row.parts) {
        if (p.owned) owners.set(p.hafsKey, (owners.get(p.hafsKey) ?? 0) + 1);
        const held = rows.filter(r =>
          r.parts.some(q => q.hafsKey === p.hafsKey),
        );
        expect(p.note !== null).toBe(held.length > 1);
        expect(p.translation).toBe(`T(${p.hafsKey})`);
        const list = coverage.get(p.hafsKey) ?? [];
        for (let w = p.firstWord; w <= p.lastWord; w++) list.push(w);
        coverage.set(p.hafsKey, list);
      }
    }
    // Every Hafs verse of the surah: its translation under exactly one row,
    // and its words in exactly one row's word-by-word slice.
    for (let ayah = 1; ; ayah++) {
      const range = units.hafsVerseWordRange(`${surah}:${ayah}`);
      if (!range) break;
      const key = `${surah}:${ayah}`;
      expect([key, owners.get(key)]).toEqual([key, 1]);
      const words = coverage.get(key)!;
      expect(new Set(words).size).toBe(words.length);
      expect(Math.max(...words)).toBeLessThanOrEqual(
        range.last - range.first + 1,
      );
    }
  });
});

describe('Hafs and Shu’bah rows are the Hafs verses', () => {
  it.each(['hafs', 'shouba'] as FixtureDb[])('%s', db => {
    for (const surah of FIXTURE_SURAHS) {
      for (const row of rowsOf(db, surah)) {
        expect(row.unit).not.toBeNull();
        expect(row.parts).toHaveLength(1);
        expect(row.parts[0]).toMatchObject({
          hafsKey: row.verse_key,
          owned: true,
          note: null,
          wholeVerse: true,
          firstWord: 1,
        });
        expect(row.anchor?.key).toBe(row.verse_key);
        expect(wordByWordNotice(row, row.parts[0])).toBeUndefined();
      }
    }
  });
});

describe('follow-along band', () => {
  const warsh = fixtureUnits('warsh');

  it('a timing set numbered in the shown rewayah lights exactly its verse', () => {
    const n = numbering('riwayah', 'warsh');
    expect(bandKeys(warsh, tracking(['1:7'], '1:6'), n)).toEqual(['1:6']);
    expect(bandKeys(warsh, tracking(['1:7'], '1:7'), n)).toEqual(['1:7']);
    expect(bandKeys(warsh, tracking(['103:1', '103:2'], '103:1'), n)).toEqual([
      '103:1',
    ]);
    // An entry beyond the rewayah's verses falls back to its Hafs verses.
    expect(bandKeys(warsh, tracking(['1:7'], '1:9'), n)).toEqual([
      '1:6',
      '1:7',
    ]);
  });

  it('a Hafs-numbered entry lights every verse holding what it recites', () => {
    expect(
      bandKeys(warsh, tracking(['1:7'], '1:7'), numbering('hafs', 'warsh')),
    ).toEqual(['1:6', '1:7']);
    expect(bandKeys(warsh, tracking(['103:2'], '103:2'))).toEqual(['103:1']);
    // Another rewayah's numbering, pending or unknown: Hafs verses.
    expect(
      bandKeys(warsh, tracking(['1:7'], '1:6'), numbering('riwayah', 'qalun')),
    ).toEqual(['1:6', '1:7']);
    expect(bandKeys(warsh, tracking(['1:7'], '1:6'), 'pending')).toEqual([
      '1:6',
      '1:7',
    ]);
    // A state written without verseKeys (older writers).
    expect(bandKeys(warsh, tracking(undefined))).toEqual([]);
    expect(
      bandKeys(warsh, {...tracking(undefined), verseKey: '103:2'}),
    ).toEqual(['103:1']);
  });

  it('the unnumbered basmala and nothing recited light nothing', () => {
    expect(bandKeys(warsh, tracking(['1:1'], '1:1'))).toEqual([]);
    expect(bandKeys(warsh, tracking(['1:0'], '1:0'))).toEqual([]);
    expect(bandKeys(warsh, null)).toEqual([]);
  });

  it('Hafs units: the tracked Hafs verses themselves', () => {
    const hafs = fixtureUnits('hafs');
    expect(
      bandKeys(hafs, tracking(['1:7'], '1:7'), numbering('hafs', 'hafs')),
    ).toEqual(['1:7']);
    expect(
      playbackBandKeysId(hafs, tracking(['103:1', '103:2'], '103:1')),
    ).toBe('103:1|103:2');
    expect(playbackBandKeysId(hafs, null, undefined)).toBe('');
  });

  it('a merged opening (synthetic surah 2): both Hafs verses light one row', () => {
    const units = mergedOpeningUnits('warsh');
    expect(units.unitsOfSurah(2).map(u => [u.key, [...u.hafsKeys]])).toEqual([
      ['2:1', ['2:1', '2:2']],
      ['2:2', ['2:3']],
      ['2:3', ['2:4']],
      ['2:4', ['2:5']],
      ['2:5', ['2:6']],
      ['2:6', ['2:7']],
      ['2:7', ['2:8']],
    ]);
    expect(bandKeys(units, tracking(['2:1', '2:2'], '2:1'))).toEqual(['2:1']);
    expect(bandKeys(units, tracking(['2:3'], '2:2'))).toEqual(['2:2']);
  });
});

describe('references and sheet payloads', () => {
  const rows = rowsOf('warsh', 1);
  const units = fixtureUnits('warsh');

  it('lands a Hafs reference on the row holding it', () => {
    expect(rowIndexForHafsReference(rows, units, '1:7')).toBe(6);
    expect(rows[6].verse_key).toBe('1:6');
    // Warsh 1:6's own anchor (the first part of split Hafs 1:7).
    expect(rowIndexForHafsReference(rows, units, '1:7:1')).toBe(6);
    expect(rowIndexForHafsReference(rows, units, '1:7:5')).toBe(7);
    expect(rowIndexForHafsReference(rows, units, '1:2')).toBe(1);
    // The basmala is no verse: no row to land on (the list starts at top).
    expect(rowIndexForHafsReference(rows, units, '1:1')).toBeUndefined();
    expect(rowIndexForHafsReference(rows, units, '2:1')).toBeUndefined();
    expect(rowIndexForHafsReference(rows, units, 'nonsense')).toBeUndefined();
  });

  it('opens the verse actions with the unit and Hafs-meaning fields', () => {
    expect(unitVerseActionsPayload(byKey(rows, '1:7'), 'player')).toEqual({
      verseKey: '1:7',
      surahNumber: 1,
      ayahNumber: 7,
      source: 'player',
      rewayah: 'warsh',
      unitKeys: ['1:7'],
    });
    expect(unitVerseActionsPayload(byKey(rows, '1:1'), 'mushaf')).toEqual({
      verseKey: '1:2',
      surahNumber: 1,
      ayahNumber: 2,
      source: 'mushaf',
      rewayah: 'warsh',
      unitKeys: ['1:1'],
    });
    const merged = byKey(rowsOf('warsh', 103), '103:1');
    expect(unitVerseActionsPayload(merged, 'player')).toEqual({
      verseKey: '103:1',
      surahNumber: 103,
      ayahNumber: 1,
      verseKeys: ['103:1', '103:2'],
      source: 'player',
      rewayah: 'warsh',
      unitKeys: ['103:1'],
    });
    expect(unitVerseActionsPayload(rows[0], 'player')).toBeNull();
  });

  it('names the Hafs verse over a word-by-word grid unless it is the same verse', () => {
    expect(wordByWordNotice(rows[0], rows[0].parts[0])).toBe(
      'Word-by-word shown in Hafs 1:1',
    );
    const v1 = byKey(rows, '1:1');
    expect(wordByWordNotice(v1, v1.parts[0])).toBe(
      'Word-by-word shown in Hafs 1:2',
    );
    const v6 = byKey(rows, '1:6');
    expect(wordByWordNotice(v6, v6.parts[0])).toBe(
      'Word-by-word shown in Hafs 1:7',
    );
    const merged = byKey(rowsOf('warsh', 103), '103:1');
    expect(merged.parts.map(p => wordByWordNotice(merged, p))).toEqual([
      'Word-by-word shown in Hafs 103:1',
      'Word-by-word shown in Hafs 103:2',
    ]);
    const same = byKey(rowsOf('warsh', 112), '112:1');
    expect(wordByWordNotice(same, same.parts[0])).toBeUndefined();
  });

  it('a surah the units do not hold has no rows', () => {
    expect(buildVerseUnitRows(units, 2)).toEqual([]);
  });

  it('rows know their units; Hafs verses are not rows', () => {
    for (const r of rows) {
      expect(r.units).toBe(units);
      expect(isVerseUnitRow(r)).toBe(true);
    }
    expect(
      isVerseUnitRow({
        id: 1,
        verse_key: '1:1',
        surah_number: 1,
        ayah_number: 1,
        text: '',
      }),
    ).toBe(false);
  });

  it('without a content lookup the parts carry no translation', () => {
    const plain = buildVerseUnitRows(units, 1);
    expect(plain[6].parts[0].translation).toBe('');
    expect(plain[6].parts[0].transliteration).toBe('');
  });
});
