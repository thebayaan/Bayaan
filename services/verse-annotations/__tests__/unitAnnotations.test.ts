// @ai-generated
/**
 * Bookmarks, notes and highlights of rewayah verse units (decision 3), on
 * real slots of the Release 1 words DBs (the core's fixture surahs 1, 71,
 * 103, 106, 107, 112, 114):
 *  - rows store each unit's Hafs anchor + rewayah (never a rewayah number);
 *  - the two parts of a split Hafs verse are two rows and mark two verses;
 *  - a bare "S:A" row saved before verse units keeps its meaning: every
 *    verse holding words of that Hafs verse (listed as their range);
 *  - a shown rewayah's marks follow the storage rule of the contract;
 *  - collection rows read in their own rewayah (label + own text);
 *  - Hafs rows and Hafs marks are exactly the Hafs keys of before.
 * Every unit of every words DB: unitAnnotations.alldbs.test.ts (local).
 */
import {
  annotationAnchor,
  deriveUnitAnnotations,
  describeSavedVerse,
  formatHafsReference,
  isHafsSaved,
  noteRowKey,
  routeAnchorSelection,
  savedVerseLabel,
  savedVerseRouteParams,
  savedVerseSubtitle,
  unitForRouteAnchor,
  type AnnotationRows,
  type StoredHighlightRow,
  type StoredVerseRow,
} from '../unitAnnotations';
import {
  FIXTURE_REWAYAT,
  fixtureUnits,
  unitOf,
} from '../__fixtures__/verseUnitsTestData';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import type {HighlightColor} from '@/types/verse-annotations';

const hafs = () => fixtureUnits('hafs');
const warsh = () => fixtureUnits('warsh');
const bazzi = () => fixtureUnits('al-bazzi');

function rows(partial: {
  bookmarks?: StoredVerseRow[];
  notes?: StoredVerseRow[];
  highlights?: StoredHighlightRow[];
}): AnnotationRows {
  const bookmarks: Record<string, StoredVerseRow> = {};
  const notes: Record<string, StoredVerseRow> = {};
  const highlights: Record<string, StoredHighlightRow> = {};
  for (const row of partial.bookmarks ?? []) bookmarks[row.verseKey] = row;
  for (const row of partial.notes ?? []) notes[noteRowKey(row)] = row;
  for (const row of partial.highlights ?? []) highlights[row.verseKey] = row;
  return {bookmarks, notes, highlights};
}

const row = (verseKey: string, rewayahId?: RewayahId | null) => ({
  verseKey,
  rewayahId,
});
const hl = (
  verseKey: string,
  color: HighlightColor,
  rewayahId?: RewayahId | null,
) => ({verseKey, color, rewayahId});

describe('annotationAnchor: what a row stores for a verse', () => {
  it('stores the Hafs location of the verse start, never its own number', () => {
    const u = warsh();
    // Both parts of split Hafs 1:7 name their first word: the first part
    // at word 1, the later part at its 5th word.
    expect(annotationAnchor(u, unitOf(u, '1:6'))).toEqual({
      verseKey: '1:7:1',
      surahNumber: 1,
      ayahNumber: 7,
      rewayahId: 'warsh',
    });
    expect(annotationAnchor(u, unitOf(u, '1:7'))).toEqual({
      verseKey: '1:7:5',
      surahNumber: 1,
      ayahNumber: 7,
      rewayahId: 'warsh',
    });
    // Warsh 1:1 is Hafs 1:2 (the basmala is not a verse in Warsh).
    expect(annotationAnchor(u, unitOf(u, '1:1')).verseKey).toBe('1:2');
    // A merged verse is stored at its first Hafs verse.
    expect(annotationAnchor(u, unitOf(u, '103:1')).verseKey).toBe('103:1');
    expect(annotationAnchor(u, unitOf(u, '106:5')).verseKey).toBe('106:4:5');
  });

  it('is the Hafs key itself for every Hafs verse (rows unchanged)', () => {
    const u = hafs();
    for (const unit of u.units) {
      expect(annotationAnchor(u, unit)).toEqual({
        verseKey: unit.key,
        surahNumber: unit.surah,
        ayahNumber: unit.ayah,
        rewayahId: 'hafs',
      });
    }
  });

  it('refuses a verse of another rewayah', () => {
    expect(() => annotationAnchor(warsh(), unitOf(bazzi(), '71:24'))).toThrow();
  });
});

