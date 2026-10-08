// @ai-generated
/**
 * Bookmarks, highlights and notes of a verse sheet's selection (decision 3,
 * verse-units contract section 3): one row per selected verse at its Hafs
 * anchor; a verse is marked by ANY row naming one of its slots (legacy rows
 * keyed by a Hafs verse included), and removing its mark deletes every such
 * row. Hafs reads and writes exactly the selected Hafs keys, as before.
 *
 * Real Warsh slots (verseUnitsFixture.json: Warsh 1:6 = Hafs 1:7 words 1-4,
 * 1:7 = Hafs 1:7 from word 5, 103:1 = Hafs 103:1 + 103:2, 103:2 = Hafs 103:3
 * words 1-7, 103:3 = the rest of Hafs 103:3); the real annotations store
 * with the database service mocked; rows are saved in Warsh unless a test
 * says otherwise. Every unit of every words DB is checked by
 * selectionAnnotations.alldbs.test.ts (local, BAYAAN_OVERLAY_DB_DIR).
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

jest.mock('@/services/verse-annotations/VerseAnnotationService', () => ({
  verseAnnotationService: {
    addBookmark: jest.fn(async () => undefined),
    removeBookmark: jest.fn(async () => undefined),
    upsertHighlight: jest.fn(async () => undefined),
    removeHighlight: jest.fn(async () => undefined),
    addNote: jest.fn(async () => undefined),
    getAnnotationsForSurah: jest.fn(async () => ({
      bookmarks: [],
      notes: [],
      highlights: [],
    })),
  },
}));
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    isRewayahReady: () => true,
    getRewayahLoadState: () => 'ready',
    subscribeCacheChanges: () => () => undefined,
    getCacheVersion: () => 0,
    retainRewayah: () => () => undefined,
    ensureRewayahLoaded: () => Promise.reject(new Error('no load in tests')),
  },
  getRewayahDataIdentityKey: (r: string) => `${r}@test`,
}));
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => ({
  rewayahVerseUnitsService: {get: () => null, getStatus: () => 'error'},
}));

import {
  buildRewayahVerseUnits,
  type RewayahVerseUnits,
  type VerseUnitSlot,
} from '@/services/mushaf/RewayahVerseUnits';
import {verseAnnotationService} from '@/services/verse-annotations/VerseAnnotationService';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import {
  selectVerses,
  unitSelection,
  type ReadyVerseSelection,
} from '@/components/share/rewayahVerseSelection';
import {setStoredRows as setRows} from '../__fixtures__/storedRows';
import {
  addSelectionNote,
  selectionRowKeys,
  setSelectionBookmarked,
  setSelectionHighlight,
  unitRowKeys,
  useSelectionMarks,
  type SelectionMarks,
} from '../selectionAnnotations';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const fixture =
  require('@/services/mushaf/__fixtures__/verseUnitsFixture.json') as {
    ids: number[];
    locations: string[];
    texts: Record<'warsh', string[]>;
  };
function buildWarsh(): RewayahVerseUnits {
  const slots: VerseUnitSlot[] = fixture.ids.map((id, i) => {
    const [surah, ayah, word] = fixture.locations[i].split(':').map(Number);
    return {id, surah, ayah, word, text: fixture.texts.warsh[i]};
  });
  return buildRewayahVerseUnits('warsh', slots, 'warsh@test');
}
const warsh = buildWarsh();

/** Warsh verses, in Warsh numbering. */
function warshSelection(...keys: string[]): ReadyVerseSelection {
  return unitSelection(
    warsh,
    keys.map(key => warsh.unitByKey(key)!),
  );
}

/** A Hafs selection, as the sheets build it from a Hafs payload. */
function hafsSelection(...keys: string[]): ReadyVerseSelection {
  const [s, a] = keys[0].split(':').map(Number);
  const selection = selectVerses(
    {
      rewayah: 'hafs',
      verseKey: keys[0],
      surahNumber: s,
      ayahNumber: a,
      verseKeys: keys.length > 1 ? keys : undefined,
    },
    null,
    'ready',
  );
  if (selection.status !== 'ready') throw new Error('not ready');
  return selection;
}

const service = verseAnnotationService as jest.Mocked<
  typeof verseAnnotationService
>;
const calls = (fn: {mock: {calls: unknown[][]}}) =>
  fn.mock.calls.map(call => call[0]);

/** useSelectionMarks of `selection`, re-read after every store change. */
function renderMarks(selection: ReadyVerseSelection | null): {
  current: () => SelectionMarks;
  unmount: () => void;
} {
  let latest: SelectionMarks | null = null;
  function Probe() {
    latest = useSelectionMarks(selection);
    return null;
  }
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<Probe />);
  });
  return {
    current: () => latest!,
    unmount: () => act(() => renderer.unmount()),
  };
}

