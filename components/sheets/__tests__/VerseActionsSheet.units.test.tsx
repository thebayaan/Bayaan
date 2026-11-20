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
// The sheet's lists and footers as plain views: no sheet here.
jest.mock('../verse-actions/sheetGestures');
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
// As the real screen, Word Study binds ← and → itself (iPad).
const mockWordStudyKeys = {left: jest.fn(), right: jest.fn()};
const mockWordStudyBindings = [
  {
    key: 'left',
    title: 'Next word',
    menu: 'reader',
    run: () => mockWordStudyKeys.left(),
  },
  {
    key: 'right',
    title: 'Previous word',
    menu: 'reader',
    run: () => mockWordStudyKeys.right(),
  },
];
// @ai-start
jest.mock('../verse-actions/WordStudyContent', () => ({
  WordStudyContent: (props: Record<string, unknown>) => {
    jest
      .requireActual('@/hooks/useKeyCommands')
      .useKeyCommands(mockWordStudyBindings);
    return mockRecord('words', props);
  },
}));
jest.mock('@/components/search/quran/RootResults', () => ({
  RootResults: (props: Record<string, unknown>) => mockRecord('root', props),
}));
// @ai-end
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
// The root stack's routes when root search opens an ayah: the tabs, and the
// reader when one is open. The container's state nests the app's root stack
// under expo-router's own root route.
const mockRootStack: {routes: {name: string}[]} = {routes: []};
jest.mock('expo-router', () => {
  const router = {push: jest.fn(), dismissTo: jest.fn()};
  return {
    router,
    useRouter: () => router,
    useNavigationContainerRef: () => ({
      isReady: () => true,
      getRootState: () => ({
        routeNames: ['__root'],
        routes: [
          {
            name: '__root',
            state: {
              routeNames: ['(tabs)', 'mushaf', 'mushaf/[page]'],
              routes: mockRootStack.routes,
            },
          },
        ],
      }),
    }),
  };
});
jest.mock('@/utils/translationLookup', () => ({
  getTranslationTextRaw: (verseKey: string) => `T(${verseKey})`,
}));
jest.mock('@/utils/timestampUtils', () => ({getPlayFromHereTarget: jest.fn()}));
// The real annotations store over a mocked database service.
jest.mock('@/services/verse-annotations/VerseAnnotationService', () => ({
  verseAnnotationService: {
    addBookmark: jest.fn(async () => undefined),
    removeBookmark: jest.fn(async () => undefined),
    upsertHighlight: jest.fn(async () => undefined),
    removeHighlight: jest.fn(async () => undefined),
    addNote: jest.fn(async () => undefined),
    applyAnnotationChanges: jest.fn(async () => undefined),
    getAnnotationsForSurah: jest.fn(async () => ({
      bookmarks: [],
      notes: [],
      highlights: [],
    })),
  },
}));
const mockPlayer = {
  rewayatId: 'r1' as string | null,
  currentPage: 1,
  stop: jest.fn(),
  setRange: jest.fn(),
  setVerseRepeatCount: jest.fn(),
  setRangeRepeatCount: jest.fn(),
  startPlayback: jest.fn(),
  setReciter: jest.fn(),
  setUnitRange: jest.fn(), // @ai
  setPendingStart: jest.fn(), // @ai
};
jest.mock('@/store/mushafPlayerStore', () => ({
  useMushafPlayerStore: {getState: () => mockPlayer, setState: jest.fn()},
}));
// One setSheetMode across getState() calls, so a collapse is seen.
const mockMainPlayer = {setSheetMode: jest.fn()}; // @ai
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {
    getState: () => ({
      queue: {
        tracks: [{rewayatId: 'r1', reciterName: 'Reciter'}],
        currentIndex: 0,
      },
      playback: {state: 'paused'},
      pause: jest.fn(),
      setSheetMode: mockMainPlayer.setSheetMode, // @ai
    }),
  },
}));
jest.mock('@/store/timestampStore', () => ({
  useTimestampStore: {
    getState: () => ({supportedRewayatIds: new Set(['r1'])}),
  },
  // @ai — the main player's Play from here target (store/timestampStore)
  resolvePlayFromHere: jest.fn(() => ({
    status: 'unavailable',
    title: 'Not now',
    message: 'No timing',
  })),
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
    retainRewayah: () => () => undefined,
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
  rewayahVerseUnitsService: jest
    .requireActual('@/services/mushaf/__fixtures__/verseUnitsServiceStub')
    .verseUnitsServiceStub({
      peek: (r: string) => mockUnits.models.get(r) ?? null,
      status: (r: string) => mockUnits.status.get(r) ?? 'error',
    }),
}));

import {VerseActionsSheet} from '../VerseActionsSheet';
import * as Clipboard from 'expo-clipboard';
import {router} from 'expo-router';
import {showToast} from '@/utils/toastUtils';
import {resolvePlayFromHere} from '@/store/timestampStore'; // @ai
import {qulDataService} from '@/services/mushaf/QulDataService';
import {verseAnnotationService} from '@/services/verse-annotations/VerseAnnotationService';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
// @ai-start
import {SheetManager} from 'react-native-actions-sheet';
import {useVerseSelectionStore} from '@/store/verseSelectionStore';
import {useMushafVerseSelectionStore} from '@/store/mushafVerseSelectionStore';
// @ai-end
import {setStoredRows as setRows} from '../verse-actions/__fixtures__/storedRows';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {
  addKeyLayer,
  pressKeyForTests,
  resetKeyCommandsForTests,
  type KeyId,
} from '@/services/keyboard/keyCommands';
import {BayaanKeyboard} from '@/modules/bayaan-keyboard';
import {
  buildRewayahVerseUnits,
  type RewayahVerseUnits,
  type VerseUnitSlot,
} from '@/services/mushaf/RewayahVerseUnits';
import type {AnnotationRowChanges} from '@/types/verse-annotations';

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