describe('deriveUnitAnnotations: marks in the numbering of the shown rewayah', () => {
  it('Hafs shown: the marks are exactly the Hafs rows (differential)', () => {
    const u = hafs();
    const keys = u.units.map(unit => unit.key);
    const colors: HighlightColor[] = ['yellow', 'green', 'blue'];
    const marks = deriveUnitAnnotations(
      u,
      rows({
        bookmarks: keys.map(k => row(k, 'hafs')),
        notes: keys.map(k => row(k, 'hafs')),
        highlights: keys.map((k, i) => hl(k, colors[i % 3], 'hafs')),
      }),
    );
    expect([...marks.bookmarkedUnitKeys]).toEqual(keys);
    expect([...marks.notedUnitKeys]).toEqual(keys);
    expect(marks.highlightColors).toEqual(
      Object.fromEntries(keys.map((k, i) => [k, colors[i % 3]])),
    );
    for (const k of keys) {
      expect(marks.bookmarkRowKeys(k)).toEqual([k]);
      expect(marks.highlightRowKeys(k)).toEqual([k]);
    }
  });

  it('Hafs shown: legacy rows without rewayah and existing rewayah rows read as before', () => {
    // Existing data has "S:A" keys only; Hafs shows each on its Hafs verse.
    const marks = deriveUnitAnnotations(
      hafs(),
      rows({
        bookmarks: [row('1:7', null), row('103:2', 'warsh'), row('71:23')],
      }),
    );
    expect([...marks.bookmarkedUnitKeys].sort()).toEqual([
      '103:2',
      '1:7',
      '71:23',
    ]);
  });

  it('keeps the two parts of a split Hafs verse apart', () => {
    const u = warsh();
    const first = deriveUnitAnnotations(
      u,
      rows({bookmarks: [row('1:7:1', 'warsh')]}),
    );
    expect([...first.bookmarkedUnitKeys]).toEqual(['1:6']);
    const second = deriveUnitAnnotations(
      u,
      rows({bookmarks: [row('1:7:5', 'warsh')]}),
    );
    expect([...second.bookmarkedUnitKeys]).toEqual(['1:7']);
    const both = deriveUnitAnnotations(
      u,
      rows({bookmarks: [row('1:7:1', 'warsh'), row('1:7:5', 'warsh')]}),
    );
    expect([...both.bookmarkedUnitKeys]).toEqual(['1:6', '1:7']);
    expect(both.bookmarkRowKeys('1:6')).toEqual(['1:7:1']);
    expect(both.bookmarkRowKeys('1:7')).toEqual(['1:7:5']);
  });

  it('a Hafs row marks every verse holding words of its Hafs verse', () => {
    const marks = deriveUnitAnnotations(
      warsh(),
      rows({
        bookmarks: [row('1:7', 'hafs'), row('103:2', 'hafs')],
        notes: [row('106:4', 'hafs')],
      }),
    );
    expect([...marks.bookmarkedUnitKeys]).toEqual(['1:6', '1:7', '103:1']);
    expect(marks.bookmarkRowKeys('1:7')).toEqual(['1:7']);
    expect([...marks.notedUnitKeys]).toEqual(['106:4', '106:5']);
  });

  it('a rewayah row saved before verse units marks every verse of its Hafs verse', () => {
    // Saved before verse units: Warsh rows on the Hafs verse the reader
    // marked (no migration). "1:7" was all of Hafs 1:7: Warsh 1:6 and 1:7.
    const marks = deriveUnitAnnotations(
      warsh(),
      rows({bookmarks: [row('1:7', 'warsh'), row('103:2', 'warsh')]}),
    );
    expect([...marks.bookmarkedUnitKeys]).toEqual(['1:6', '1:7', '103:1']);
    expect(marks.bookmarkRowKeys('1:6')).toEqual(['1:7']);
    expect(marks.bookmarkRowKeys('1:7')).toEqual(['1:7']);
    // Next to the rows written now, it keeps marking both parts.
    const mixed = deriveUnitAnnotations(
      warsh(),
      rows({bookmarks: [row('1:7', 'warsh'), row('1:7:5', 'warsh')]}),
    );
    expect(mixed.bookmarkRowKeys('1:6')).toEqual(['1:7']);
    expect([...mixed.bookmarkRowKeys('1:7')].sort()).toEqual(['1:7', '1:7:5']);
  });

  it('the unnumbered Fatiha basmala marks nothing in the Madani count', () => {
    const marks = deriveUnitAnnotations(
      warsh(),
      rows({
        bookmarks: [row('1:1', 'hafs')],
        highlights: [hl('1:1', 'green', 'hafs')],
      }),
    );
    expect(marks.bookmarkedUnitKeys.size).toBe(0);
    expect(marks.highlightColors).toEqual({});
  });

  it('a row of a third rewayah maps from its anchored word without loading it', () => {
    // al-Bazzi 71:25 starts at Hafs 71:24:4; Warsh 71:25 holds Hafs 71:24.
    const marks = deriveUnitAnnotations(
      warsh(),
      rows({bookmarks: [row('71:24:4', 'al-bazzi')]}),
    );
    expect([...marks.bookmarkedUnitKeys]).toEqual(['71:25']);
    // With al-Bazzi's units: exactly the Warsh verses holding its words.
    const exact = deriveUnitAnnotations(
      warsh(),
      rows({bookmarks: [row('71:23:10', 'al-bazzi')]}),
      r => (r === 'al-bazzi' ? bazzi() : null),
    );
    // al-Bazzi 71:24 = Hafs 71:23 from word 10 + start of Hafs 71:24.
    expect([...exact.bookmarkedUnitKeys]).toEqual(['71:24', '71:25']);
  });

  it('colours a verse by the row saved at its own anchor in the shown rewayah', () => {
    const marks = deriveUnitAnnotations(
      warsh(),
      rows({
        highlights: [
          hl('103:2', 'yellow', 'hafs'), // Hafs 103:2 is in Warsh 103:1
          hl('103:1', 'blue', 'warsh'), // Warsh 103:1's own anchor
          hl('106:4', 'green', 'hafs'),
          hl('106:4:5', 'purple', 'warsh'),
        ],
      }),
    );
    expect(marks.highlightColors).toEqual({
      '103:1': 'blue',
      '106:4': 'green',
      '106:5': 'purple',
    });
    expect([...marks.highlightRowKeys('103:1')].sort()).toEqual([
      '103:1',
      '103:2',
    ]);
    expect(marks.highlightRowKeys('106:5')).toEqual(['106:4', '106:4:5']);
    expect(marks.highlightColorRowKey('106:5')).toBe('106:4:5');
    expect(marks.highlightColorRowKey('106:4')).toBe('106:4');
    expect(marks.highlightColorRowKey('106:3')).toBeNull();
  });

  it('a verse coloured at its own anchor wins over a row saved before verse units', () => {
    const marks = deriveUnitAnnotations(
      warsh(),
      rows({
        highlights: [
          hl('1:7', 'yellow', 'warsh'),
          hl('1:7:1', 'green', 'warsh'),
        ],
      }),
    );
    expect(marks.highlightColors).toEqual({'1:6': 'green', '1:7': 'yellow'});
    expect(marks.highlightColorRowKey('1:6')).toBe('1:7:1');
    expect(marks.highlightColorRowKey('1:7')).toBe('1:7');
  });
});

