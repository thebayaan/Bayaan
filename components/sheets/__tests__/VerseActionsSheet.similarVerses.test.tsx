// @ai-generated
/**
 * The verse actions sheet opens its Similar Verses and Shared Phrases
 * screens in the rewayah it resolved for the selection (the payload's, e.g.
 * the rewayah of the track playing in the player, else the mushaf's): the
 * same rewayah its copy, share, translation and word-by-word screens use.
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
    rewayahVerseUnitsService: {
      get: (rewayah: string) => (rewayah === 'warsh' ? warsh : null),
      getStatus: (rewayah: string) => (rewayah === 'warsh' ? 'ready' : 'error'),
    },
  };
});
// @ai-end

import {VerseActionsSheet} from '../VerseActionsSheet';
import {
  useMushafSettingsStore,
  type RewayahId,
} from '@/store/mushafSettingsStore';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer: TestRenderer.ReactTestRenderer | null = null;

/** The rendered tree (throws if nothing is rendered). */
function root(): TestRenderer.ReactTestInstance {
  if (!renderer) throw new Error('nothing rendered');
  return renderer.root;
}

async function openSheet(rewayah?: RewayahId) {
  const props = {
    sheetId: 'verse-actions',
    payload: {
      verseKey: '2:5',
      surahNumber: 2,
      ayahNumber: 5,
      source: 'player',
      rewayah,
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

const lastSimilarProps = () => mockSimilarProps[mockSimilarProps.length - 1];

beforeEach(() => {
  mockSimilarProps.length = 0;
  useMushafSettingsStore.setState({rewayah: 'warsh', mushafRenderer: 'dk_v2'});
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

it('opens Similar Verses in the payload rewayah, not the mushaf one', async () => {
  await openSheet('hafs');
  press('Similar Verses');
  expect(lastSimilarProps()).toMatchObject({
    verseKey: '2:5',
    section: 'similar',
    rewayah: 'hafs',
  });
});

it('opens Shared Phrases in the payload rewayah, not the mushaf one', async () => {
  await openSheet('hafs');
  press('Shared Phrases');
  expect(lastSimilarProps()).toMatchObject({
    verseKey: '2:5',
    section: 'phrases',
    rewayah: 'hafs',
  });
});

it('uses the mushaf rewayah when the payload names none', async () => {
  await openSheet(undefined);
  press('Similar Verses');
  expect(lastSimilarProps()).toMatchObject({
    section: 'similar',
    rewayah: 'warsh',
  });
});
