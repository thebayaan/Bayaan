// @ai-generated
/**
 * Rows of the mushaf's list and reading modes for a non-Hafs text
 * (mushafVerseUnitRows.ts, decision 3): one row per verse of the rewayah in
 * its own numbering, found from the slots of each page; Hafs keys and stored
 * anchors land on the row holding their slot. Real Release 1 slots
 * (verseUnitsFixture.json: complete surahs 1, 71, 103, 106, 107, 112, 114 of
 * Hafs, Shu'bah, Warsh, al-Bazzi and al-Duri) on the real page-1 layout and
 * synthetic pages (verseUnitPages.ts). Every page of every words DB:
 * mushafVerseUnitRows.alldbs.test.ts (BAYAAN_OVERLAY_DB_DIR).
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import type {DKLine} from '@/services/mushaf/DigitalKhattDataService';
import type {RewayahVerseUnits} from '@/services/mushaf/RewayahVerseUnits';
import {
  buildFixtureUnits,
  fixtureLines,
  fixturePages,
  pageOfFixtureSurah,
  unitsFixture,
  UNITS_FIXTURE_DBS,
  type UnitsFixtureDb,
} from '@/services/mushaf/__fixtures__/verseUnitPages';
import {enhancedVersesBySurah} from '@/utils/enhancedVerseData';
import {UNNUMBERED_BASMALA_ROW_KEY} from '@/components/player/v2/PlayerContent/QuranView/verseUnitRows';
import {
  buildUnitListModel,
  pageRowKeys,
  readingPageUnitItems,
  themeHafsKeyOfRow,
  unitRowByKey,
  unitRowsOfSurah,
  type PageLinesSource,
  type UnitListItem,
} from '../mushafVerseUnitRows';

const LINES = fixtureLines();
const pageLines: PageLinesSource = page =>
  LINES.filter(line => line.page_number === page);
const BASMALA = UNNUMBERED_BASMALA_ROW_KEY;
const PAGES = fixturePages();
const MADANI_BASRI = new Set<UnitsFixtureDb>(['warsh', 'doori']);

const unitsCache = new Map<UnitsFixtureDb, RewayahVerseUnits>();
function units(db: UnitsFixtureDb): RewayahVerseUnits {
  let u = unitsCache.get(db);
  if (!u) {
    u = buildFixtureUnits(db);
    unitsCache.set(db, u);
  }
  return u;
}

const keysOf = (items: readonly UnitListItem[]) =>
  items.map(item =>
    item.type === 'surah_header'
      ? `header:${item.surahNumber}`
      : item.verse.verse_key,
  );

describe('pageRowKeys: the verses with a word on a page', () => {
  it('Warsh page 1: the unnumbered basmala, then verses 1-7 (Hafs 1:7 is 1:6 and 1:7)', () => {
    expect(pageRowKeys(units('warsh'), 1, pageLines)).toEqual([
      BASMALA,
      '1:1',
      '1:2',
      '1:3',
      '1:4',
      '1:5',
      '1:6',
      '1:7',
    ]);
  });

  it('Kufi / Makki counts: the basmala is verse 1', () => {
    for (const db of ['hafs', 'shouba', 'bazzi'] as const) {
      expect(pageRowKeys(units(db), 1, pageLines)).toEqual([
        '1:1',
        '1:2',
        '1:3',
        '1:4',
        '1:5',
        '1:6',
        '1:7',
      ]);
    }
  });

  it("every fixture page lists exactly its surah's verses, in order", () => {
    for (const db of UNITS_FIXTURE_DBS) {
      for (const surah of unitsFixture.surahs) {
        const expected = units(db)
          .unitsOfSurah(surah)
          .map(unit => unit.key);
        if (surah === 1 && MADANI_BASRI.has(db)) expected.unshift(BASMALA);
        expect(
          pageRowKeys(units(db), pageOfFixtureSurah(surah), pageLines),
        ).toEqual(expected);
      }
    }
  });

  it('a blank slot alone brings no row; a verse continuing from the previous page does', () => {
    const u = units('warsh');
    // Warsh 1:6 (slots 27-30) and 1:7 (31-36); a page holding only the
    // last slot of 1:6 and the words of 1:7 lists both, the first one
    // because of its word on the page.
    const line = (first: number, last: number): DKLine => ({
      page_number: 9,
      line_number: 1,
      line_type: 'ayah',
      is_centered: 0,
      first_word_id: first,
      last_word_id: last,
      surah_number: '' as unknown as number,
    });
    expect(pageRowKeys(u, 9, () => [line(30, 36)])).toEqual(['1:6', '1:7']);
    // al-Bazzi: Hafs 71:23's marker slot is blank (71:24 runs across it).
    const bazzi = units('bazzi');
    const marker = bazzi.hafsVerseWordRange('71:23')!.last;
    expect(bazzi.slotText(marker)).toBe('');
    expect(pageRowKeys(bazzi, 9, () => [line(marker, marker)])).toEqual([]);
  });
});

describe('readingPageUnitItems: one page as a verse list', () => {
  it('Warsh page 1: the surah header, the basmala row (no number), verses 1-7', () => {
    const u = units('warsh');
    const items = readingPageUnitItems(u, 1, pageLines);
    expect(keysOf(items)).toEqual([
      'header:1',
      BASMALA,
      '1:1',
      '1:2',
      '1:3',
      '1:4',
      '1:5',
      '1:6',
      '1:7',
    ]);
    expect(items[0]).toEqual({
      type: 'surah_header',
      surahNumber: 1,
      showBismillah: false,
    });
    const rows = items.filter(
      (item): item is Extract<UnitListItem, {type: 'verse'}> =>
        item.type === 'verse',
    );
    // Each row is the verse itself: its label, its own words (Warsh 1:6
    // ends at its inline marker; 1:7 is the rest of Hafs 1:7).
    for (const {verse: row, surahNumber} of rows) {
      expect(surahNumber).toBe(1);
      expect(unitRowByKey(u, row.verse_key)).toBe(row);
      if (row.unit) {
        expect(row.label).toBe(row.verse_key);
        expect(row.words.map(w => w.text).join(' ')).toBe(u.unitText(row.unit));
      }
    }
    const [basmala] = rows;
    expect(basmala.verse.unit).toBeNull();
    expect(basmala.verse.label).toBeNull();
    expect(
      rows.find(r => r.verse.verse_key === '1:6')!.verse.words.at(-1)!.text,
    ).toMatch(/۝٦$/);
  });

  it('the header of a surah opening on the page comes before its first row', () => {
    const u = units('bazzi');
    const page = pageOfFixtureSurah(71);
    const items = readingPageUnitItems(u, page, pageLines);
    expect(keysOf(items)).toEqual([
      'header:71',
      ...u.unitsOfSurah(71).map(unit => unit.key),
    ]);
    expect(items[0]).toMatchObject({showBismillah: true});
    // A page without the surah's header line: rows only.
    const noHeader: PageLinesSource = p =>
      pageLines(p).filter(line => line.line_type !== 'surah_name');
    expect(keysOf(readingPageUnitItems(u, page, noHeader))).toEqual(
      u.unitsOfSurah(71).map(unit => unit.key),
    );
  });

  it('a page without layout (not loaded) has no rows', () => {
    expect(readingPageUnitItems(units('warsh'), 1, () => [])).toEqual([]);
  });
});

describe('rows and their Hafs-aligned content', () => {
  it('rows are built once per units object and translation', () => {
    const u = units('warsh');
    const rows = unitRowsOfSurah(u, 1);
    expect(unitRowsOfSurah(u, 1)).toBe(rows);
    // The translation of Hafs 1:7 is under Warsh 1:6 (the first row
    // holding it), with the note under both rows.
    const hafs17 = enhancedVersesBySurah[1].find(v => v.verse_key === '1:7')!;
    const row16 = unitRowByKey(u, '1:6')!;
    const row17 = unitRowByKey(u, '1:7')!;
    expect(row16.parts).toMatchObject([
      {hafsKey: '1:7', owned: true, translation: hafs17.translation},
    ]);
    expect(row17.parts).toMatchObject([{hafsKey: '1:7', owned: false}]);
    expect(row16.parts[0].note).toBeTruthy();
    expect(row17.parts[0].note).toBe(row16.parts[0].note);
  });

  it('a rebuilt translation rebuilds the rows with it', () => {
    const u = units('warsh');
    const before = unitRowsOfSurah(u, 103);
    const saved = {...enhancedVersesBySurah};
    try {
      // rebuildEnhancedVerses replaces every surah's array.
      for (const key of Object.keys(saved)) {
        const surah = Number(key);
        enhancedVersesBySurah[surah] = saved[surah].map(v => ({
          ...v,
          translation: `T ${v.verse_key}`,
        }));
      }
      const after = unitRowsOfSurah(u, 103);
      expect(after).not.toBe(before);
      // Warsh 103:1 holds Hafs 103:1 and 103:2: both translations.
      expect(after[0].parts.map(p => p.translation)).toEqual([
        'T 103:1',
        'T 103:2',
      ]);
    } finally {
      for (const key of Object.keys(saved)) {
        enhancedVersesBySurah[Number(key)] = saved[Number(key)];
      }
    }
  });

  it('a row takes the theme of the Hafs verse its first word is in', () => {
    const u = units('warsh');
    expect(themeHafsKeyOfRow(unitRowByKey(u, '1:6')!)).toBe('1:7');
    expect(themeHafsKeyOfRow(unitRowByKey(u, '1:7')!)).toBe('1:7');
    expect(themeHafsKeyOfRow(unitRowByKey(u, '103:1')!)).toBe('103:1');
    expect(themeHafsKeyOfRow(unitRowByKey(u, BASMALA)!)).toBe('1:1');
  });

  it('unknown row keys find nothing', () => {
    const u = units('warsh');
    expect(unitRowByKey(u, '1:8')).toBeUndefined();
    expect(unitRowByKey(u, 'nonsense')).toBeUndefined();
    expect(unitRowByKey(units('bazzi'), BASMALA)).toBeUndefined();
  });
});

describe('buildUnitListModel: the vertical list', () => {
  it('every surah header, then its verse rows; no Hafs verse row', () => {
    const u = units('warsh');
    const model = buildUnitListModel(u, pageLines, PAGES);
    const keys = keysOf(model.items);
    expect(keys.filter(k => k.startsWith('header:'))).toHaveLength(114);
    for (const surah of unitsFixture.surahs) {
      const at = model.indexOfSurah(surah)!;
      expect(keys[at]).toBe(`header:${surah}`);
      const expected = u.unitsOfSurah(surah).map(unit => unit.key);
      if (surah === 1) expected.unshift(BASMALA);
      expect(keys.slice(at + 1, at + 1 + expected.length)).toEqual(expected);
    }
    for (const item of model.items) {
      if (item.type === 'verse') {
        expect(model.indexOfRow(item.verse.verse_key)).toBe(
          model.items.indexOf(item),
        );
      }
    }
  });

  it('Hafs keys and stored anchors land on the row holding their slot', () => {
    const model = buildUnitListModel(units('warsh'), pageLines, PAGES);
    const rowAt = (i: number | undefined) => {
      const item = i === undefined ? undefined : model.items[i];
      return item?.type === 'verse' ? item.verse.verse_key : undefined;
    };
    // Hafs 1:7 starts in Warsh 1:6; its later part (1:7:5) is Warsh 1:7.
    expect(rowAt(model.indexForHafsReference('1:7'))).toBe('1:6');
    expect(rowAt(model.indexForHafsReference('1:7:5'))).toBe('1:7');
    expect(rowAt(model.indexForHafsReference('1:7:3'))).toBe('1:6');
    // Hafs 1:1 is the unnumbered basmala; Hafs 1:2 is Warsh 1:1.
    expect(rowAt(model.indexForHafsReference('1:1'))).toBe(BASMALA);
    expect(rowAt(model.indexForHafsReference('1:2'))).toBe('1:1');
    // Hafs 103:2 is inside Warsh 103:1.
    expect(rowAt(model.indexForHafsReference('103:2'))).toBe('103:1');
    // Playback: the band's row holding the recited Hafs verse.
    expect(rowAt(model.indexForHafsReference('1:7', ['1:7']))).toBe('1:7');
    expect(rowAt(model.indexForHafsReference('1:7', ['1:6', '1:7']))).toBe(
      '1:6',
    );
    expect(rowAt(model.indexForHafsReference('1:7', ['103:1']))).toBe('1:6');
    // An explicit anchor is never redirected by the band.
    expect(rowAt(model.indexForHafsReference('1:7:5', ['1:6']))).toBe('1:7');
    // Nothing for what names no slot.
    expect(model.indexForHafsReference('1:8')).toBeUndefined();
    expect(model.indexForHafsReference('1:7:99')).toBeUndefined();
    expect(model.indexForHafsReference('nonsense')).toBeUndefined();
  });

  it('pages: the row holding the first word; a row starts on its page', () => {
    const u = units('warsh');
    const model = buildUnitListModel(u, pageLines, PAGES);
    const rowAt = (i: number | undefined) => {
      const item = i === undefined ? undefined : model.items[i];
      return item?.type === 'verse' ? item.verse.verse_key : undefined;
    };
    expect(rowAt(model.indexForPage(1))).toBe(BASMALA);
    expect(rowAt(model.indexForPage(pageOfFixtureSurah(103)))).toBe('103:1');
    expect(model.indexForPage(500)).toBeUndefined();
    expect(model.pageOfRow(BASMALA)).toBe(1);
    expect(model.pageOfRow('1:7')).toBe(1);
    for (const unit of u.unitsOfSurah(71)) {
      expect(model.pageOfRow(unit.key)).toBe(pageOfFixtureSurah(71));
    }
    expect(model.pageOfRow('2:1')).toBeUndefined();
    // al-Bazzi: the basmala is verse 1, the first row of page 1.
    const bazzi = buildUnitListModel(units('bazzi'), pageLines, PAGES);
    const first = bazzi.items[bazzi.indexForPage(1)!];
    expect(first.type === 'verse' && first.verse.verse_key).toBe('1:1');
  });

  it('page lookups wait for the layout (nothing is remembered before)', () => {
    let loaded = false;
    const lazyLines: PageLinesSource = page => (loaded ? pageLines(page) : []);
    const model = buildUnitListModel(units('warsh'), lazyLines, PAGES);
    expect(model.indexForPage(1)).toBeUndefined();
    expect(model.pageOfRow('1:1')).toBeUndefined();
    loaded = true;
    expect(model.indexForPage(1)).toBe(model.indexOfRow(BASMALA));
    expect(model.pageOfRow('1:1')).toBe(1);
  });
});
