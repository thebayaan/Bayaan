// @ai-generated
/**
 * On iPad the verse card is a centered card with a max height, and its
 * Translations settings gear opens a dialog over the reader. The card's menu
 * shrinks to the card so it scrolls, and closing the dialog brings the card
 * back on the screen the gear was pressed from. Phones keep today's sheet.
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

const mockSimilarProps: Array<Record<string, unknown>> = [];

jest.mock('../verse-actions/SimilarVersesContent', () => ({
  SimilarVersesContent: (props: Record<string, unknown>) => {
    mockSimilarProps.push(props);
    return null;
  },
}));
// The other screens are not under test.
jest.mock('../verse-actions/HighlightContent', () => ({
  HighlightContent: () => null,
}));
jest.mock('../verse-actions/NoteContent', () => ({NoteContent: () => null}));
jest.mock('../verse-actions/ShareContent', () => ({ShareContent: () => null}));
jest.mock('../verse-actions/TranslationContent', () => {
  const {Text} = jest.requireActual('react-native');
  return {TranslationContent: () => <Text>translation screen</Text>};
});
jest.mock('../verse-actions/TafseerContent', () => {
  const {Text} = jest.requireActual('react-native');
  return {TafseerContent: () => <Text>tafseer screen</Text>};
});
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
let mockIsTablet = true;
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({isTablet: mockIsTablet}),
}));
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
    // @ai-start
    // A rewayah's verses read their marks through the store's unit API:
    // none here.
    selectUnitAnnotations: () => ({
      rewayah: 'warsh',
      bookmarkedUnitKeys: new Set(),
      notedUnitKeys: new Set(),
      highlightColors: {},
      bookmarkRowKeys: () => [],
      highlightRowKeys: () => [],
    }),
    // @ai-end
  };
});
jest.mock('@/store/mushafPlayerStore', () => ({
  useMushafPlayerStore: {getState: () => ({}), setState: jest.fn()},
}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {
    getState: () => ({
      queue: {tracks: [], currentIndex: 0},
      setSheetMode: jest.fn(),
    }),
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
// Every rewayah's words are in memory; the sheet's own text is not under
// test here.
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    rewayah: 'warsh',
    isRewayahReady: () => true,
    getRewayahLoadState: () => 'ready',
    getVerseText: () => 'W1',
    getVerseWords: () => [],
    getPageForVerse: () => 1,
    subscribeCacheChanges: () => () => undefined,
    getCacheVersion: () => 0,
    retainRewayah: () => () => undefined,
    ensureRewayahLoaded: jest.fn(async () => undefined),
  },
}));

// @ai-start
// Decision 3 (verse units): a non-Hafs rewayah's verses come from its verse
// units. These Warsh units are synthetic and numbered like Hafs (every Hafs
// verse of surahs 1-3 is one Warsh verse of placeholder words), so the
// expectations keep their verse keys.
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => {
  const {buildRewayahVerseUnits} = jest.requireActual(
    '@/services/mushaf/RewayahVerseUnits',
  );
  const arabic = (n: number) =>
    String(n).replace(/[0-9]/g, d => String.fromCharCode(0x0660 + Number(d)));
  const counts: Record<number, number> = {1: 7, 2: 286, 3: 200};
  const slots: object[] = [];
  let id = 0;
  for (const surah of [1, 2, 3]) {
    for (let ayah = 1; ayah <= counts[surah]; ayah++) {
      const texts = [
        `WARSH-${ayah}a`,
        `WARSH-${ayah}b`,
        `\u06DD${arabic(ayah)}`,
      ];
      texts.forEach((text, i) => {
        id += 1;
        slots.push({id, surah, ayah, word: i + 1, text});
      });
    }
  }
  const warsh = buildRewayahVerseUnits('warsh', slots, 'warsh@test');
  return {
    rewayahVerseUnitsService: jest
      .requireActual('@/services/mushaf/__fixtures__/verseUnitsServiceStub')
      .verseUnitsServiceStub({
        peek: (rewayah: string) => (rewayah === 'warsh' ? warsh : null),
      }),
  };
});
// @ai-end

import {StyleSheet} from 'react-native';
import {SheetManager} from 'react-native-actions-sheet';
import {VerseActionsSheet} from '../VerseActionsSheet';
import {showPendingVerseActions} from '../verse-actions/returnAfterTranslations';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer: TestRenderer.ReactTestRenderer | null = null;

/** The rendered tree (throws if nothing is rendered). */
function root(): TestRenderer.ReactTestInstance {
  if (!renderer) throw new Error('nothing rendered');
  return renderer.root;
}

