// @ai-generated
/**
 * A Hafs mushaf shows exactly the bookmarks and colour highlights its verse
 * sheet reports and can remove, whatever rewayah the rows were saved in.
 *
 * Rows stay Hafs-keyed: a verse of another rewayah that starts inside a
 * Hafs verse (the later part of a split Hafs verse) is stored at a
 * mid-verse anchor, Warsh 1:7 at "1:7:5". The Hafs verse sheet, the Hafs
 * player and list rows read rows by their exact verse_key, as before verse
 * units; so does the Hafs page (HAFS_SHOWN_UNITS.unitKeysForStoredVerse):
 * a mid-verse anchor is no Hafs verse key and is not painted in Hafs, so
 * the page never shows a mark that the sheet calls absent and cannot
 * remove. Such a row shows in its own rewayah (Bookmarks list, its mushaf).
 *
 * The real annotations store, the real Hafs-page layer mapping (SkiaPage's
 * and ContinuousMushafView's sources) and the real sheet hooks and actions;
 * the database service is mocked. Real Release 1 slots for the rows of the
 * other rewayat (verseUnitsFixture.json).
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
    rewayah: 'hafs',
    isRewayahReady: () => true,
    getRewayahLoadState: () => 'ready',
    subscribeCacheChanges: () => () => undefined,
    getCacheVersion: () => 0,
    retainRewayah: () => () => undefined,
    ensureRewayahLoaded: () => Promise.reject(new Error('no load in tests')),
    onRewayahChange: () => () => undefined,
  },
  getRewayahDataIdentityKey: (r: string) => `${r}@test`,
}));
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => ({
  rewayahVerseUnitsService: {get: () => null, getStatus: () => 'error'},
}));

import {HAFS_SHOWN_UNITS} from '@/services/mushaf/MushafVerseMapService';
import {
  NO_PLAYBACK_BAND,
  unitKeyedVerseLayers,
} from '@/components/mushaf/skia/verseHighlightLayers';
import {
  selectVerses,
  type ReadyVerseSelection,
} from '@/components/share/rewayahVerseSelection';
import {verseAnnotationService} from '@/services/verse-annotations/VerseAnnotationService';
import {fixtureUnits} from '@/services/verse-annotations/__fixtures__/verseUnitsTestData';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import type {HighlightColor} from '@/types/verse-annotations';
import {setStoredRows} from '../__fixtures__/storedRows';
import {
  setSelectionBookmarked,
  setSelectionHighlight,
  useSelectionBookmarked,
  useSelectionHighlightColor,
} from '../selectionAnnotations';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const service = verseAnnotationService as jest.Mocked<
  typeof verseAnnotationService
>;

/** A Hafs selection, as the verse sheets build it from a Hafs payload. */
function hafsSelection(key: string): ReadyVerseSelection {
  const [surahNumber, ayahNumber] = key.split(':').map(Number);
  const selection = selectVerses(
    {rewayah: 'hafs', verseKey: key, surahNumber, ayahNumber},
    null,
    'ready',
  );
  if (selection.status !== 'ready') throw new Error(`no Hafs verse ${key}`);
  return selection;
}

/** What the Hafs page paints from the store (SkiaPage's sources). */
function hafsPage() {
  const state = useVerseAnnotationsStore.getState();
  return unitKeyedVerseLayers(HAFS_SHOWN_UNITS, {
    bookmarkedVerseKeys: state.bookmarkedVerseKeys,
    persistentHighlights: state.highlights,
    bookmarkRows: state.bookmarkRows,
    highlightRows: state.highlightRows,
    playback: NO_PLAYBACK_BAND,
    selection: null,
  });
}

/** VerseItem's bookmark dot on a Hafs verse row (no unit row). */
const hafsRowDot = (key: string) =>
  useVerseAnnotationsStore.getState().bookmarkedVerseKeys.has(key);

interface Marks {
  bookmarked: boolean;
  color: HighlightColor | null;
}

/** The verse sheet's marks hooks of one Hafs verse each, kept current. */
function sheets(keys: readonly string[]): {
  of: (key: string) => Marks;
  unmount: () => void;
} {
  const latest = new Map<string, Marks>();
  function Probe({verseKey}: {verseKey: string}) {
    const selection = React.useMemo(() => hafsSelection(verseKey), [verseKey]);
    latest.set(verseKey, {
      bookmarked: useSelectionBookmarked(selection),
      color: useSelectionHighlightColor(selection),
    });
    return null;
  }
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <>
        {keys.map(key => (
          <Probe key={key} verseKey={key} />
        ))}
      </>,
    );
  });
  return {
    of: key => {
      const marks = latest.get(key);
      if (!marks) throw new Error(`no sheet for ${key}`);
      return marks;
    },
    unmount: () => act(() => renderer.unmount()),
  };
}

/** Page, sheet and row dot of Hafs verse `key`, side by side. */
function seen(sheet: ReturnType<typeof sheets>, key: string) {
  const page = hafsPage();
  return {
    page: {
      bookmarked: page.bookmarkedVerseKeys.has(key),
      color: page.persistentHighlights[key] ?? null,
    },
    sheet: sheet.of(key),
    dot: hafsRowDot(key),
  };
}

