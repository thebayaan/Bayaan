// @ai-generated
/**
 * Hafs differential test for the player verse list (QuranView): with a Hafs
 * track the rows, their props, the follow-along highlight, the auto-scroll
 * and the list props must stay exactly as they were before the list learnt
 * rewayah verse rows (decision 3 of Release 1). Nothing of the rewayah verse
 * units may even be loaded for a Hafs track.
 *
 * The golden file was recorded from the release base (7de55bda) before the
 * verse-row work. Regenerate it ONLY for an intended Hafs change:
 *   UPDATE_PLAYER_HAFS_GOLDEN=1 npx jest QuranView.hafsGolden --watchAll=false
 */

import * as fs from 'fs';
import * as path from 'path';
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

type Props = Record<string, unknown>;

const mockRows: Props[] = [];
const mockList: {props: Props[]; calls: unknown[][]} = {props: [], calls: []};
const mockBranding: {initialPlayerVerseKey?: (t: unknown) => string} = {};
const mockUnitsHook = jest.fn();

function mockPlain(props: Props): Props {
  const out: Props = {};
  for (const [k, v] of Object.entries(props)) {
    if (k === 'children') continue;
    if (typeof v === 'function') out[k] = 'fn';
    else if (React.isValidElement(v)) out[k] = 'element';
    else out[k] = v;
  }
  return out;
}

jest.mock('../VerseItem', () => ({
  VerseItem: (props: Props) => {
    mockRows.push(mockPlain(props));
    return null;
  },
}));

jest.mock('../BasmalaHeader', () => ({__esModule: true, default: () => null}));

jest.mock('../SurahDivider', () => ({
  __esModule: true,
  default: () => null,
  computeDividerTotalHeight: () => 10,
}));

jest.mock('@shopify/flash-list', () => {
  const ReactActual = jest.requireActual('react');
  const FlashList = ReactActual.forwardRef(
    (
      props: {
        data: unknown[];
        renderItem: (info: {item: unknown; index: number}) => unknown;
        keyExtractor: (item: unknown) => string;
        ListHeaderComponent?: unknown;
      },
      ref: unknown,
    ) => {
      ReactActual.useImperativeHandle(ref, () => ({
        scrollToIndex: (args: unknown) =>
          mockList.calls.push(['scrollToIndex', args]),
        scrollToOffset: (args: unknown) =>
          mockList.calls.push(['scrollToOffset', args]),
      }));
      const plain: Props = {};
      for (const [k, v] of Object.entries(props)) {
        if (k === 'data' || k === 'children') continue;
        plain[k] =
          typeof v === 'function'
            ? 'fn'
            : ReactActual.isValidElement(v)
              ? 'element'
              : v;
      }
      plain.keys = props.data.map(props.keyExtractor);
      mockList.props.push(plain);
      return ReactActual.createElement(
        ReactActual.Fragment,
        null,
        props.ListHeaderComponent,
        props.data.map((item: unknown, index: number) =>
          ReactActual.createElement(
            ReactActual.Fragment,
            {key: index},
            props.renderItem({item, index}),
          ),
        ),
      );
    },
  );
  return {FlashList};
});

jest.mock('@gorhom/bottom-sheet', () => ({
  useBottomSheetScrollableCreator: () => undefined,
}));

jest.mock('@expo/vector-icons', () => ({Ionicons: () => null}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {text: '#111111', border: '#cccccc', card: '#ffffff'},
    },
    isDarkMode: false,
  }),
}));

jest.mock('@/hooks/useReadingThemeColors', () => ({
  useReadingThemeColors: () => ({
    text: '#111111',
    textSecondary: '#666666',
    background: '#ffffff',
  }),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({isTablet: false}),
}));

jest.mock('@/hooks/useMushafFontMgr', () => ({
  useMushafFontMgr: () => ({fake: 'fontMgr'}),
}));

jest.mock('@/hooks/useCurrentTrackRewayah', () => ({
  useCurrentTrackRewayah: () => 'hafs',
}));

// A Hafs track never asks for rewayah verse units (if the list uses them).
jest.mock('@/hooks/useRewayahVerseUnits', () => ({
  useRewayahVerseUnits: (rewayah: unknown) => {
    mockUnitsHook(rewayah);
    return {units: null, status: 'unavailable'};
  },
}));

jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  mushafPreloadService: {initialized: true},
}));

jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {initialized: true},
}));

jest.mock('@/store/verseAnnotationsStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    useVerseAnnotationsStore: create(() => ({
      loadAnnotationsForSurah: () => undefined,
    })),
  };
});

jest.mock('@/store/tajweedStore', () => {
  const {create} = jest.requireActual('zustand');
  return {useTajweedStore: create(() => ({indexedTajweedData: null}))};
});

jest.mock('@/services/player/store/playerStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    usePlayerStore: create(() => ({
      queue: {tracks: [{id: 'track-1', surahId: '2'}], currentIndex: 0},
    })),
  };
});

jest.mock('@/services/timestamps/TimestampService', () => ({
  timestampService: {getTimestampsForSurah: async () => null},
}));

jest.mock('@/utils/translationLookup', () => ({
  getTranslationName: () => 'Translation',
}));

jest.mock('@/config/branding', () => ({
  __esModule: true,
  get default() {
    return mockBranding;
  },
}));

// @ai — the release's timestampStore imports the timing fetcher, which reads
// branding at import time (before mockBranding is initialised).
jest.mock('@/services/timestamps/TimestampFetchService', () => ({
  timestampFetchService: {hasSurah: () => true, hasSource: () => true},
}));