// @ai-start
// react-native-actions-sheet's CloseRequestType (its entry does not export
// it): why the sheet is asked to close.
const SWIPE = 0;
const BACK_PRESS = 1; // Android's back button or back gesture
const TOUCH_BACKDROP = 2;

/**
 * The sheet's onRequestClose as the library got it now (call it right after
 * openSheet for the first render's: the library memoizes its back handler
 * without it, so it can keep calling that one). Resolves true when the
 * sheet may close; false keeps it open.
 */
function closeRequests(): (type: number) => Promise<boolean> {
  const sheet = root().find(n => typeof n.props.onRequestClose === 'function');
  const onRequestClose = sheet.props.onRequestClose as (
    type: number,
  ) => boolean;
  return async type => {
    let closes = true;
    await act(async () => {
      closes = onRequestClose(type);
    });
    return closes;
  };
}
// @ai-end

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
  mockRootStack.routes = [{name: '(tabs)'}];
  (digitalKhattDataService.ensureRewayahLoaded as jest.Mock).mockImplementation(
    async () => {
      throw new Error('not in tests');
    },
  );
  useMushafSettingsStore.setState({rewayah: 'hafs', mushafRenderer: 'dk_v2'});
  setRows([]);
});

/** The change set of each unit-API write (one transaction each). */
const changeSets = (): AnnotationRowChanges[] =>
  (verseAnnotationService.applyAnnotationChanges as jest.Mock).mock.calls.map(
    call => call[0],
  );
