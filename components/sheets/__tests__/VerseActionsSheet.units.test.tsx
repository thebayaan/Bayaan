// @ai-generated
/**
 * The verse actions sheet acts on the shown rewayah's OWN verses (decision
 * 3): header, copied text and citation, bookmark rows, the screens' inputs
 * and playback, from the payload's unit keys (contract 4.1) or, for a
 * Hafs-keyed payload, from the rewayah verses holding its Hafs verses. Hafs
 * is checked against the sheet's output from before the verse units.
 *
 * Warsh units are built from real slots (verseUnitsFixture.json); the Hafs
 * text is a placeholder string per verse.
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {Text} from 'react-native';

const mockScreens: Record<string, Array<Record<string, unknown>>> = {};
// Hoisted (a function declaration): the mock factories below run first.
function mockRecord(name: string, props: Record<string, unknown>) {
  (mockScreens[name] ??= []).push(props);
  return null;
}
jest.mock('../verse-actions/HighlightContent', () => ({
  HighlightContent: (props: Record<string, unknown>) =>
    mockRecord('highlight', props),
}));
jest.mock('../verse-actions/NoteContent', () => ({
  NoteContent: (props: Record<string, unknown>) => mockRecord('note', props),
}));
jest.mock('../verse-actions/ShareContent', () => ({
  ShareContent: (props: Record<string, unknown>) => mockRecord('share', props),
}));
jest.mock('../verse-actions/SimilarVersesContent', () => ({
  SimilarVersesContent: (props: Record<string, unknown>) =>
    mockRecord('similar', props),
}));
jest.mock('../verse-actions/TranslationContent', () => ({
  TranslationContent: (props: Record<string, unknown>) =>
    mockRecord('translation', props),
}));
jest.mock('../verse-actions/TafseerContent', () => ({
  TafseerContent: (props: Record<string, unknown>) =>
    mockRecord('tafseer', props),
}));
jest.mock('../verse-actions/ThemeContent', () => ({
  ThemeContent: (props: Record<string, unknown>) => mockRecord('theme', props),
}));
jest.mock('../verse-actions/WBWContent', () => ({
  WBWContent: (props: Record<string, unknown>) => mockRecord('wbw', props),
}));
jest.mock('../verse-actions/CommunityReflectionsContent', () => ({
  CommunityReflectionsContent: (props: Record<string, unknown>) =>
    mockRecord('reflections', props),
}));

jest.mock('react-native-actions-sheet', () => {
  const ReactActual = jest.requireActual('react');
  const {View} = jest.requireActual('react-native');
  const Container = (props: {children?: React.ReactNode}) =>
    ReactActual.createElement(View, null, props.children);
  return {
    __esModule: true,
    default: Container,
    ScrollView: Container,
    SheetManager: {
      show: jest.fn(() => Promise.resolve()),
      hide: jest.fn(() => Promise.resolve()),
      hideAll: jest.fn(),
    },
  };
});
jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
  MaterialCommunityIcons: () => null,
}));
jest.mock('@/components/Icons', () => {
  const Icon = () => null;
  return {
    PlayIcon: Icon,
    RepeatIcon: Icon,
    StackedVolumesIcon: Icon,
    PageQuillIcon: Icon,
    MirrorWavesIcon: Icon,
    HighlightIcon: Icon,
    ChainLinksIcon: Icon,
    GroupedLinesIcon: Icon,
    BreakdownIcon: Icon,
    CopyIcon: Icon,
    ShareIcon: Icon,
  };
});
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {
        text: '#111111',
        textSecondary: '#666666',
        background: '#ffffff',
        card: '#ffffff',
      },
    },
    isDarkMode: false,
  }),
}));
jest.mock('@/utils/haptics', () => ({lightHaptics: jest.fn()}));
jest.mock('@/utils/toastUtils', () => ({showToast: jest.fn()}));
jest.mock('expo-clipboard', () => ({setStringAsync: jest.fn()}));
jest.mock('expo-router', () => ({router: {push: jest.fn()}}));
jest.mock('@/utils/translationLookup', () => ({
  getTranslationTextRaw: (verseKey: string) => `T(${verseKey})`,
}));
jest.mock('@/utils/timestampUtils', () => ({getPlayFromHereTarget: jest.fn()}));
jest.mock('@/services/verse-annotations/VerseAnnotationService', () => ({
  verseAnnotationService: {
    addBookmark: jest.fn(async () => undefined),
    removeBookmark: jest.fn(async () => undefined),
    removeHighlight: jest.fn(async () => undefined),
  },
}));
jest.mock('@/store/verseAnnotationsStore', () => {
  const {create} = jest.requireActual('zustand');
  const store = create(() => ({
    bookmarks: new Set<string>(),
    isBookmarked(key: string) {
      return store.getState().bookmarks.has(key);
    },
    highlights: {} as Record<string, string>,
    addBookmark: jest.fn(),
    removeBookmark: jest.fn(),
    removeHighlight: jest.fn(),
  }));
  return {useVerseAnnotationsStore: store};
});
const mockPlayer = {
  rewayatId: 'r1' as string | null,
  currentPage: 1,
  stop: jest.fn(),
  setRange: jest.fn(),
  setVerseRepeatCount: jest.fn(),
  setRangeRepeatCount: jest.fn(),
  startPlayback: jest.fn(),
  setReciter: jest.fn(),
};
jest.mock('@/store/mushafPlayerStore', () => ({
  useMushafPlayerStore: {getState: () => mockPlayer, setState: jest.fn()},
}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {
    getState: () => ({
      queue: {
        tracks: [{rewayatId: 'r1', reciterName: 'Reciter'}],
        currentIndex: 0,
      },
      playback: {state: 'paused'},
      pause: jest.fn(),
      setSheetMode: jest.fn(),
    }),
  },
}));
jest.mock('@/store/timestampStore', () => ({
  useTimestampStore: {
    getState: () => ({supportedRewayatIds: new Set(['r1'])}),
  },
}));
jest.mock('@/services/mushaf/QulDataService', () => ({
  qulDataService: {
    hasSimilarVerses: jest.fn(async () => true),
    hasSharedPhrases: jest.fn(async () => true),
  },
}));

// Words in memory per rewayah ('ready'), or loading / failed.
const mockWords = {state: new Map<string, string>()};
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    rewayah: 'hafs',
    initialized: true,
    isRewayahReady: (r: string) => mockWords.state.get(r) === 'ready',
    getRewayahLoadState: (r: string) => mockWords.state.get(r) ?? 'idle',
    getVerseText: (key: string, r?: string) =>
      r === 'hafs' || r === undefined ? `HAFS-${key} ۝` : '',
    getPageForVerse: () => 3,
    subscribeCacheChanges: () => () => undefined,
    getCacheVersion: () => 0,
    ensureRewayahLoaded: jest.fn(async () => {
      throw new Error('not in tests');
    }),
  },
  getRewayahDataIdentityKey: (r: string) => `${r}@test`,
}));
const mockUnits = {
  models: new Map<string, unknown>(),
  status: new Map<string, string>(),
};
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => ({
  rewayahVerseUnitsService: {
    get: (r: string) => mockUnits.models.get(r) ?? null,
    getStatus: (r: string) => mockUnits.status.get(r) ?? 'error',
  },
}));

import {VerseActionsSheet} from '../VerseActionsSheet';
import * as Clipboard from 'expo-clipboard';
import {router} from 'expo-router';
import {showToast} from '@/utils/toastUtils';
import {qulDataService} from '@/services/mushaf/QulDataService';
import {verseAnnotationService} from '@/services/verse-annotations/VerseAnnotationService';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {
  buildRewayahVerseUnits,
  type RewayahVerseUnits,
  type VerseUnitSlot,
} from '@/services/mushaf/RewayahVerseUnits';

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
const warshText = (key: string) => warsh.unitText(warsh.unitByKey(key)!);
const WARSH_17_NOTE =
  'Translation of all of Hafs 1:7, which Warsh divides between verses 1:6 and 1:7.';

type Payload = React.ComponentProps<typeof VerseActionsSheet>['payload'];

let renderer: TestRenderer.ReactTestRenderer | null = null;

function root(): TestRenderer.ReactTestInstance {
  if (!renderer) throw new Error('nothing rendered');
  return renderer.root;
}

async function openSheet(payload: Payload) {
  const props = {
    sheetId: 'verse-actions',
    payload,
  } as React.ComponentProps<typeof VerseActionsSheet>;
  // One sheet at a time: a sheet left mounted would re-render on store
  // changes of later tests.
  if (renderer) act(() => renderer?.unmount());
  await act(async () => {
    renderer = TestRenderer.create(<VerseActionsSheet {...props} />);
  });
  // QUL availability lookups resolve on the next microtasks.
  await act(async () => {
    await Promise.resolve();
  });
}

/** Every string drawn in a Text. */
function texts(): string[] {
  return root()
    .findAll(n => (n.type as unknown) === Text)
    .flatMap(n =>
      ([] as unknown[])
        .concat(n.props.children)
        .filter((c): c is string => typeof c === 'string'),
    );
}

