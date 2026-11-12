// @ai-generated
/**
 * The verse actions sheet configures no LayoutAnimation when it
 * closes.
 *
 * react-native-actions-sheet calls the sheet's `onClose` in the same task
 * that unmounts the sheet's React Native `Modal`. A LayoutAnimation
 * configured there applies to that unmount. On iOS (Fabric, React Native
 * 0.88.1) the animation held the removal of the Modal host, and when "Play
 * from Here" started playback at the same moment the removal never ran:
 * UIKit kept the Modal's view controller presented, and its empty
 * full-screen view took every touch until a restart. The screen changes
 * inside the open sheet still animate.
 */

import React, {act} from 'react';
import {LayoutAnimation} from 'react-native';
import TestRenderer from 'react-test-renderer';

/** The props that the sheet gives the library sheet, last render first. */
const mockSheetProps: Array<Record<string, unknown>> = [];

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
import {useVerseSelectionStore} from '@/store/verseSelectionStore';

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

function hasText(label: string): boolean {
  return root().findAll(n => n.props.children === label).length > 0;
}

function press(label: string) {
  const target = root()
    .findAll(
      n =>
        typeof n.props.onPress === 'function' &&
        n.findAll(c => c.props.children === label).length > 0,
    )
    .pop();
  if (!target) throw new Error(`nothing to press for ${label}`);
  act(() => {
    target.props.onPress();
  });
}

/** What the library does when the sheet has slid away: call onClose. */
function closeSheet() {
  const onClose = mockSheetProps[0]?.onClose;
  if (typeof onClose !== 'function') throw new Error('no onClose prop');
  act(() => {
    onClose();
  });
}

let configureNext: jest.SpyInstance;

beforeEach(() => {
  mockSheetProps.length = 0;
  useMushafSettingsStore.setState({rewayah: 'hafs', mushafRenderer: 'dk_v2'});
  configureNext = jest
    .spyOn(LayoutAnimation, 'configureNext')
    .mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  configureNext.mockRestore();
});

it('configures no LayoutAnimation when the sheet closes', async () => {
  await openSheet();
  useVerseSelectionStore.getState().selectVerse('2:5', 2, 5);
  closeSheet();
  expect(configureNext).not.toHaveBeenCalled();
  expect(useVerseSelectionStore.getState().selectedVerseKey).toBeNull();
});

it('configures none when it closes on an inner screen, which it leaves', async () => {
  await openSheet();
  press('Similar Verses');
  // Inside the open sheet, the screen change still animates.
  expect(configureNext).toHaveBeenCalledTimes(1);
  expect(hasText('Play from Here')).toBe(false);
  configureNext.mockClear();
  closeSheet();
  expect(configureNext).not.toHaveBeenCalled();
  // The next open starts on the action list, not on the screen it left.
  expect(hasText('Play from Here')).toBe(true);
});