// Rows deleted: one call per Hafs key (Hafs), or in a change set (units).
const removedBookmarks = () => [
  ...(verseAnnotationService.removeBookmark as jest.Mock).mock.calls.map(
    call => call[0],
  ),
  ...changeSets().flatMap(c => c.removeBookmarks ?? []),
];
const removedHighlights = () => [
  ...(verseAnnotationService.removeHighlight as jest.Mock).mock.calls.map(
    call => call[0],
  ),
  ...changeSets().flatMap(c => c.removeHighlights ?? []),
];
const warshBookmark = (verseKey: string) => {
  const [surahNumber, ayahNumber] = verseKey.split(':').map(Number);
  return {verseKey, surahNumber, ayahNumber, rewayahId: 'warsh'};
};

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
    setRows(['2:255'], {}, 'hafs');
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
    setRows([], {'2:286': 'yellow'}, 'hafs');
    await openSheet({
      ...payload,
      verseKey: '2:286',
      ayahNumber: 286,
      verseKeys: ['2:286', '3:1'],
    });
    await press('Remove Highlight');
    expect(removedHighlights()).toEqual(['2:286', '3:1']);
  });

  it('copies the translation the player passes for its verse', async () => {
    await openSheet({...payload, translation: 'SHOWN'});
    await press('Copy');
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
      'HAFS-2:255 ۝\n\nSHOWN\n\nQuran 2:255',
    );
  });

  // @ai-start
  // The player shows Saheeh with tappable footnotes, so the text it passes
  // carries their markers. Pasted, they read `<sup foot_note="…">1</sup>`.
  it('copies a translation without its footnote markers', async () => {
    await openSheet({
      ...payload,
      translation:
        'the Ever-Living,<sup foot_note="226497">1</sup> the Self-Sustaining.<sup foot_note="226498">2</sup> Neither',
    });
    await press('Copy');
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
      'HAFS-2:255 ۝\n\nthe Ever-Living, the Self-Sustaining. Neither\n\nQuran 2:255',
    );
  });
  // @ai-end

  it('a player Repeat routes to the Hafs verse without an anchor', async () => {
    await openSheet({...payload, source: 'player'});
    await press('Repeat');
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/mushaf',
      params: {surah: '2', ayah: '255', playerOptions: '1'},
    });
  });

  // RFC-023 step 1: the player can show this sheet before the Mushaf data
  // loads. The reader finds the page and shows the options (app/mushaf.tsx).
  it('a player Repeat looks up no page and leaves the options to the reader', async () => {
    const setStoreState = jest.requireMock('@/store/mushafPlayerStore')
      .useMushafPlayerStore.setState as jest.Mock;
    (SheetManager.show as jest.Mock).mockClear();
    setStoreState.mockClear();
    await openSheet({...payload, source: 'player'});
    await press('Repeat');
    expect(SheetManager.show).not.toHaveBeenCalledWith(
      'mushaf-player-options',
      expect.anything(),
    );
    expect(setStoreState).toHaveBeenCalledWith({
      pendingStartVerseKey: '2:255',
    });
    expect(setStoreState).toHaveBeenCalledTimes(1);
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
    // @ai-start
    await openSheet(payload);
    await press('Word Study');
    expect(last('words')).toMatchObject({
      study: {rewayah: 'hafs', parts: [{verseKey: '2:255', caption: 'none'}]},
      initialWord: undefined,
    });
    expect(texts()).toContain('Word Study');
    // @ai-end
  });

  // @ai-start
  it('offers Word Study for a range, after Translation, with every verse', async () => {
    await openSheet({
      ...payload,
      verseKey: '2:1',
      ayahNumber: 1,
      verseKeys: ['2:1', '2:2'],
    });
    const shown = texts();
    // The single-verse rows are gone; Word Study follows Translation.
    expect(shown).not.toContain('Tafseer');
    expect(shown.indexOf('Word Study')).toBe(shown.indexOf('Translation') + 1);
    await press('Word Study');
    expect(last('words')).toMatchObject({
      study: {
        rewayah: 'hafs',
        parts: [
          {verseKey: '2:1', caption: 'verse'},
          {verseKey: '2:2', caption: 'verse'},
        ],
      },
    });
  });

  it('a word long-press payload opens Word Study first, on that word', async () => {
    await openSheet({
      ...payload,
      initialScreen: 'words',
      word: {verseKey: '2:255', position: 3},
    });
    expect(last('words')).toMatchObject({
      study: {parts: [{verseKey: '2:255'}]},
      initialWord: {verseKey: '2:255', position: 3},
    });
    // The back row is titled Word Study and returns to the verse's actions.
    expect(texts()).not.toContain('Copy');
    await press('Word Study');
    expect(texts()).toEqual(expect.arrayContaining(['Copy', '2:255']));
    // The row opens it again on the first word.
    await press('Word Study');
    expect(last('words')).toMatchObject({initialWord: undefined});
  });

  it('a root opens root search; Back returns to the same word', async () => {
    await openSheet(payload);
    await press('Word Study');
    const onRootPress = last('words').onRootPress as (
      root: string,
      lemma: string | null,
      word: unknown,
    ) => void;
    expect(onRootPress).toEqual(expect.any(Function));
    await act(async () =>
      onRootPress('ء ل ه', 'ٱللَّه', {verseKey: '2:255', position: 1}),
    );
    expect(last('root')).toMatchObject({
      root: 'ء ل ه',
      initialLemma: 'ٱللَّه',
    });
    // Hafs: each ayah by its Hafs verse, as in the Search tab.
    const verseLabel = last('root').verseLabel as (hit: unknown) => string;
    expect(
      verseLabel({
        verseIndex: 0,
        verseKey: '2:255',
        matches: [{position: 1, length: 1}],
        score: 1,
      }),
    ).toBe('Al-Baqarah 2:255');
    expect(last('root')).toMatchObject({hafsNote: false});
    expect(texts()).toContain('Root search');
    await press('Root search');
    expect(last('words')).toMatchObject({
      initialWord: {verseKey: '2:255', position: 1},
    });
    expect(texts()).toContain('Word Study');
  });

  it("Android's back steps back a screen; from the menu it closes the sheet", async () => {
    // The sheet is a Modal: Android's back reaches it only as
    // onRequestClose (BackHandler never hears it while the sheet is up).
    await openSheet(payload);
    const request = closeRequests();
    expect(await request(BACK_PRESS)).toBe(true);
    await press('Translation');
    // A swipe or a backdrop tap closes it from any screen, as before.
    expect(await request(SWIPE)).toBe(true);
    expect(await request(TOUCH_BACKDROP)).toBe(true);
    expect(texts()).not.toContain('Copy');
    // Back returns to the verse's actions and keeps the sheet open.
    expect(await request(BACK_PRESS)).toBe(false);
    expect(texts()).toEqual(expect.arrayContaining(['Copy', '2:255']));
    // Root search goes back to Word Study, Word Study to the actions.
    await press('Word Study');
    const onRootPress = last('words').onRootPress as (
      root: string,
      lemma: string | null,
      word: unknown,
    ) => void;
    await act(async () =>
      onRootPress('ء ل ه', null, {verseKey: '2:255', position: 1}),
    );
    expect(await request(BACK_PRESS)).toBe(false);
    expect(texts()).toContain('Word Study');
    expect(last('words')).toMatchObject({
      initialWord: {verseKey: '2:255', position: 1},
    });
    expect(await request(BACK_PRESS)).toBe(false);
    expect(texts()).toContain('Copy');
    expect(SheetManager.hide).not.toHaveBeenCalled();
  });

  /** Opens root search from Word Study and taps its ayah 1:3. */
  async function openRootAyah() {
    await press('Word Study');
    const onRootPress = last('words').onRootPress as (
      root: string,
      lemma: string | null,
      word: unknown,
    ) => void;
    await act(async () =>
      onRootPress('ر ح م', null, {verseKey: '1:1', position: 3}),
    );
    const onVersePress = last('root').onVersePress as (hit: unknown) => void;
    await act(async () =>
      onVersePress({
        verseIndex: 0,
        verseKey: '1:3',
        matches: [{position: 1, length: 1}],
        score: 1,
      }),
    );
  }

  // No page: the reader opens the page of the first matched word.
  const ROOT_AYAH_HREF = {
    pathname: '/mushaf',
    params: {surah: '1', ayah: '3', anchor: '1:3:1', words: '1'},
  };

  it('from the reader, an ayah of the root turns the open reader to its words', async () => {
    // The sheet is over the reader: the hit goes to that reader (one reader
    // stays: components/mushaf/__tests__/quranHitStack.test.ts), never a
    // second one pushed on top of it.
    mockRootStack.routes = [{name: '(tabs)'}, {name: 'mushaf'}];
    await openSheet(payload);
    await openRootAyah();
    expect(SheetManager.hide).toHaveBeenCalledWith('verse-actions');
    expect(router.dismissTo).toHaveBeenCalledTimes(1);
    expect(router.dismissTo).toHaveBeenLastCalledWith(ROOT_AYAH_HREF);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('with no reader open, an ayah of the root opens the Mushaf on its words', async () => {
    await openSheet({...payload, source: 'player'});
    await openRootAyah();
    expect(router.push).toHaveBeenLastCalledWith(ROOT_AYAH_HREF);
    expect(router.dismissTo).not.toHaveBeenCalled();
  });

  it('from the player over the open reader, an ayah of the root goes to that reader', async () => {
    mockRootStack.routes = [{name: '(tabs)'}, {name: 'mushaf'}];
    await openSheet({...payload, source: 'player'});
    await openRootAyah();
    expect(mockMainPlayer.setSheetMode).toHaveBeenCalledWith('hidden');
    expect(router.dismissTo).toHaveBeenLastCalledWith(ROOT_AYAH_HREF);
    expect(router.push).not.toHaveBeenCalled();
    const dismissTo = router.dismissTo as jest.Mock;
    expect(
      mockMainPlayer.setSheetMode.mock.invocationCallOrder[0],
    ).toBeLessThan(dismissTo.mock.invocationCallOrder[0]);
  });

  it('from the player, an ayah of the root collapses the player before the Mushaf opens', async () => {
    // The open player is drawn above every route: pushed behind it, the
    // Mushaf would open out of sight.
    await openSheet({...payload, source: 'player'});
    await press('Word Study');
    const onRootPress = last('words').onRootPress as (
      root: string,
      lemma: string | null,
      word: unknown,
    ) => void;
    await act(async () =>
      onRootPress('ر ح م', null, {verseKey: '1:1', position: 3}),
    );
    const onVersePress = last('root').onVersePress as (hit: unknown) => void;
    await act(async () =>
      onVersePress({
        verseIndex: 0,
        verseKey: '1:3',
        matches: [{position: 1, length: 1}],
        score: 1,
      }),
    );
    expect(SheetManager.hide).toHaveBeenCalledWith('verse-actions');
    expect(mockMainPlayer.setSheetMode).toHaveBeenCalledWith('hidden');
    expect(router.push).toHaveBeenCalledTimes(1);
    const push = router.push as jest.Mock;
    expect(
      mockMainPlayer.setSheetMode.mock.invocationCallOrder[0],
    ).toBeLessThan(push.mock.invocationCallOrder[0]);
  });

  it('a long-press in Word by Word studies that word', async () => {
    await openSheet(payload);
    await press('Word by Word');
    const onOpenWord = last('wbw').onOpenWord as (word: unknown) => void;
    await act(async () => onOpenWord({verseKey: '2:255', position: 5}));
    expect(last('words')).toMatchObject({
      study: {parts: [{verseKey: '2:255'}]},
      initialWord: {verseKey: '2:255', position: 5},
    });
    expect(texts()).toContain('Word Study');
  });

  /** Word by Word, then a long-press on word 5: Word Study at that word. */
  async function studyFromWordByWord() {
    await press('Word by Word');
    const onOpenWord = last('wbw').onOpenWord as (word: unknown) => void;
    await act(async () => onOpenWord({verseKey: '2:255', position: 5}));
    expect(texts()).toContain('Word Study');
  }

  it('Back from Word Study opened in Word by Word returns to Word by Word, then to the menu', async () => {
    await openSheet(payload);
    await studyFromWordByWord();
    const wbwShown = (mockScreens.wbw ?? []).length;
    await press('Word Study');
    expect(texts()).toContain('Word by Word');
    expect(texts()).not.toContain('Copy');
    expect((mockScreens.wbw ?? []).length).toBeGreaterThan(wbwShown);
    await press('Word by Word');
    expect(texts()).toEqual(expect.arrayContaining(['Copy', '2:255']));
    // Word Study from the menu row still goes back to the menu.
    await press('Word Study');
    await press('Word Study');
    expect(texts()).toEqual(expect.arrayContaining(['Copy', '2:255']));
  });

  it("Android's back from Word Study opened in Word by Word, and from its root search, steps back to Word by Word", async () => {
    await openSheet(payload);
    const request = closeRequests();
    await studyFromWordByWord();
    const onRootPress = last('words').onRootPress as (
      root: string,
      lemma: string | null,
      word: unknown,
    ) => void;
    await act(async () =>
      onRootPress('ء ل ه', null, {verseKey: '2:255', position: 5}),
    );
    expect(await request(BACK_PRESS)).toBe(false);
    expect(last('words')).toMatchObject({
      initialWord: {verseKey: '2:255', position: 5},
    });
    expect(await request(BACK_PRESS)).toBe(false);
    expect(texts()).toContain('Word by Word');
    expect(texts()).not.toContain('Copy');
    expect(await request(BACK_PRESS)).toBe(false);
    expect(texts()).toContain('Copy');
    expect(await request(BACK_PRESS)).toBe(true);
    expect(SheetManager.hide).not.toHaveBeenCalled();
  });
  // @ai-end
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
    expect(changeSets()).toEqual([{addBookmarks: [warshBookmark('1:7:5')]}]);
    await openSheet(warshUnitPayload(['1:6']));
    await press('Bookmark');
    expect(changeSets()[1]).toEqual({addBookmarks: [warshBookmark('1:7:1')]});
    expect(verseAnnotationService.addBookmark).not.toHaveBeenCalled();
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
    // @ai-start
    await openSheet(warshUnitPayload(['1:7']));
    await press('Word Study');
    // Warsh 1:7's own words: Hafs 1:7 from its fifth slot.
    expect(last('words')).toMatchObject({
      study: {
        rewayah: 'warsh',
        parts: [
          {
            verseKey: '1:7',
            caption: 'hafsVerse',
            wordRange: {first: 5, last: 10},
          },
        ],
      },
    });
    // @ai-end
  });

  // @ai-start
  it('opens Word Study on a Warsh verse at the long-pressed Hafs word', async () => {
    await openSheet(
      warshUnitPayload(['1:7'], {
        initialScreen: 'words',
        word: {verseKey: '1:7', position: 6},
      }),
    );
    expect(last('words')).toMatchObject({
      study: {
        rewayah: 'warsh',
        parts: [{verseKey: '1:7', wordRange: {first: 5, last: 10}}],
      },
      initialWord: {verseKey: '1:7', position: 6},
    });
  });
  // @ai-end

  // @ai-start
  it('repeats exactly the selected Warsh verse, as one verse', async () => {
    await openSheet(warshUnitPayload(['103:1']));
    await press('Repeat');
    // Warsh 103:1 holds Hafs 103:1 + 103:2: one verse, looped as a verse.
    const unit = warsh.unitByKey('103:1');
    expect(mockPlayer.setUnitRange).toHaveBeenCalledWith(unit, unit);
    expect(mockPlayer.setRange).not.toHaveBeenCalled();
    expect(mockPlayer.setVerseRepeatCount).toHaveBeenCalledWith(0);
    expect(mockPlayer.setRangeRepeatCount).toHaveBeenCalledWith(0);
    expect(mockPlayer.startPlayback).toHaveBeenCalledWith(3, unit);
  });

  it('plays from the selected Warsh verse to the end of its surah', async () => {
    await openSheet(warshUnitPayload(['1:7']));
    await press('Play from Here');
    const unit = warsh.unitByKey('1:7');
    const surah = warsh.unitsOfSurah(1);
    expect(mockPlayer.setUnitRange).toHaveBeenCalledWith(
      unit,
      surah[surah.length - 1],
    );
    expect(mockPlayer.setVerseRepeatCount).toHaveBeenCalledWith(1);
    expect(mockPlayer.setRangeRepeatCount).toHaveBeenCalledWith(1);
    expect(mockPlayer.startPlayback).toHaveBeenCalledWith(3, unit);
  });

  it('keeps the selected Warsh verse as the start while a reciter is chosen', async () => {
    mockPlayer.rewayatId = null;
    await openSheet(warshUnitPayload(['1:7']));
    await press('Repeat');
    expect(mockPlayer.setPendingStart).toHaveBeenCalledWith(
      warsh.unitByKey('1:7'),
    );
    expect(mockPlayer.startPlayback).not.toHaveBeenCalled();
  });
  // @ai-end

  // @ai-start
  it("the main player's Play from here starts at the selected Warsh verse itself", async () => {
    // Warsh 1:7 is the second part of Hafs 1:7: the target is resolved for
    // the unit (exactly its own timing entry when the timings are numbered
    // by Warsh), never for Hafs 1:7 as a whole.
    await openSheet(warshUnitPayload(['1:7'], {source: 'player'}));
    await press('Play from Here');
    expect(resolvePlayFromHere).toHaveBeenCalledTimes(1);
    expect(resolvePlayFromHere).toHaveBeenCalledWith(warsh.unitByKey('1:7'));
    expect(showToast).toHaveBeenCalledWith('Not now', 'No timing', 'error');
  });

  it("the main player's Play from here of a Hafs verse resolves its Hafs key", async () => {
    await openSheet({
      verseKey: '1:7',
      surahNumber: 1,
      ayahNumber: 7,
      rewayah: 'hafs',
      source: 'player',
    });
    await press('Play from Here');
    expect(resolvePlayFromHere).toHaveBeenCalledWith('1:7');
  });
  // @ai-end

  it('a player Repeat of a verse starting inside a Hafs verse passes its anchor', async () => {
    await openSheet(warshUnitPayload(['1:7'], {source: 'player'}));
    await press('Repeat');
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/mushaf',
      params: {surah: '1', ayah: '7', anchor: '1:7:5', playerOptions: '1'},
    });
    // The mushaf player starts at Warsh 1:7 itself. @ai
    expect(mockPlayer.setPendingStart).toHaveBeenCalledWith(
      warsh.unitByKey('1:7'),
    );
  });

  it('a player Repeat of the first part of a split Hafs verse names it', async () => {
    // Warsh 1:6 is Hafs 1:7 words 1-4: surah / ayah alone would name every
    // Warsh verse holding Hafs 1:7 (1:6 and 1:7); its anchor names 1:6.
    await openSheet(warshUnitPayload(['1:6'], {source: 'player'}));
    await press('Repeat');
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/mushaf',
      params: {surah: '1', ayah: '7', anchor: '1:7:1', playerOptions: '1'},
    });
  });

  it("uses the player's translation only for a verse that is its Hafs verse", async () => {
    // Warsh 1:5 is exactly Hafs 1:6: the translation shown for it is used.
    await openSheet({
      verseKey: '1:6',
      surahNumber: 1,
      ayahNumber: 6,
      rewayah: 'warsh',
      source: 'player',
      translation: 'SHOWN',
    });
    await press('Copy');
    expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith(
      `${warshText('1:5')}\n\nSHOWN\n\nQuran 1:5 · Warsh`,
    );
    // Warsh 103:1 reads Hafs 103:1 and 103:2: each its own translation, not
    // the one the player showed for Hafs 103:1 twice.
    await openSheet({
      verseKey: '103:1',
      surahNumber: 103,
      ayahNumber: 1,
      rewayah: 'warsh',
      source: 'player',
      translation: 'SHOWN',
    });
    await press('Copy');
    expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith(
      `${warshText('103:1')}\n\nT(103:1)\nT(103:2)\n\nQuran 103:1 · Warsh`,
    );
  });

  it('root search names its ayahs in Warsh numbering, never bare Hafs numbers', async () => {
    const rootHit = (verseKey: string, position: number) => ({
      verseIndex: 0,
      verseKey,
      matches: [{position, length: 1}],
      score: 1,
    });
    await openSheet(warshUnitPayload(['106:5']));
    await press('Word Study');
    const onRootPress = last('words').onRootPress as (
      root: string,
      lemma: string | null,
      word: unknown,
    ) => void;
    await act(async () =>
      onRootPress('خ و ف', null, {verseKey: '106:4', position: 7}),
    );
    const verseLabel = last('root').verseLabel as (hit: unknown) => string;
    // Hafs 106:4 is Warsh 106:4 and 106:5: the row names the Warsh verse
    // holding the matched word, the one the reader then selects.
    expect(verseLabel(rootHit('106:4', 7))).toBe('Quraysh 106:5 · Warsh');
    expect(verseLabel(rootHit('106:4', 1))).toBe('Quraysh 106:4 · Warsh');
    // The unnumbered basmala is no Warsh verse: its Hafs verse, saying so.
    expect(verseLabel(rootHit('1:1', 3))).toBe('Al-Fatihah 1:1 · Hafs');
    // The ayahs shown are the Hafs text: the screen says so.
    expect(last('root')).toMatchObject({hafsNote: true});
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
    // Every row that marks it: the legacy row; nothing added.
    expect(removedBookmarks()).toEqual(['103:2']);
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
    setRows(['1:7:1']);
    await openSheet(warshUnitPayload(['1:7']));
    expect(texts()).toContain('Bookmark');
    await press('Bookmark');
    expect(changeSets()).toEqual([{addBookmarks: [warshBookmark('1:7:5')]}]);
  });

  it('a Warsh row saved before verse units on a split Hafs verse marks both parts', async () => {
    // develop saved "1:7" for all of Hafs 1:7 (Warsh 1:6 and 1:7).
    setRows(['1:7']);
    await openSheet(warshUnitPayload(['1:7']));
    expect(texts()).toContain('Remove Bookmark');
    await openSheet(warshUnitPayload(['1:6']));
    expect(texts()).toContain('Remove Bookmark');
    await press('Remove Bookmark');
    expect(removedBookmarks()).toEqual(['1:7']);
    expect(changeSets()).toEqual([{removeBookmarks: ['1:7']}]);
  });

  it('a Hafs row on a split Hafs verse marks both Warsh verses', async () => {
    setRows(['1:7'], {}, 'hafs');
    await openSheet(warshUnitPayload(['1:7']));
    expect(texts()).toContain('Remove Bookmark');
  });

  it("rows are saved in the sheet's rewayah, not the mushaf's", async () => {
    // A player sheet: Warsh verses while the mushaf shows Hafs, and the
    // other way round.
    await openSheet(warshUnitPayload(['1:7'], {source: 'player'}));
    await press('Bookmark');
    useMushafSettingsStore.setState({rewayah: 'warsh'});
    await openSheet({
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
      rewayah: 'hafs',
      source: 'player',
    });
    await press('Bookmark');
    const rows = useVerseAnnotationsStore.getState().bookmarkRows;
    expect(rows['1:7:5']).toEqual({verseKey: '1:7:5', rewayahId: 'warsh'});
    expect(rows['2:255']).toEqual({verseKey: '2:255', rewayahId: 'hafs'});
  });

  it('a legacy highlight marks it and every row is removed', async () => {
    setRows([], {'103:2': 'yellow'});
    await openSheet(warshUnitPayload(['103:1']));
    expect(texts()).toContain('Remove Highlight');
    await press('Remove Highlight');
    expect(removedHighlights()).toEqual(['103:2']);
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

  // @ai-start
  it('Word Study waits for the Warsh verses, as every screen does', async () => {
    mockUnits.models = new Map();
    mockUnits.status = new Map([['warsh', 'loading']]);
    mockWords.state = new Map([
      ['hafs', 'ready'],
      ['warsh', 'loading'],
    ]);
    (
      digitalKhattDataService.ensureRewayahLoaded as jest.Mock
    ).mockImplementation(() => new Promise(() => undefined));
    await openSheet(
      warshUnitPayload(['1:7'], {
        initialScreen: 'words',
        word: {verseKey: '1:7', position: 6},
      }),
    );
    expect(last('words')).toBeUndefined();
    expect(texts()).toContain('Word Study');
    expect(texts().some(t => /\d+:\d+/.test(t))).toBe(false);
  });
  // @ai-end

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

// @ai-start
describe("Word Study only: a word of Warsh's unnumbered Fatiha basmala", () => {
  // As the list and the player send it for a word of the basmala row
  // (verseUnitRows.unnumberedWordStudyPayload): no verse of Warsh holds it.
  const basmalaWord = (position: number): NonNullable<Payload> => ({
    verseKey: '1:1',
    surahNumber: 1,
    ayahNumber: 1,
    source: 'player',
    rewayah: 'warsh',
    initialScreen: 'words',
    word: {verseKey: '1:1', position},
    wordStudyOnly: true,
  });
  // The verse menu's actions: they act on verses, so never offered.
  const MENU = [
    'Play from Here',
    'Repeat',
    'Bookmark',
    'Highlight',
    'Add Note',
    'Translation',
    'Copy',
    'Share',
  ];
  const rootPress = () =>
    last('words').onRootPress as (
      root: string,
      lemma: string | null,
      word: unknown,
    ) => void;

  it('opens on Word Study over the words of Hafs 1:1 in Warsh, with no verse', async () => {
    await openSheet(basmalaWord(2));
    expect(last('words')).toMatchObject({
      study: {
        rewayah: 'warsh',
        parts: [{verseKey: '1:1', caption: 'hafsVerse'}],
      },
      initialWord: {verseKey: '1:1', position: 2},
    });
    const shown = texts();
    expect(shown).toContain('Word Study');
    for (const action of MENU) expect(shown).not.toContain(action);
    // No verse header, no number, no "not a numbered verse" in its place.
    expect(shown).not.toContain('Al-Fatihah');
    expect(shown.some(t => /\d+:\d+/.test(t))).toBe(false);
    expect(shown.some(t => t.includes('numbered verse'))).toBe(false);
    expect(qulDataService.hasSimilarVerses).not.toHaveBeenCalled();
  });

  it('never waits for the Warsh verses, which hold no basmala', async () => {
    mockUnits.models = new Map();
    mockUnits.status = new Map([['warsh', 'loading']]);
    mockWords.state = new Map([
      ['hafs', 'ready'],
      ['warsh', 'loading'],
    ]);
    (
      digitalKhattDataService.ensureRewayahLoaded as jest.Mock
    ).mockImplementation(() => new Promise(() => undefined));
    await openSheet(basmalaWord(4));
    expect(last('words')).toMatchObject({
      study: {rewayah: 'warsh', parts: [{verseKey: '1:1'}]},
      initialWord: {verseKey: '1:1', position: 4},
    });
  });

  it('the back row closes the sheet: there is no verse menu to go back to', async () => {
    await openSheet(basmalaWord(2));
    await press('Word Study');
    expect(SheetManager.hide).toHaveBeenCalledTimes(1);
    expect(SheetManager.hide).toHaveBeenCalledWith('verse-actions');
    const shown = texts();
    expect(shown).toContain('Word Study');
    for (const action of MENU) expect(shown).not.toContain(action);
  });

  it("root search's back returns to Word Study at the same word", async () => {
    await openSheet(basmalaWord(2));
    await act(async () =>
      rootPress()('ر ح م', null, {verseKey: '1:1', position: 3}),
    );
    expect(last('root')).toMatchObject({root: 'ر ح م'});
    await press('Root search');
    expect(SheetManager.hide).not.toHaveBeenCalled();
    expect(last('words')).toMatchObject({
      study: {rewayah: 'warsh', parts: [{verseKey: '1:1'}]},
      initialWord: {verseKey: '1:1', position: 3},
    });
    // Back again, from Word Study: the sheet closes.
    await press('Word Study');
    expect(SheetManager.hide).toHaveBeenCalledTimes(1);
  });

  it("Android's back: root search returns to Word Study, Word Study closes", async () => {
    // Android's back reaches the sheet (a Modal) only as onRequestClose.
    await openSheet(basmalaWord(2));
    const request = closeRequests();
    await act(async () =>
      rootPress()('ر ح م', null, {verseKey: '1:1', position: 3}),
    );
    expect(await request(BACK_PRESS)).toBe(false);
    expect(texts()).toContain('Word Study');
    expect(last('words')).toMatchObject({
      initialWord: {verseKey: '1:1', position: 3},
    });
    // From Word Study the sheet may close: no verse menu is behind it.
    expect(await request(BACK_PRESS)).toBe(true);
    expect(texts()).toContain('Word Study');
    for (const action of MENU) expect(texts()).not.toContain(action);
    expect(SheetManager.hide).not.toHaveBeenCalled();
  });

  it('the back row says when it closes the sheet', async () => {
    // Named by its screen in every mode; the hint is only where it closes.
    const backRow = (title: string) => {
      const row = root()
        .findAll(
          n =>
            typeof n.props.onPress === 'function' &&
            n.props.accessibilityRole === 'button',
        )
        .find(n => n.findAll(c => c.props.children === title).length > 0);
      if (!row) throw new Error(`no back row titled ${title}`);
      return row;
    };
    await openSheet(basmalaWord(2));
    expect(backRow('Word Study').props.accessibilityHint).toBe('Close');
    await act(async () =>
      rootPress()('ر ح م', null, {verseKey: '1:1', position: 3}),
    );
    expect(backRow('Root search').props.accessibilityHint).toBeUndefined();
    // A verse's Word Study goes back to its actions: no hint.
    await openSheet({...basmalaWord(2), rewayah: 'hafs', wordStudyOnly: false});
    expect(backRow('Word Study').props.accessibilityHint).toBeUndefined();
  });

  it('an ayah of the root collapses the player and opens the Mushaf', async () => {
    // The scenario: Word by Word on in the full player, a basmala word,
    // its root, an ayah. The open player covers every route.
    await openSheet(basmalaWord(2));
    await act(async () =>
      rootPress()('ر ح م', null, {verseKey: '1:1', position: 3}),
    );
    const onVersePress = last('root').onVersePress as (hit: unknown) => void;
    await act(async () =>
      onVersePress({
        verseIndex: 0,
        verseKey: '1:3',
        matches: [{position: 1, length: 1}],
        score: 1,
      }),
    );
    expect(SheetManager.hide).toHaveBeenCalledWith('verse-actions');
    expect(mockMainPlayer.setSheetMode).toHaveBeenCalledWith('hidden');
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/mushaf',
      params: expect.objectContaining({surah: '1', ayah: '3', words: '1'}),
    });
    const push = router.push as jest.Mock;
    expect(
      mockMainPlayer.setSheetMode.mock.invocationCallOrder[0],
    ).toBeLessThan(push.mock.invocationCallOrder[0]);
  });

  it('looks up no QUL data, which is per verse, even for a Hafs payload', async () => {
    // No producer sends a Hafs one (Hafs numbers the basmala), but Hafs
    // could name the verse: without the guard its QUL data would be asked.
    await openSheet({...basmalaWord(2), rewayah: 'hafs'});
    expect(last('words')).toMatchObject({
      study: {rewayah: 'hafs', parts: [{verseKey: '1:1', caption: 'none'}]},
    });
    expect(qulDataService.hasSimilarVerses).not.toHaveBeenCalled();
    expect(qulDataService.hasSharedPhrases).not.toHaveBeenCalled();
  });

  it('closing leaves the screen and any selection it did not make', async () => {
    // A verse another surface selected (the reader's 3 s flash, say).
    useVerseSelectionStore.getState().selectVerse('2:255', 2, 255);
    useMushafVerseSelectionStore.getState().selectVerse('2:255', 42);
    try {
      await openSheet(basmalaWord(2));
      const sheet = root().find(n => typeof n.props.onClose === 'function');
      await act(async () => sheet.props.onClose());
      // Still Word Study while the sheet leaves (back to no screen would
      // draw nothing here: no header, no menu), never the verse menu.
      expect(texts()).toContain('Word Study');
      expect(texts()).not.toContain('Copy');
      expect(useVerseSelectionStore.getState().selectedVerseKey).toBe('2:255');
      expect(useMushafVerseSelectionStore.getState().selectedVerseKey).toBe(
        '2:255',
      );
    } finally {
      useVerseSelectionStore.getState().clearSelection();
      useMushafVerseSelectionStore.getState().clearSelection();
    }
  });
});
// @ai-end