async function press(label: string) {
  const target = root()
    .findAll(
      n =>
        typeof n.props.onPress === 'function' &&
        n.findAll(c => c.props.children === label).length > 0,
    )
    .pop();
  if (!target) throw new Error(`nothing to press for ${label}`);
  await act(async () => {
    await target.props.onPress();
  });
}

const last = (name: string) => {
  const calls = mockScreens[name] ?? [];
  return calls[calls.length - 1];
};

/** A Warsh payload as a unit producer builds it (contract 4.1). */
function warshUnitPayload(unitKeys: string[], extra: Partial<Payload> = {}) {
  const units = unitKeys.map(k => warsh.unitByKey(k)!);
  const anchor = warsh.hafsAnchor(units[0]);
  const hafsKeys = [...new Set(units.flatMap(u => [...u.hafsKeys]))];
  return {
    verseKey: anchor.hafsKey,
    surahNumber: anchor.surah,
    ayahNumber: anchor.ayah,
    verseKeys: hafsKeys.length > 1 ? hafsKeys : undefined,
    unitKeys,
    rewayah: 'warsh' as const,
    source: 'mushaf' as const,
    ...extra,
  };
}

beforeEach(() => {
  for (const key of Object.keys(mockScreens)) delete mockScreens[key];
  jest.clearAllMocks();
  mockWords.state = new Map([
    ['hafs', 'ready'],
    ['warsh', 'ready'],
  ]);
  mockUnits.models = new Map([['warsh', warsh]]);
  mockUnits.status = new Map([['warsh', 'ready']]);
  mockPlayer.rewayatId = 'r1';
  (digitalKhattDataService.ensureRewayahLoaded as jest.Mock).mockImplementation(
    async () => {
      throw new Error('not in tests');
    },
  );
  useMushafSettingsStore.setState({rewayah: 'hafs', mushafRenderer: 'dk_v2'});
  setRows([]);
});