/** Runs a store change while a probe is mounted. */
async function run(change: () => Promise<void>) {
  await act(async () => {
    await change();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setRows([]);
});

describe('the keys whose rows mark a verse', () => {
  it('a verse starting a Hafs verse: its anchor first, then its slots', () => {
    expect(unitRowKeys(warsh, warsh.unitByKey('1:6')!)).toEqual([
      '1:7',
      '1:7:2',
      '1:7:3',
      '1:7:4',
    ]);
  });

  it('the later part of a split Hafs verse: from its own anchor on', () => {
    expect(unitRowKeys(warsh, warsh.unitByKey('1:7')!)).toEqual([
      '1:7:5',
      '1:7:6',
      '1:7:7',
      '1:7:8',
      '1:7:9',
      '1:7:10',
    ]);
  });

  it('a verse holding two Hafs verses: both, including the second start', () => {
    expect(unitRowKeys(warsh, warsh.unitByKey('103:1')!)).toEqual([
      '103:1',
      '103:1:2',
      '103:2',
      '103:2:2',
      '103:2:3',
      '103:2:4',
      '103:2:5',
    ]);
  });

  it('every verse: one key per slot, each naming that verse, none shared', () => {
    const seen = new Map<string, string>();
    for (const unit of warsh.units) {
      const keys = unitRowKeys(warsh, unit);
      expect(keys[0]).toBe(warsh.hafsAnchor(unit).key);
      expect(keys).toHaveLength(unit.lastWordId - unit.firstWordId + 1);
      for (const key of keys) {
        expect(warsh.unitForAnchor(key)).toBe(unit);
        expect(seen.get(key)).toBeUndefined();
        seen.set(key, unit.key);
      }
    }
  });

  it('Hafs: each selected Hafs key, as before', () => {
    expect(selectionRowKeys(hafsSelection('2:255'))).toEqual([['2:255']]);
    expect(selectionRowKeys(hafsSelection('2:286', '3:1'))).toEqual([
      ['2:286'],
      ['3:1'],
    ]);
  });
});

describe('bookmarks', () => {
  it('a legacy row on the second Hafs verse of a merged verse marks it', async () => {
    // Saved in Warsh before Release 1 on Hafs 103:2: Warsh 103:1 holds it.
    setRows(['103:2']);
    const marks = renderMarks(warshSelection('103:1'));
    expect(marks.current().bookmarked).toBe(true);

    await run(() => setSelectionBookmarked(warshSelection('103:1'), false));
    // Every row that marks it: the legacy row.
    expect(calls(service.removeBookmark)).toEqual(['103:2']);
    expect(service.addBookmark).not.toHaveBeenCalled();
    expect([
      ...useVerseAnnotationsStore.getState().bookmarkedVerseKeys,
    ]).toEqual([]);
    expect(marks.current().bookmarked).toBe(false);
    marks.unmount();
  });

  it('removing deletes its own row and a legacy row, nothing else', async () => {
    setRows(['103:1', '103:2', '103:3']);
    await setSelectionBookmarked(warshSelection('103:1'), false);
    expect(calls(service.removeBookmark)).toEqual(['103:1', '103:2']);
    // "103:3" is Warsh 103:2's own row.
    expect([
      ...useVerseAnnotationsStore.getState().bookmarkedVerseKeys,
    ]).toEqual(['103:3']);
  });

  it('a row marks only the verse holding the slot it names', () => {
    // "1:7" names Hafs 1:7's first word: Warsh 1:6, not Warsh 1:7.
    setRows(['1:7']);
    const first = renderMarks(warshSelection('1:6'));
    const second = renderMarks(warshSelection('1:7'));
    expect(first.current().bookmarked).toBe(true);
    expect(second.current().bookmarked).toBe(false);
    first.unmount();
    second.unmount();
  });

  it('a range is bookmarked when every verse is', () => {
    setRows(['1:7']);
    const marks = renderMarks(warshSelection('1:6', '1:7'));
    expect(marks.current().bookmarked).toBe(false);
    act(() => setRows(['1:7', '1:7:5']));
    expect(marks.current().bookmarked).toBe(true);
    marks.unmount();
  });

  it('bookmarking adds a row at each anchor, not over a legacy row', async () => {
    // Warsh 103:1 is already marked by its legacy row; 103:2 is not.
    setRows(['103:2']);
    await setSelectionBookmarked(warshSelection('103:1', '103:2'), true);
    expect(service.addBookmark.mock.calls).toEqual([
      ['103:3', 103, 3, 'warsh'],
    ]);
    expect([
      ...useVerseAnnotationsStore.getState().bookmarkedVerseKeys,
    ]).toEqual(['103:2', '103:3']);
  });

  it('the later part of a split Hafs verse is stored at its own anchor', async () => {
    await setSelectionBookmarked(warshSelection('1:7'), true);
    expect(service.addBookmark.mock.calls).toEqual([['1:7:5', 1, 7, 'warsh']]);
  });

  it('Hafs: adds and removes exactly the selected keys, as before', async () => {
    // A row of another rewayah inside Hafs 2:255 is not a Hafs bookmark.
    setRows(['2:255:3'], {}, 'warsh');
    const marks = renderMarks(hafsSelection('2:255'));
    expect(marks.current().bookmarked).toBe(false);
    await run(() => setSelectionBookmarked(hafsSelection('2:255'), true));
    expect(service.addBookmark.mock.calls).toEqual([['2:255', 2, 255, 'hafs']]);
    expect(marks.current().bookmarked).toBe(true);

    await run(() =>
      setSelectionBookmarked(hafsSelection('2:286', '3:1'), true),
    );
    expect(calls(service.addBookmark)).toEqual(['2:255', '2:286', '3:1']);
    await run(() =>
      setSelectionBookmarked(hafsSelection('2:286', '3:1'), false),
    );
    expect(calls(service.removeBookmark)).toEqual(['2:286', '3:1']);
    marks.unmount();
  });
});

describe('highlights', () => {
  it('a legacy row colours the verse holding it; removing deletes it', async () => {
    setRows([], {'103:2': 'yellow'});
    const marks = renderMarks(warshSelection('103:1'));
    expect(marks.current().highlightColor).toBe('yellow');

    await run(() => setSelectionHighlight(warshSelection('103:1'), null));
    expect(calls(service.removeHighlight)).toEqual(['103:2']);
    expect(useVerseAnnotationsStore.getState().highlights).toEqual({});
    expect(marks.current().highlightColor).toBeNull();
    marks.unmount();
  });

  it("the verse's own row gives its colour", () => {
    setRows([], {'103:1': 'green', '103:2': 'yellow'});
    const marks = renderMarks(warshSelection('103:1'));
    expect(marks.current().highlightColor).toBe('green');
    marks.unmount();
  });

  it('the first selected verse gives the colour', () => {
    setRows([], {'1:7:5': 'blue'});
    const marks = renderMarks(warshSelection('1:6', '1:7'));
    expect(marks.current().highlightColor).toBeNull();
    marks.unmount();
  });

  it('colouring writes one row per verse at its anchor', async () => {
    await setSelectionHighlight(warshSelection('1:6', '1:7'), 'purple');
    expect(service.upsertHighlight.mock.calls).toEqual([
      ['1:7', 1, 7, 'purple', 'warsh'],
      ['1:7:5', 1, 7, 'purple', 'warsh'],
    ]);
    expect(useVerseAnnotationsStore.getState().highlights).toEqual({
      '1:7': 'purple',
      '1:7:5': 'purple',
    });
  });

  it('Hafs: colours and removes every selected key, as before', async () => {
    setRows([], {'2:286': 'orange'}, 'hafs');
    await setSelectionHighlight(hafsSelection('2:286', '3:1'), 'green');
    expect(service.upsertHighlight.mock.calls).toEqual([
      ['2:286', 2, 286, 'green', 'hafs'],
      ['3:1', 3, 1, 'green', 'hafs'],
    ]);
    setRows([], {'2:286': 'orange'}, 'hafs');
    // Every selected key is removed, stored or not (the sheets always did).
    await setSelectionHighlight(hafsSelection('2:286', '3:1'), null);
    expect(calls(service.removeHighlight)).toEqual(['2:286', '3:1']);
  });

  it('nothing is marked while the selection is pending', () => {
    setRows(['1:7'], {'1:7': 'yellow'});
    const marks = renderMarks(null);
    expect(marks.current()).toEqual({bookmarked: false, highlightColor: null});
    marks.unmount();
  });
});

describe('notes', () => {
  it('a range: verse_key is the first anchor, verse_keys every anchor', async () => {
    await addSelectionNote(warshSelection('1:6', '1:7'), 'a note');
    expect(service.addNote.mock.calls).toEqual([
      ['1:7', 1, 7, 'a note', ['1:7', '1:7:5'], 'warsh'],
    ]);
    expect([...useVerseAnnotationsStore.getState().notedVerseKeys]).toEqual([
      '1:7',
      '1:7:5',
    ]);
  });

  it('one verse: no verse_keys', async () => {
    await addSelectionNote(warshSelection('103:2'), 'a note');
    expect(service.addNote.mock.calls).toEqual([
      ['103:3', 103, 3, 'a note', undefined, 'warsh'],
    ]);
  });

  it('Hafs: the Hafs keys, as before', async () => {
    await addSelectionNote(hafsSelection('2:286', '3:1'), 'a note');
    expect(service.addNote.mock.calls).toEqual([
      ['2:286', 2, 286, 'a note', ['2:286', '3:1'], 'hafs'],
    ]);
  });
});