describe('iPad keys while the sheet is over the reader', () => {
  const payload = {
    verseKey: '2:255',
    surahNumber: 2,
    ayahNumber: 255,
    source: 'mushaf' as const,
  };
  const KEYS: KeyId[] = ['space', 'shift-space', 'left', 'right'];
  // The reader's page turns, bound under the sheet as on iPad.
  let reader: Map<KeyId, jest.Mock>;
  // The app-wide Space (play / pause), which the reader's Space overrides.
  let playPause: jest.Mock;

  beforeEach(() => {
    resetKeyCommandsForTests(true);
    playPause = jest.fn();
    addKeyLayer(
      [{key: 'space', title: 'Play/Pause', menu: 'playback', run: playPause}],
      {base: true},
    );
    reader = new Map(KEYS.map(key => [key, jest.fn()]));
    addKeyLayer(
      KEYS.map(key => ({
        key,
        title: 'Page',
        menu: 'reader' as const,
        run: reader.get(key) as jest.Mock,
      })),
    );
  });

  afterEach(() => {
    resetKeyCommandsForTests(false);
  });

  const pressAll = () =>
    act(() => {
      for (const key of KEYS) pressKeyForTests(key);
    });
  /** How many times each of the reader's keys ran. */
  const pageTurns = () => KEYS.map(key => reader.get(key)?.mock.calls.length);

  it('turns no page from the menu or a screen, and gives the keys back when it closes', async () => {
    await openSheet(payload);
    pressAll();
    await press('Translation');
    pressAll();
    expect(pageTurns()).toEqual([0, 0, 0, 0]);
    // Over the reader, Space is its page turn, never the app-wide play /
    // pause: the sheet takes it, and nothing plays or pauses.
    expect(playPause).not.toHaveBeenCalled();
    act(() => renderer?.unmount());
    renderer = null;
    pressAll();
    expect(pageTurns()).toEqual([1, 1, 1, 1]);
    expect(playPause).not.toHaveBeenCalled();
  });

  it('leaves the arrows to Word Study, also when the sheet opens on it', async () => {
    // Word Study mounts with the sheet: its keys still win.
    await openSheet({
      ...payload,
      initialScreen: 'words',
      word: {verseKey: '2:255', position: 3},
    });
    pressAll();
    expect(mockWordStudyKeys.left).toHaveBeenCalledTimes(1);
    expect(mockWordStudyKeys.right).toHaveBeenCalledTimes(1);
    // Root search, opened from Word Study, has no arrows of its own.
    const onRootPress = last('words').onRootPress as (
      root: string,
      lemma: string | null,
      word: unknown,
    ) => void;
    await act(async () =>
      onRootPress('ء ل ه', null, {verseKey: '2:255', position: 1}),
    );
    pressAll();
    expect(mockWordStudyKeys.left).toHaveBeenCalledTimes(1);
    expect(pageTurns()).toEqual([0, 0, 0, 0]);
  });

  it('turns no page while Word Study waits for the Warsh verses', async () => {
    mockUnits.models = new Map();
    mockUnits.status = new Map([['warsh', 'loading']]);
    mockWords.state = new Map([
      ['hafs', 'ready'],
      ['warsh', 'loading'],
    ]);
    (
      digitalKhattDataService.ensureRewayahLoaded as jest.Mock
    ).mockImplementation(() => new Promise(() => undefined));
    await openSheet(
      warshUnitPayload(['1:7'], {
        initialScreen: 'words',
        word: {verseKey: '1:7', position: 6},
      }),
    );
    expect(last('words')).toBeUndefined();
    pressAll();
    expect(pageTurns()).toEqual([0, 0, 0, 0]);
  });
});