/** Stored bookmark / highlight rows (verse_keys), any rewayah. */
function setRows(bookmarks: string[], highlights: Record<string, string> = {}) {
  (
    useVerseAnnotationsStore as unknown as {
      setState: (s: object) => void;
    }
  ).setState({bookmarks: new Set(bookmarks), highlights});
}

const removedBookmarks = () =>
  (verseAnnotationService.removeBookmark as jest.Mock).mock.calls.map(
    call => call[0],
  );
const removedHighlights = () =>
  (verseAnnotationService.removeHighlight as jest.Mock).mock.calls.map(
    call => call[0],
  );

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

describe('Hafs (unchanged)', () => {
  const payload = {
    verseKey: '2:255',
    surahNumber: 2,
    ayahNumber: 255,
    source: 'mushaf' as const,
  };

  it('labels, copies and bookmarks the Hafs verse as before', async () => {
    await openSheet(payload);
    expect(texts()).toEqual(expect.arrayContaining(['Al-Baqarah', '2:255']));
    await press('Copy');
    // The copy layout from before the verse units.
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
      'HAFS-2:255 ۝\n\nT(2:255)\n\nQuran 2:255',
    );
    await openSheet(payload);
    await press('Bookmark');
    expect(verseAnnotationService.addBookmark).toHaveBeenCalledWith(
      '2:255',
      2,
      255,
      'hafs',
    );
    expect(qulDataService.hasSimilarVerses).toHaveBeenCalledWith('2:255');
  });

  it('copies a range with every translation and a range citation', async () => {
    await openSheet({
      ...payload,
      verseKey: '2:286',
      ayahNumber: 286,
      verseKeys: ['2:286', '3:1'],
    });
    expect(texts()).toContain('2:286 - 3:1');
    await press('Copy');
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
      'HAFS-2:286 ۝ HAFS-3:1 ۝\n\nT(2:286)\nT(3:1)\n\nQuran 2:286 - 3:1',
    );
  });

  it('removes exactly the bookmarked Hafs key, as before', async () => {
    setRows(['2:255']);
    await openSheet(payload);
    expect(texts()).toContain('Remove Bookmark');
    await press('Remove Bookmark');
    expect(removedBookmarks()).toEqual(['2:255']);
    expect(verseAnnotationService.addBookmark).not.toHaveBeenCalled();
  });

  it('a row of another rewayah inside the Hafs verse is no Hafs mark', async () => {
    setRows(['2:255:3'], {'2:255:3': 'yellow'});
    await openSheet(payload);
    expect(texts()).toEqual(expect.arrayContaining(['Bookmark', 'Highlight']));
  });

  it('removes every selected Hafs highlight, as before', async () => {
    setRows([], {'2:286': 'yellow'});
    await openSheet({
      ...payload,
      verseKey: '2:286',
      ayahNumber: 286,
      verseKeys: ['2:286', '3:1'],
    });
    await press('Remove Highlight');
    expect(removedHighlights()).toEqual(['2:286', '3:1']);
  });

  it('passes the screens the payload as before', async () => {
    await openSheet(payload);
    await press('Share');
    expect(last('share')).toMatchObject({
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
      verseKeys: undefined,
      unitKeys: undefined,
      rewayah: 'hafs',
    });
    await openSheet(payload);
    await press('Translation');
    expect(last('translation')).toMatchObject({
      surahNumber: 2,
      ayahNumber: 255,
      unitStart: undefined,
    });
  });
});