const basePayload = {
  verseKey: '2:5',
  surahNumber: 2,
  ayahNumber: 5,
  source: 'mushaf',
  rewayah: 'hafs',
} as const;

async function openSheet(payload: object = basePayload) {
  const props = {
    sheetId: 'verse-actions',
    payload,
  } as React.ComponentProps<typeof VerseActionsSheet>;
  await act(async () => {
    renderer = TestRenderer.create(<VerseActionsSheet {...props} />);
  });
  // The QUL availability lookups resolve on the next microtasks.
  await act(async () => {
    await Promise.resolve();
  });
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

/** The gear beside the Translation and Tafseer screens' back row. */
function pressSettingsGear() {
  const gear = root()
    .findAll(
      n =>
        typeof n.props.onPress === 'function' &&
        n.props.accessibilityLabel === 'Translation and tafseer settings',
    )
    .pop();
  if (!gear) throw new Error('no settings gear');
  act(() => {
    gear.props.onPress();
  });
}

const texts = () =>
  root()
    .findAll(n => typeof n.props.children === 'string')
    .map(n => n.props.children as string);

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockIsTablet = true;
  useMushafSettingsStore.setState({rewayah: 'hafs', mushafRenderer: 'dk_v2'});
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  showPendingVerseActions();
  jest.useRealTimers();
});

const containerStyle = () =>
  StyleSheet.flatten(
    root().findAll(
      n =>
        typeof n.type === 'string' &&
        StyleSheet.flatten(n.props.style)?.paddingHorizontal !== undefined,
    )[0].props.style,
  );

it('lets the menu shrink to the iPad card so it scrolls', async () => {
  await openSheet();
  // The card pads its own bottom, so the menu's padding would only cost rows.
  expect(containerStyle()).toMatchObject({flexShrink: 1, paddingBottom: 0});
});

it('leaves the phone menu as it was', async () => {
  mockIsTablet = false;
  await openSheet();
  expect(containerStyle().flexShrink).toBeUndefined();
  expect(containerStyle().paddingBottom).toBeGreaterThan(0);
});

it('keeps the iPad screens behind the menu as they were', async () => {
  await openSheet({...basePayload, initialScreen: 'translation'});
  expect(containerStyle().paddingBottom).toBeGreaterThan(0);
});

it('opens on the screen its payload names', async () => {
  await openSheet({...basePayload, initialScreen: 'translation'});
  expect(texts()).toContain('translation screen');
  expect(texts()).not.toContain('Similar Verses');
});

it('comes back on Translation when the dialog it opened closes', async () => {
  await openSheet();
  press('Translation');
  pressSettingsGear();
  expect(SheetManager.hide).toHaveBeenCalledWith('verse-actions');
  expect(SheetManager.show).not.toHaveBeenCalled();

  showPendingVerseActions();
  expect(SheetManager.show).toHaveBeenCalledWith('verse-actions', {
    payload: {...basePayload, initialScreen: 'translation'},
  });
  // Only once.
  showPendingVerseActions();
  expect(SheetManager.show).toHaveBeenCalledTimes(1);
});

it('comes back on Tafseer when the gear was pressed there', async () => {
  await openSheet();
  press('Tafseer');
  pressSettingsGear();
  showPendingVerseActions();
  expect(SheetManager.show).toHaveBeenCalledWith('verse-actions', {
    payload: {...basePayload, initialScreen: 'tafseer'},
  });
});

it('does not come back over the player, which the gear closes', async () => {
  await openSheet({...basePayload, source: 'player'});
  press('Translation');
  pressSettingsGear();
  showPendingVerseActions();
  expect(SheetManager.show).not.toHaveBeenCalled();
});

it('leaves phones as they are', async () => {
  mockIsTablet = false;
  await openSheet();
  press('Translation');
  pressSettingsGear();
  showPendingVerseActions();
  expect(SheetManager.show).not.toHaveBeenCalled();
});