describe('iPad keys while the sheet is over the full player', () => {
  const payload = {
    verseKey: '2:255',
    surahNumber: 2,
    ayahNumber: 255,
    source: 'player' as const,
  };
  // As on iPad with the full player open: the app-wide Space (play /
  // pause) and the player's seeks; the reader's layer is off.
  let playPause: jest.Mock;
  let seeks: Map<KeyId, jest.Mock>;
  let setCommands: jest.SpyInstance;

  beforeEach(() => {
    resetKeyCommandsForTests(true);
    setCommands = jest.spyOn(BayaanKeyboard, 'setCommands');
    playPause = jest.fn();
    addKeyLayer(
      [{key: 'space', title: 'Play/Pause', menu: 'playback', run: playPause}],
      {base: true},
    );
    seeks = new Map<KeyId, jest.Mock>([
      ['left', jest.fn()],
      ['right', jest.fn()],
    ]);
    addKeyLayer(
      [...seeks].map(([key, run]) => ({
        key,
        title: 'Seek',
        menu: 'playback' as const,
        run,
      })),
    );
  });

  afterEach(() => {
    setCommands.mockRestore();
    resetKeyCommandsForTests(false);
  });

  const pressKey = (key: KeyId) => act(() => pressKeyForTests(key));
  const seekCount = () => [...seeks.values()].map(s => s.mock.calls.length);
  /** The keys the Playback menu lists now. */
  const playbackMenu = () => {
    const commands = (setCommands.mock.calls.at(-1)?.[1] ?? []) as {
      id: string;
      menu: string;
    }[];
    return commands.filter(c => c.menu === 'playback').map(c => c.id);
  };

  it('still plays and pauses with Space, from the menu and Word Study, and seeks nothing', async () => {
    await openSheet(payload);
    pressKey('space');
    expect(playPause).toHaveBeenCalledTimes(1);
    expect(playbackMenu()).toEqual(['space']);
    pressKey('left');
    pressKey('right');
    expect(seekCount()).toEqual([0, 0]);

    // A word's Play in Word Study pauses the recitation: Space resumes it.
    await press('Word Study');
    expect(last('words')).toBeDefined();
    pressKey('space');
    expect(playPause).toHaveBeenCalledTimes(2);

    act(() => renderer?.unmount());
    renderer = null;
    pressKey('space');
    pressKey('left');
    expect(playPause).toHaveBeenCalledTimes(3);
    expect(seekCount()).toEqual([1, 0]);
  });
});