describe('Warsh verses in their own numbering', () => {
  it('copies exactly the verse, its paired translation and its own citation', async () => {
    await openSheet(warshUnitPayload(['1:7']));
    expect(texts()).toEqual(expect.arrayContaining(['Al-Fatihah', '1:7']));
    await press('Copy');
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
      `${warshText('1:7')}\n\nT(1:7)\n${WARSH_17_NOTE}\n\nQuran 1:7 · Warsh`,
    );
    expect(warshText('1:7').endsWith('۝٧')).toBe(true);
  });

  it('stores the verse at its Hafs anchor, never a Warsh number', async () => {
    await openSheet(warshUnitPayload(['1:7']));
    await press('Bookmark');
    expect(verseAnnotationService.addBookmark).toHaveBeenCalledTimes(1);
    expect(verseAnnotationService.addBookmark).toHaveBeenCalledWith(
      '1:7:5',
      1,
      7,
      'warsh',
    );
  });

  it('a Hafs-keyed payload selects the Warsh verses holding the Hafs verse', async () => {
    await openSheet({
      verseKey: '1:7',
      surahNumber: 1,
      ayahNumber: 7,
      rewayah: 'warsh',
      source: 'mushaf',
    });
    expect(texts()).toContain('1:6-7');
    await press('Copy');
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
      `${warshText('1:6')}\n${warshText('1:7')}\n\nT(1:7)\n\nQuran 1:6-7 · Warsh`,
    );
  });

  it('a verse spanning two Hafs verses copies both translations', async () => {
    await openSheet(warshUnitPayload(['103:1']));
    expect(texts()).toContain('103:1');
    await press('Copy');
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
      `${warshText('103:1')}\n\nT(103:1)\nT(103:2)\n\nQuran 103:1 · Warsh`,
    );
    // QUL data is per Hafs verse: not offered for a merged verse.
    expect(qulDataService.hasSimilarVerses).not.toHaveBeenCalled();
  });

  it('offers QUL for a verse that is one whole Hafs verse, with Hafs references', async () => {
    // Warsh 1:5 is Hafs 1:6.
    await openSheet(warshUnitPayload(['1:5']));
    expect(qulDataService.hasSimilarVerses).toHaveBeenCalledWith('1:6');
    await press('Similar Verses');
    expect(last('similar')).toMatchObject({
      verseKey: '1:6',
      section: 'similar',
      hafsReferences: true,
    });
  });

  it('passes the screens the selected verses', async () => {
    await openSheet(warshUnitPayload(['1:7']));
    await press('Share');
    expect(last('share')).toMatchObject({unitKeys: ['1:7'], rewayah: 'warsh'});
    await openSheet(warshUnitPayload(['1:7']));
    await press('Highlight');
    expect(last('highlight')).toMatchObject({
      selection: {
        rewayah: 'warsh',
        keys: ['1:7'],
        anchors: [{key: '1:7:5', surah: 1, ayah: 7}],
      },
    });
    await openSheet(warshUnitPayload(['1:7']));
    await press('Translation');
    const translation = last('translation');
    expect((translation.unitStart as {unit: {key: string}}).unit.key).toBe(
      '1:7',
    );
  });

  it('plays from the Hafs verse holding the selection until area B takes units', async () => {
    await openSheet(warshUnitPayload(['103:1']));
    await press('Repeat');
    expect(mockPlayer.setRange).toHaveBeenCalledWith(
      {surah: 103, ayah: 1},
      {surah: 103, ayah: 2},
    );
    // One Warsh verse spanning two Hafs verses loops as a range.
    expect(mockPlayer.setVerseRepeatCount).toHaveBeenCalledWith(1);
    expect(mockPlayer.startPlayback).toHaveBeenCalledWith(3, '103:1');
  });

  it('a player Repeat of a verse starting inside a Hafs verse passes its anchor', async () => {
    await openSheet(warshUnitPayload(['1:7'], {source: 'player'}));
    await press('Repeat');
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/mushaf',
      params: {page: '3', surah: '1', ayah: '7', anchor: '1:7:5'},
    });
  });
});