describe('describeSavedVerse: a collection row in its own rewayah', () => {
  const ready = (rewayah: RewayahId) => ({
    units: fixtureUnits(rewayah),
    status: 'ready' as const,
  });

  it('leaves Hafs and legacy rows as they were', () => {
    for (const rewayahId of ['hafs', null, undefined] as const) {
      expect(
        describeSavedVerse({verseKey: '1:7', rewayahId}, ready('warsh')),
      ).toEqual({kind: 'hafs'});
      expect(isHafsSaved({rewayahId})).toBe(true);
    }
    expect(isHafsSaved({rewayahId: 'warsh'})).toBe(false);
  });

  it('names the saved verse in the rewayah numbering with its own text', () => {
    const u = warsh();
    const later = describeSavedVerse(
      {verseKey: '1:7:5', rewayahId: 'warsh'},
      ready('warsh'),
    );
    expect(later).toEqual({
      kind: 'units',
      units: [unitOf(u, '1:7')],
      label: '1:7',
      text: u.unitText(unitOf(u, '1:7')),
    });
    if (later.kind !== 'units') throw new Error('units expected');
    expect(later.text.endsWith('۝٧')).toBe(true);
    // Only the later part: not the first part's verse number.
    expect(later.text).not.toContain('۝٦');
    const first = describeSavedVerse(
      {verseKey: '1:7:1', rewayahId: 'warsh'},
      ready('warsh'),
    );
    expect(first.kind === 'units' && first.label).toBe('1:6');
    expect(first.kind === 'units' && first.text.endsWith('۝٦')).toBe(true);
  });

  it('lists a row saved before verse units on a split Hafs verse as both parts', () => {
    // develop saved ("1:7", "warsh") for all of Hafs 1:7.
    const u = warsh();
    expect(
      describeSavedVerse({verseKey: '1:7', rewayahId: 'warsh'}, ready('warsh')),
    ).toEqual({
      kind: 'units',
      units: [unitOf(u, '1:6'), unitOf(u, '1:7')],
      label: '1:6-7',
      text: `${u.unitText(unitOf(u, '1:6'))} ${u.unitText(unitOf(u, '1:7'))}`,
    });
    // On a Hafs verse inside a merged verse: that verse.
    const merged = describeSavedVerse(
      {verseKey: '103:2', rewayahId: 'warsh'},
      ready('warsh'),
    );
    expect(merged.kind === 'units' && merged.label).toBe('103:1');
  });

  it('names a note on several verses by its anchors', () => {
    const u = warsh();
    const note = describeSavedVerse(
      {verseKey: '1:7:1', verseKeys: ['1:7:1', '1:7:5'], rewayahId: 'warsh'},
      ready('warsh'),
    );
    expect(note).toEqual({
      kind: 'units',
      units: [unitOf(u, '1:6'), unitOf(u, '1:7')],
      label: '1:6-7',
      text: `${u.unitText(unitOf(u, '1:6'))} ${u.unitText(unitOf(u, '1:7'))}`,
    });
    // A legacy note on Hafs keys: every verse holding their words, once
    // (Warsh splits Hafs 103:3 into 103:2 and 103:3).
    const legacy = describeSavedVerse(
      {
        verseKey: '103:1',
        verseKeys: ['103:1', '103:2', '103:3'],
        rewayahId: 'warsh',
      },
      ready('warsh'),
    );
    expect(legacy.kind === 'units' && legacy.label).toBe('103:1-3');
  });

  it('shows no number while the rewayah verses load', () => {
    for (const status of ['loading', 'idle'] as const) {
      expect(
        describeSavedVerse(
          {verseKey: '1:7:5', rewayahId: 'warsh'},
          {units: null, status},
        ),
      ).toEqual({kind: 'loading'});
    }
    // Units of another rewayah are never used for this row.
    expect(
      describeSavedVerse(
        {verseKey: '1:7:5', rewayahId: 'warsh'},
        ready('al-bazzi'),
      ),
    ).toEqual({kind: 'loading'});
  });

  it('falls back to the prefixed Hafs reference when no verse names it', () => {
    for (const status of ['error', 'unavailable'] as const) {
      expect(
        describeSavedVerse(
          {verseKey: '1:7:5', rewayahId: 'warsh'},
          {units: null, status},
        ),
      ).toEqual({kind: 'unnumbered', hafsKeys: ['1:7'], hafsLabel: 'Hafs 1:7'});
    }
    // The unnumbered Fatiha basmala of the Madani count.
    expect(
      describeSavedVerse({verseKey: '1:1', rewayahId: 'warsh'}, ready('warsh')),
    ).toEqual({kind: 'unnumbered', hafsKeys: ['1:1'], hafsLabel: 'Hafs 1:1'});
    expect(
      describeSavedVerse({verseKey: 'bad', rewayahId: 'warsh'}, ready('warsh')),
    ).toEqual({kind: 'unnumbered', hafsKeys: [], hafsLabel: ''});
    expect(formatHafsReference('2:255')).toBe('Hafs 2:255');
  });

  it('labels and subtitles: Hafs exactly as before', () => {
    expect(savedVerseLabel({kind: 'hafs'}, '2:255')).toBe('2:255');
    expect(savedVerseSubtitle({kind: 'hafs'}, 255)).toBe('Ayah 255');
    expect(savedVerseLabel({kind: 'loading'}, '2:255')).toBeNull();
    expect(savedVerseSubtitle({kind: 'loading'}, 255)).toBeUndefined();
    const later = describeSavedVerse(
      {verseKey: '106:4:5', rewayahId: 'warsh'},
      ready('warsh'),
    );
    expect(savedVerseLabel(later, '106:4')).toBe('106:5');
    expect(savedVerseSubtitle(later, 4)).toBe('Ayah 5');
    const basmala = describeSavedVerse(
      {verseKey: '1:1', rewayahId: 'warsh'},
      ready('warsh'),
    );
    expect(savedVerseLabel(basmala, '1:1')).toBe('Hafs 1:1');
    expect(savedVerseSubtitle(basmala, 1)).toBe('Hafs 1:1');
    const invalid = describeSavedVerse(
      {verseKey: 'bad', rewayahId: 'warsh'},
      ready('warsh'),
    );
    expect(savedVerseLabel(invalid, '0:0')).toBeNull();
    expect(savedVerseSubtitle(invalid, 0)).toBeUndefined();
  });
});

