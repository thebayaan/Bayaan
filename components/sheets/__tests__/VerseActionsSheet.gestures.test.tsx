/**
 * How the verse sheet scrolls and drags on a phone: the sheet keeps its
 * drag (with its own handle), and the verse menu scrolls in the sheets'
 * list, which holds the drag off while the menu is scrolled and lets a drag
 * down at its top move the sheet (SheetGestures.tsx, tested there).
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

/** The props that the sheet gives the library sheet, last render first. */
const mockSheetProps: Array<Record<string, unknown>> = [];

jest.mock('../verse-actions/sheetGestures', () => {
  const ReactActual = jest.requireActual('react');
  const {View} = jest.requireActual('react-native');
  return {
    SheetScrollView: (props: {children?: React.ReactNode}) =>
      ReactActual.createElement(View, {testID: 'sheet-list'}, props.children),
    SheetFooter: (props: Record<string, unknown>) =>
      ReactActual.createElement(View, props),
  };
});
// A phone: the library sheet gets the verse sheet's own props (an iPad
// draws a card that is never dragged).
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({isTablet: false, isPhone: true}),
}));
jest.mock('../verse-actions/SimilarVersesContent', () => ({
  SimilarVersesContent: () => null,
}));
jest.mock('../verse-actions/HighlightContent', () => ({
  HighlightContent: () => null,
}));
jest.mock('../verse-actions/NoteContent', () => ({NoteContent: () => null}));
jest.mock('../verse-actions/ShareContent', () => ({ShareContent: () => null}));
jest.mock('../verse-actions/TranslationContent', () => ({
  TranslationContent: () => null,
}));
jest.mock('../verse-actions/TafseerContent', () => ({
  TafseerContent: () => null,
}));
jest.mock('../verse-actions/ThemeContent', () => ({ThemeContent: () => null}));
jest.mock('../verse-actions/WBWContent', () => ({WBWContent: () => null}));
jest.mock('../verse-actions/WordStudyContent', () => ({
  WordStudyContent: () => null,
}));
// Root search (RootResults uses FlashList) is not under test here.
jest.mock('@/components/search/quran/RootResults', () => ({
  RootResults: () => null,
}));
jest.mock('../verse-actions/CommunityReflectionsContent', () => ({
  CommunityReflectionsContent: () => null,
}));

jest.mock('react-native-actions-sheet', () => {
  const ReactActual = jest.requireActual('react');
  const {View} = jest.requireActual('react-native');
  const Container = (props: {children?: React.ReactNode}) =>
    ReactActual.createElement(View, null, props.children);
  const Sheet = (props: Record<string, unknown>) => {
    mockSheetProps.unshift(props);
    return ReactActual.createElement(
      View,
      null,
      props.children as React.ReactNode,
    );
  };
  return {
    __esModule: true,
    default: Sheet,
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
  getTranslationTextRaw: () => '',
}));
jest.mock('@/utils/timestampUtils', () => ({getPlayFromHereTarget: jest.fn()}));
jest.mock('@/services/verse-annotations/VerseAnnotationService', () => ({
  verseAnnotationService: {},
}));
jest.mock('@/store/verseAnnotationsStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    useVerseAnnotationsStore: create(() => ({
      isBookmarked: () => false,
      highlights: {},
    })),
    selectUnitAnnotations: () => ({
      rewayah: 'hafs',
      bookmarkedUnitKeys: new Set(),
      notedUnitKeys: new Set(),
      highlightColors: {},
      bookmarkRowKeys: () => [],
      highlightRowKeys: () => [],
    }),
  };
});
jest.mock('@/store/mushafPlayerStore', () => ({
  useMushafPlayerStore: {getState: () => ({}), setState: jest.fn()},
}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {
    getState: () => ({queue: {tracks: [], currentIndex: 0}}),
  },
}));
jest.mock('@/store/timestampStore', () => ({
  useTimestampStore: {getState: () => ({supportedRewayatIds: new Set()})},
}));
jest.mock('@/services/mushaf/QulDataService', () => ({
  qulDataService: {
    hasSimilarVerses: jest.fn(async () => true),
    hasSharedPhrases: jest.fn(async () => true),
  },
}));
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    rewayah: 'hafs',
    isRewayahReady: () => true,
    getRewayahLoadState: () => 'ready',
    getVerseText: () => 'V',
    getVerseWords: () => [],
    getPageForVerse: () => 1,
    subscribeCacheChanges: () => () => undefined,
    getCacheVersion: () => 0,
    retainRewayah: () => () => undefined,
    ensureRewayahLoaded: jest.fn(async () => undefined),
  },
}));

import {VerseActionsSheet} from '../VerseActionsSheet';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer: TestRenderer.ReactTestRenderer | null = null;

function root(): TestRenderer.ReactTestInstance {
  if (!renderer) throw new Error('nothing rendered');
  return renderer.root;
}

async function openSheet() {
  const props = {
    sheetId: 'verse-actions',
    payload: {
      verseKey: '2:5',
      surahNumber: 2,
      ayahNumber: 5,
      source: 'mushaf',
    },
  } as React.ComponentProps<typeof VerseActionsSheet>;
  await act(async () => {
    renderer = TestRenderer.create(<VerseActionsSheet {...props} />);
  });
  // The QUL availability lookups resolve on the next microtasks.
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  mockSheetProps.length = 0;
  useMushafSettingsStore.setState({rewayah: 'hafs', mushafRenderer: 'dk_v2'});
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

it('keeps the sheet draggable, by its own handle too', async () => {
  await openSheet();
  const sheet = mockSheetProps[0];
  expect(sheet.gestureEnabled).toBe(true);
  expect(sheet.indicatorStyle).toBeDefined();
  expect(sheet.CustomHeaderComponent).toBeUndefined();
});

it("scrolls the verse menu in the sheets' list", async () => {
  await openSheet();
  const lists = root().findAll(
    n => typeof n.type === 'string' && n.props.testID === 'sheet-list',
  );
  expect(lists).toHaveLength(1);
  for (const row of ['Play from Here', 'Word Study', 'Share']) {
    expect(
      lists[0].findAll(n => n.props.children === row).length,
    ).toBeGreaterThan(0);
  }
});
