// @ai-generated
/**
 * Hafs differential test for the verse row (VerseItem): a row built from a
 * Hafs verse (every Hafs list, and every list that does not pass a rewayah
 * verse row) must render, select, annotate and open its sheets exactly as it
 * did before rewayah verse rows existed (decision 3 of Release 1).
 *
 * The golden file was recorded from the release base (7de55bda) before the
 * verse-row work. Regenerate it ONLY for an intended Hafs change:
 *   UPDATE_PLAYER_HAFS_GOLDEN=1 npx jest VerseItem.hafsGolden --watchAll=false
 */

import * as fs from 'fs';
import * as path from 'path';
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

type Props = Record<string, unknown>;

const mockRecorded: {component: string; props: Props}[] = [];
const mockHandlers: {
  onWordPress?: (position: number) => void;
  onFootnotePress?: (id: string, n: string) => void;
} = {};

// Child props as JSON-able data (functions become their presence).
function mockPlain(props: Props): Props {
  const out: Props = {};
  for (const [k, v] of Object.entries(props)) {
    if (k === 'children') continue;
    out[k] = typeof v === 'function' ? 'fn' : v;
  }
  return out;
}

jest.mock('../SkiaVerseText', () => ({
  __esModule: true,
  default: (props: Props) => {
    mockRecorded.push({component: 'SkiaVerseText', props: mockPlain(props)});
    return null;
  },
}));

jest.mock('../WBWVerseView', () => ({
  WBWVerseView: (props: Props) => {
    mockRecorded.push({component: 'WBWVerseView', props: mockPlain(props)});
    mockHandlers.onWordPress =
      props.onWordPress as typeof mockHandlers.onWordPress;
    return null;
  },
}));

jest.mock('@/components/mushaf/AyahCommunityReflections', () => ({
  AyahCommunityReflections: (props: Props) => {
    mockRecorded.push({
      component: 'AyahCommunityReflections',
      props: mockPlain(props),
    });
    return null;
  },
}));

jest.mock('@/components/utils/FormattedText', () => {
  const {Text} = jest.requireActual('react-native');
  const ReactActual = jest.requireActual('react');
  return {
    __esModule: true,
    default: (props: {
      text: string;
      onFootnotePress?: (id: string, n: string) => void;
    }) => {
      if (props.onFootnotePress) {
        mockHandlers.onFootnotePress = props.onFootnotePress;
      }
      return ReactActual.createElement(
        Text,
        {testID: 'formatted-text'},
        props.text,
      );
    },
  };
});

jest.mock('@expo/vector-icons', () => {
  const {Text} = jest.requireActual('react-native');
  const ReactActual = jest.requireActual('react');
  const icon = (family: string) => (props: {name: string}) =>
    ReactActual.createElement(Text, null, `${family}:${props.name}`);
  return {Feather: icon('Feather'), Ionicons: icon('Ionicons')};
});

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({theme: {isDarkMode: false}, isDarkMode: false}),
}));

const mockSheetShow = jest.fn((..._args: unknown[]) => Promise.resolve());
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {show: (...args: unknown[]) => mockSheetShow(...args)},
}));

jest.mock('@/utils/haptics', () => ({mediumHaptics: jest.fn()}));

jest.mock('@/utils/translationLookup', () => ({
  isBundledTranslation: (id: string) => id === 'saheeh',
  getBundledFootnotes: (verseKey: string) =>
    verseKey === '2:1' ? {'9001': 'FOOTNOTE-OF-2:1'} : undefined,
}));

jest.mock('@/store/tajweedStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    useTajweedStore: create(() => ({
      indexedTajweedData: {
        '2:1': [
          {
            word_index: 0,
            location: '2:1:1',
            segments: [
              {text: 'QPC-A', rule: 'ghunnah'},
              {text: 'QPC-B', rule: null},
            ],
          },
          {
            word_index: 1,
            location: '2:1:2',
            segments: [{text: 'QPC-C', rule: null}],
          },
        ],
      },
    })),
  };
});

jest.mock('@/store/verseAnnotationsStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    useVerseAnnotationsStore: create(() => ({
      bookmarkedVerseKeys: new Set<string>(),
      notedVerseKeys: new Set<string>(),
    })),
  };
});

import {VerseItem} from '../VerseItem';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useVerseSelectionStore} from '@/store/verseSelectionStore';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import type {SkTypefaceFontProvider} from '@shopify/react-native-skia';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const GOLDEN = path.join(
  __dirname,
  '../__fixtures__/verseItemHafs.golden.json',
);
const FONT_MGR = {fake: 'fontMgr'} as unknown as SkTypefaceFontProvider;
const VERSE = {
  id: 8,
  verse_key: '2:1',
  surah_number: 2,
  ayah_number: 1,
  text: 'BUNDLED-HAFS-TEXT',
  translation: 'TRANSLATION-OF-2:1<sup foot_note="9001">1</sup>',
  transliteration: 'TRANSLITERATION-OF-2:1',
};

interface Scenario {
  name: string;
  props: Props;
  setup?: () => void;
  /** Interactions after the first render. */
  act?: (r: TestRenderer.ReactTestRenderer) => void;
}