describe('opening a saved verse', () => {
  it('Hafs rows route exactly as before (no anchor)', () => {
    for (const rewayahId of ['hafs', null, undefined] as const) {
      const params = savedVerseRouteParams(
        {verseKey: '2:255', surahNumber: 2, ayahNumber: 255, rewayahId},
        42,
      );
      expect(params).toEqual({surah: '2', ayah: '255', page: '42'});
      expect('anchor' in params).toBe(false);
    }
  });

  it('rewayah rows pass their anchor so the exact verse is selected', () => {
    expect(
      savedVerseRouteParams(
        {verseKey: '1:7:5', surahNumber: 1, ayahNumber: 7, rewayahId: 'warsh'},
        1,
      ),
    ).toEqual({surah: '1', ayah: '7', page: '1', anchor: '1:7:5'});
    expect(
      savedVerseRouteParams(
        {verseKey: '1:7:1', surahNumber: 1, ayahNumber: 7, rewayahId: 'warsh'},
        1,
      ).anchor,
    ).toBe('1:7:1');
    // A row saved before verse units passes its key: it opens at the first
    // verse it marks (unitForRouteAnchor).
    expect(
      savedVerseRouteParams(
        {verseKey: '1:7', surahNumber: 1, ayahNumber: 7, rewayahId: 'warsh'},
        1,
      ).anchor,
    ).toBe('1:7');
    // An unreadable key opens its page only.
    expect(
      savedVerseRouteParams(
        {verseKey: 'x', surahNumber: 1, ayahNumber: 7, rewayahId: 'warsh'},
        1,
      ),
    ).toEqual({surah: '1', ayah: '7', page: '1'});
  });

  it('unitForRouteAnchor opens the verse holding the anchored word', () => {
    const u = warsh();
    expect(unitForRouteAnchor('1:7:5', u)).toBe(unitOf(u, '1:7'));
    expect(unitForRouteAnchor('1:7:6', u)).toBe(unitOf(u, '1:7'));
    expect(unitForRouteAnchor('1:7:1', u)).toBe(unitOf(u, '1:6'));
    // A bare key marking both parts opens at the first.
    expect(unitForRouteAnchor('1:7', u)).toBe(unitOf(u, '1:6'));
    // The unnumbered basmala opens Warsh 1:1 right after it.
    expect(unitForRouteAnchor('1:1', u)).toBe(unitOf(u, '1:1'));
    expect(unitForRouteAnchor('1:1:3', u)).toBe(unitOf(u, '1:1'));
    expect(unitForRouteAnchor('1:7:99', u)).toBeNull();
    expect(unitForRouteAnchor('2:1', u)).toBeNull(); // not in the fixture
    expect(unitForRouteAnchor('bad', u)).toBeNull();
    // Hafs: the anchor's Hafs verse.
    expect(unitForRouteAnchor('1:1', hafs())).toBe(unitOf(hafs(), '1:1'));
  });

  it('routeAnchorSelection selects that verse with its anchor', () => {
    const u = warsh();
    expect(routeAnchorSelection('1:7:5', u)).toEqual({
      key: '1:7',
      anchor: '1:7:5',
      hafsKeys: ['1:7'],
    });
    // The unnumbered basmala selects Warsh 1:1, anchored at Hafs 1:2.
    expect(routeAnchorSelection('1:1', u)).toEqual({
      key: '1:1',
      anchor: '1:2',
      hafsKeys: ['1:2'],
    });
    expect(routeAnchorSelection('103:2', u)).toEqual({
      key: '103:1',
      anchor: '103:1',
      hafsKeys: ['103:1', '103:2'],
    });
    expect(routeAnchorSelection('bad', u)).toBeNull();
  });

  it('every fixture verse round-trips through its stored row', () => {
    for (const rewayah of FIXTURE_REWAYAT) {
      const u = fixtureUnits(rewayah);
      for (const unit of u.units) {
        const anchor = annotationAnchor(u, unit);
        expect(unitForRouteAnchor(anchor.verseKey, u)).toBe(unit);
        const description = describeSavedVerse(
          {verseKey: anchor.verseKey, rewayahId: rewayah},
          {units: u, status: 'ready'},
        );
        if (rewayah === 'hafs') {
          expect(description).toEqual({kind: 'hafs'});
        } else {
          expect(description).toEqual({
            kind: 'units',
            units: [unit],
            label: unit.key,
            text: u.unitText(unit),
          });
        }
      }
    }
  });
});