describe('stored rows that mark a Warsh verse (contract section 3)', () => {
  // A Warsh row saved before Release 1 on Hafs 103:2: Warsh 103:1 holds
  // Hafs 103:1 and 103:2, so the row marks Warsh 103:1.
  it('a legacy bookmark on its second Hafs verse marks it and is removed', async () => {
    setRows(['103:2']);
    await openSheet(warshUnitPayload(['103:1']));
    expect(texts()).toContain('Remove Bookmark');
    await press('Remove Bookmark');
    // Its own anchor (as always) and the legacy row; nothing added.
    expect(removedBookmarks()).toEqual(['103:1', '103:2']);
    expect(verseAnnotationService.addBookmark).not.toHaveBeenCalled();
  });

  it('a Hafs-keyed payload sees the same row', async () => {
    setRows(['103:2']);
    await openSheet({
      verseKey: '103:2',
      surahNumber: 103,
      ayahNumber: 2,
      rewayah: 'warsh',
      source: 'mushaf',
    });
    expect(texts()).toEqual(
      expect.arrayContaining(['103:1', 'Remove Bookmark']),
    );
  });

  it('a row naming the first part of a split Hafs verse marks only it', async () => {
    setRows(['1:7']);
    await openSheet(warshUnitPayload(['1:7']));
    expect(texts()).toContain('Bookmark');
    await press('Bookmark');
    expect(verseAnnotationService.addBookmark).toHaveBeenCalledWith(
      '1:7:5',
      1,
      7,
      'warsh',
    );
  });

  it('a legacy highlight marks it and every row is removed', async () => {
    setRows([], {'103:2': 'yellow'});
    await openSheet(warshUnitPayload(['103:1']));
    expect(texts()).toContain('Remove Highlight');
    await press('Remove Highlight');
    expect(removedHighlights()).toEqual(['103:1', '103:2']);
    expect(last('highlight')).toBeUndefined();
  });
});

describe('when the Warsh verses cannot be named', () => {
  it('shows no verse number while the units load', async () => {
    mockUnits.models = new Map();
    mockUnits.status = new Map([['warsh', 'loading']]);
    mockWords.state = new Map([
      ['hafs', 'ready'],
      ['warsh', 'loading'],
    ]);
    // The words are on their way: the load does not settle in this test.
    (
      digitalKhattDataService.ensureRewayahLoaded as jest.Mock
    ).mockImplementation(() => new Promise(() => undefined));
    await openSheet(warshUnitPayload(['1:7']));
    const shown = texts();
    expect(shown).toContain('Al-Fatihah');
    expect(shown.some(t => /\d+:\d+/.test(t))).toBe(false);
  });

  it('copies nothing and says why when the units were refused', async () => {
    mockUnits.models = new Map();
    mockUnits.status = new Map([['warsh', 'error']]);
    await openSheet(warshUnitPayload(['1:7']));
    expect(texts().some(t => /\d+:\d+/.test(t))).toBe(false);
    await press('Copy');
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      "Couldn't load the Warsh text",
      'Nothing was copied. Please try again.',
      'error',
    );
    await press('Bookmark');
    expect(verseAnnotationService.addBookmark).not.toHaveBeenCalled();
  });

  it('the unnumbered Fatiha basmala is no verse', async () => {
    await openSheet({
      verseKey: '1:1',
      surahNumber: 1,
      ayahNumber: 1,
      rewayah: 'warsh',
      source: 'mushaf',
    });
    expect(texts().some(t => /\d+:\d+/.test(t))).toBe(false);
    await press('Copy');
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      'Not a numbered verse in Warsh',
      'Nothing was copied.',
      'error',
    );
  });
});