async function run(change: () => Promise<void>) {
  await act(async () => {
    await change();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setStoredRows([]);
});

describe('a Warsh verse that starts inside a Hafs verse (Warsh 1:7, "1:7:5")', () => {
  it('its bookmark: no mark in Hafs; bookmarking Hafs 1:7 there and back leaves it alone', async () => {
    setStoredRows(['1:7:5'], {}, 'warsh');
    const sheet = sheets(['1:7']);
    const none = {bookmarked: false, color: null};
    expect(seen(sheet, '1:7')).toEqual({page: none, sheet: none, dot: false});

    await run(() => setSelectionBookmarked(hafsSelection('1:7'), true));
    const marked = {bookmarked: true, color: null};
    expect(seen(sheet, '1:7')).toEqual({
      page: marked,
      sheet: marked,
      dot: true,
    });
    expect(service.addBookmark.mock.calls).toEqual([['1:7', 1, 7, 'hafs']]);

    await run(() => setSelectionBookmarked(hafsSelection('1:7'), false));
    // No tint is left behind, and Warsh 1:7 keeps its own bookmark.
    expect(seen(sheet, '1:7')).toEqual({page: none, sheet: none, dot: false});
    expect(service.removeBookmark.mock.calls).toEqual([['1:7']]);
    expect(
      Object.keys(useVerseAnnotationsStore.getState().bookmarkRows),
    ).toEqual(['1:7:5']);
    sheet.unmount();
  });

  it('its colour: no colour in Hafs; colouring Hafs 1:7 and removing it leaves it alone', async () => {
    setStoredRows([], {'1:7:5': 'green'}, 'warsh');
    const sheet = sheets(['1:7']);
    const none = {bookmarked: false, color: null};
    expect(seen(sheet, '1:7')).toEqual({page: none, sheet: none, dot: false});

    await run(() => setSelectionHighlight(hafsSelection('1:7'), 'yellow'));
    const yellow = {bookmarked: false, color: 'yellow'};
    expect(seen(sheet, '1:7')).toEqual({
      page: yellow,
      sheet: yellow,
      dot: false,
    });

    await run(() => setSelectionHighlight(hafsSelection('1:7'), null));
    expect(seen(sheet, '1:7')).toEqual({page: none, sheet: none, dot: false});
    expect(service.removeHighlight.mock.calls).toEqual([['1:7']]);
    expect(useVerseAnnotationsStore.getState().highlightRows['1:7:5']).toEqual({
      verseKey: '1:7:5',
      rewayahId: 'warsh',
      color: 'green',
    });
    sheet.unmount();
  });
});

it('a row of another rewayah at a Hafs verse key marks that Hafs verse everywhere, as before', async () => {
  // A Warsh row saved before verse units on Hafs 1:7 ("1:7"; Warsh 1:6 is
  // stored at "1:7:1" now).
  setStoredRows(['1:7'], {'1:7': 'blue'}, 'warsh');
  const sheet = sheets(['1:7']);
  const blue = {bookmarked: true, color: 'blue'};
  expect(seen(sheet, '1:7')).toEqual({page: blue, sheet: blue, dot: true});

  await run(() => setSelectionBookmarked(hafsSelection('1:7'), false));
  await run(() => setSelectionHighlight(hafsSelection('1:7'), null));
  const none = {bookmarked: false, color: null};
  expect(seen(sheet, '1:7')).toEqual({page: none, sheet: none, dot: false});
  expect(service.removeBookmark.mock.calls).toEqual([['1:7']]);
  expect(service.removeHighlight.mock.calls).toEqual([['1:7']]);
  sheet.unmount();
});

it('every Hafs verse of the fixture: the page marks exactly what the sheet and the row report', () => {
  // A row at the anchor of every Warsh, al-Bazzi and al-Duri verse of the
  // fixture surahs (verse_key is UNIQUE: the first rewayah to claim a key
  // keeps it), colour rows likewise, plus Hafs rows on other Hafs verses.
  const anchorsOf = (rewayah: 'warsh' | 'al-bazzi' | 'al-duri-abi-amr') => {
    const units = fixtureUnits(rewayah);
    return units.units.map(unit => units.hafsAnchor(unit).key);
  };
  const colours: HighlightColor[] = ['yellow', 'green', 'blue'];
  const store = useVerseAnnotationsStore.getState();
  const claimed = new Set<string>();
  (['warsh', 'al-bazzi', 'al-duri-abi-amr'] as const).forEach((rewayah, r) => {
    anchorsOf(rewayah).forEach((key, i) => {
      if (claimed.has(key)) return;
      claimed.add(key);
      if (i % 2 === 0) store.addBookmark(key, rewayah);
      if (i % 3 !== 1) store.setHighlight(key, colours[(i + r) % 3], rewayah);
    });
  });
  const hafsKeys = fixtureUnits('hafs').units.map(unit => unit.key);
  hafsKeys.forEach((key, i) => {
    if (claimed.has(key) || i % 4 !== 0) return;
    store.addBookmark(key, 'hafs');
    store.setHighlight(key, 'green', 'hafs');
  });
  const rows = useVerseAnnotationsStore.getState();
  expect(
    Object.keys(rows.bookmarkRows).some(key => key.split(':').length === 3),
  ).toBe(true);

  const sheet = sheets(hafsKeys);
  let marked = 0;
  for (const key of hafsKeys) {
    const {page, sheet: reported, dot} = seen(sheet, key);
    expect({key, ...page}).toEqual({key, ...reported});
    expect(dot).toBe(reported.bookmarked);
    if (reported.bookmarked || reported.color) marked++;
  }
  expect(marked).toBeGreaterThan(10);
  sheet.unmount();
});