const pressables = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAll(
    n =>
      typeof n.type !== 'string' &&
      (typeof n.props.onLongPress === 'function' ||
        typeof n.props.onPress === 'function') &&
      n.props.hitSlop !== undefined,
  );

const measure = (r: TestRenderer.ReactTestRenderer, width: number) => {
  const target = r.root.findAll(
    n => typeof n.type === 'string' && typeof n.props.onLayout === 'function',
  )[0];
  target?.props.onLayout({nativeEvent: {layout: {width}}});
};

const rowPressable = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAll(
    n =>
      typeof n.type !== 'string' && typeof n.props.onLongPress === 'function',
  )[0];

const SCENARIOS: Scenario[] = [
  {
    name: 'player Hafs row, QPC text, translation and transliteration',
    props: {
      rewayah: 'hafs',
      fontMgr: null,
      showTranslation: true,
      showTransliteration: true,
      translationName: 'Saheeh International',
      translationId: 'saheeh',
    },
  },
  {
    name: 'player Hafs row drawn by DigitalKhatt after measuring',
    props: {rewayah: 'hafs', fontMgr: FONT_MGR, showTajweed: true},
    act: r => measure(r, 320),
  },
  {
    name: 'mushaf list row (no rewayah prop) in a Hafs mushaf',
    props: {fontMgr: FONT_MGR, source: 'mushaf'},
    act: r => measure(r, 300),
  },
  {
    name: 'active, selected, bookmarked and noted',
    props: {rewayah: 'hafs', fontMgr: null, isActive: true},
    setup: () => {
      useVerseSelectionStore.getState().selectVerse('2:1', 2, 1);
      useVerseAnnotationsStore.setState({
        bookmarkedVerseKeys: new Set(['2:1']),
        notedVerseKeys: new Set(['2:1']),
      });
    },
  },
  {
    name: 'another verse is selected',
    props: {rewayah: 'hafs', fontMgr: null},
    setup: () => {
      useVerseSelectionStore.getState().selectVerse('2:2', 2, 2);
    },
  },
  {
    name: 'word by word, then a word pressed',
    props: {
      rewayah: 'hafs',
      fontMgr: FONT_MGR,
      showWBW: true,
      wbwShowTranslation: true,
      wbwShowTransliteration: false,
      wbwFontFamily: 'DigitalKhattIndoPak',
    },
    act: () => mockHandlers.onWordPress?.(3),
  },
  {
    name: 'long press opens the verse actions sheet',
    props: {rewayah: 'hafs', fontMgr: null, translationId: 'saheeh'},
    act: r => rowPressable(r).props.onLongPress(),
  },
  {
    name: 'options button opens the verse actions sheet (mushaf source)',
    props: {fontMgr: null, source: 'mushaf'},
    act: r => pressables(r)[0].props.onPress(),
  },
  {
    name: 'tap and footnote',
    props: {
      rewayah: 'hafs',
      fontMgr: null,
      showTranslation: true,
      translationId: 'saheeh',
    },
    act: r => {
      rowPressable(r).props.onPress();
      mockHandlers.onFootnotePress?.('9001', '1');
    },
  },
];

function runScenario(s: Scenario) {
  mockRecorded.length = 0;
  mockSheetShow.mockClear();
  mockHandlers.onWordPress = undefined;
  mockHandlers.onFootnotePress = undefined;
  useMushafSettingsStore.setState({
    rewayah: 'hafs',
    mushafRenderer: 'dk_v2',
    arabicTextWeight: 'normal',
    showAllahNameHighlight: false,
    allahNameHighlightColor: 'gold',
  });
  useVerseSelectionStore.getState().clearSelection();
  useVerseAnnotationsStore.setState({
    bookmarkedVerseKeys: new Set(),
    notedVerseKeys: new Set(),
  });
  s.setup?.();
  const pressed: string[] = [];
  let renderer: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    renderer = TestRenderer.create(
      <VerseItem
        verse={VERSE}
        onVersePress={key => pressed.push(key)}
        textColor="#111111"
        borderColor="#cccccc"
        showTajweed={false}
        arabicFontFamily="Uthmani"
        transliterationFontSize={14}
        translationFontSize={15}
        arabicFontSize={24}
        fontMgr={null}
        dkFontFamily="DigitalKhattV2"
        indexedTajweedData={null}
        {...(s.props as object)}
      />,
    );
  });
  const frames = [JSON.stringify(renderer!.toJSON())];
  if (s.act) {
    act(() => s.act!(renderer!));
    frames.push(JSON.stringify(renderer!.toJSON()));
  }
  const selection = useVerseSelectionStore.getState();
  const result = {
    frames: frames.map(f => JSON.parse(f)),
    children: mockRecorded.map(r => ({...r})),
    sheets: mockSheetShow.mock.calls.map(c => c),
    pressed,
    selection: {
      verseKey: selection.selectedVerseKey,
      surah: selection.selectedSurahNumber,
      ayah: selection.selectedAyahNumber,
    },
  };
  act(() => renderer!.unmount());
  return result;
}

describe('Hafs verse row: unchanged output (golden from the release base)', () => {
  const results: Record<string, unknown> = {};
  let golden: Record<string, unknown> = {};

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
});