jest.mock('@/utils/enhancedVerseData', () => {
  const verses = Array.from({length: 6}, (_, i) => ({
    id: 8 + i,
    verse_key: `2:${i + 1}`,
    surah_number: 2,
    ayah_number: i + 1,
    text: `HAFS-TEXT-2:${i + 1}`,
    translation: `TRANSLATION-2:${i + 1}`,
    transliteration: `TRANSLITERATION-2:${i + 1}`,
  }));
  return {
    enhancedVersesBySurah: {2: verses},
    rebuildEnhancedVerses: async () => false,
  };
});

import {QuranView} from '../index';
import {useTimestampStore} from '@/store/timestampStore';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

// The list defers its anchor scroll by two animation frames.
jest.useFakeTimers();

const GOLDEN = path.join(
  __dirname,
  '../__fixtures__/quranViewHafs.golden.json',
);

interface Scenario {
  name: string;
  setup?: () => void;
  /** Interactions after the first render, each in its own act(). */
  steps?: ((r: TestRenderer.ReactTestRenderer) => void)[];
}

const tracking = (ayah: number, keys?: string[]) => ({
  surahNumber: 2,
  ayahNumber: ayah,
  verseKey: `2:${ayah}`,
  timestampFrom: ayah * 1000,
  timestampTo: ayah * 1000 + 999,
  ...(keys ? {verseKeys: keys, reciterVerseKey: `2:${ayah}`} : {}),
});

const SCENARIOS: Scenario[] = [
  {name: 'idle list'},
  {
    name: 'follow-along on verse 3, then verse 4',
    steps: [
      () => useTimestampStore.setState({currentAyah: tracking(3, ['2:3'])}),
      () => useTimestampStore.setState({currentAyah: tracking(4, ['2:4'])}),
    ],
  },
  {
    name: 'a state without verseKeys (older writers)',
    steps: [() => useTimestampStore.setState({currentAyah: tracking(5)})],
  },
  {
    name: 'scrolled away (unlocked), then recentred',
    setup: () =>
      useTimestampStore.setState({currentAyah: tracking(2, ['2:2'])}),
    steps: [
      () => useTimestampStore.setState({isLocked: false}),
      r => {
        const button = r.root.findAll(
          n =>
            typeof n.type !== 'string' &&
            typeof n.props.onPress === 'function' &&
            n.props.style !== undefined,
        );
        button[button.length - 1]?.props.onPress();
      },
    ],
  },
  {
    name: 'fork anchor (initialPlayerVerseKey) on 2:3',
    setup: () => {
      mockBranding.initialPlayerVerseKey = () => '2:3';
    },
  },
  {
    name: 'translation, transliteration and word by word settings',
    setup: () =>
      useMushafSettingsStore.setState({
        showWBW: true,
        wbwShowTranslation: true,
        wbwShowTransliteration: true,
        selectedTranslationId: 'saheeh',
        showTajweed: true,
      }),
  },
];

function runScenario(s: Scenario) {
  mockRows.length = 0;
  mockList.props.length = 0;
  mockList.calls.length = 0;
  mockUnitsHook.mockClear();
  delete mockBranding.initialPlayerVerseKey;
  useMushafSettingsStore.setState({
    mushafRenderer: 'dk_v2',
    rewayah: 'hafs',
    showWBW: false,
    showTajweed: false,
    selectedTranslationId: 'saheeh',
  });
  useTimestampStore.setState({currentAyah: null, isLocked: true});
  s.setup?.();
  let renderer: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    renderer = TestRenderer.create(
      <QuranView
        currentSurah={2}
        onVersePress={() => undefined}
        showTranslation
        showTransliteration
        transliterationFontSize={14}
        translationFontSize={15}
        arabicFontSize={24}
        contentPaddingTop={40}
        contentPaddingBottom={50}
      />,
    );
  });
  act(() => {
    jest.runAllTimers();
  });
  for (const step of s.steps ?? []) act(() => step(renderer!));
  act(() => {
    jest.runAllTimers();
  });
  const result = {
    rows: mockRows.map(r => ({...r})),
    list: mockList.props.map(p => ({...p})),
    calls: mockList.calls.map(c => c),
    tree: JSON.parse(JSON.stringify(renderer!.toJSON())),
    unitsRequested: mockUnitsHook.mock.calls
      .map(c => c[0])
      .filter(r => r !== null && r !== undefined),
  };
  act(() => renderer!.unmount());
  return result;
}

describe('Hafs track: unchanged player list (golden from the release base)', () => {
  const results: Record<string, {unitsRequested: unknown[]}> = {};
  let golden: Record<string, {unitsRequested: unknown[]}> = {};

  beforeAll(() => {
    // JSON round trip: the golden file cannot hold `undefined`.
    for (const s of SCENARIOS) {
      results[s.name] = JSON.parse(JSON.stringify(runScenario(s)));
    }
    if (process.env.UPDATE_PLAYER_HAFS_GOLDEN === '1') {
      fs.mkdirSync(path.dirname(GOLDEN), {recursive: true});
      fs.writeFileSync(GOLDEN, JSON.stringify(results, null, 1) + '\n');
    }
    golden = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  });

  it('covers every scenario of the golden file', () => {
    expect(Object.keys(results)).toEqual(Object.keys(golden));
  });

  it.each(SCENARIOS.map(s => s.name))('%s', name => {
    expect(results[name]).toEqual(golden[name]);
  });

  it('never asks for rewayah verse units', () => {
    for (const s of SCENARIOS)
      expect(results[s.name].unitsRequested).toEqual([]);
  });
});
