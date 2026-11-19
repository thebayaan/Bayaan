/**
 * WBWVerseView tajweed on 37:130, with its words and QPC tajweed from the
 * bundled data (the overlay fixture, page 451). Digital Khatt writes
 * «إِلْ يَاسِينَ» as one slot where the QPC tajweed data has two words, 3
 * and 4; the grid aligns both onto the slot. Skia is a stand-in paragraph
 * builder and the aligner a spy.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import type {SkTypefaceFontProvider} from '@shopify/react-native-skia';
import type {IndexedTajweedData} from '@/utils/tajweedLoader';

jest.mock('@shopify/react-native-skia', () => ({
  Canvas: () => null,
  Paragraph: () => null,
  Skia: {
    Color: (c: string) => c,
    ParagraphBuilder: {
      Make: () => ({
        pushStyle: () => undefined,
        addText: () => undefined,
        pop: () => undefined,
        build: () => ({
          layout: () => undefined,
          getLongestLine: () => 40,
          getHeight: () => 30,
          dispose: () => undefined,
        }),
      }),
    },
  },
  TextHeightBehavior: {DisableAll: 0},
  TextDirection: {RTL: 0, LTR: 1},
}));

interface Slot {
  text: string;
  verseKey: string;
  wordPositionInVerse: number;
}
let mockDkWords: Slot[] = [];
jest.mock('@/hooks/useRewayahWords', () => ({
  useRewayahWords: () => ({words: mockDkWords, status: 'ready'}),
}));

// The word-by-word words of 37:130 (wbw-en.db): «إِلْ يَاسِينَ» is word 3.
jest.mock('@/services/wbw/WBWDataService', () => ({
  wbwDataService: {
    getVerseWordsCached: () =>
      ['سَلَـٰمٌ', 'عَلَىٰٓ', 'إِلْ يَاسِينَ'].map((textUthmani, i) => ({
        position: i + 1,
        textUthmani,
        translation: '',
        transliteration: '',
        audioUrl: '',
      })),
    getVerseWords: async () => [],
  },
}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {text: '#111111', textSecondary: '#666666'},
    },
  }),
}));

jest.mock('@/utils/haptics', () => ({mediumHaptics: jest.fn()}));

jest.mock('@/services/mushaf/TajweedAlignmentService', () => ({
  alignWordTajweed: jest.fn(() => null),
  detectWordTafkhim: jest.fn(() => null),
}));

jest.mock('@/services/mushaf/AllahNameHighlightService', () => ({
  wordContainsAllahName: () => false,
}));

jest.mock('@/utils/skiaTextWeight', () => ({
  createTextStrokePaint: () => undefined,
  getArabicTextWeightStrokeWidth: () => 0,
}));

jest.mock('@/utils/skiaDeferredDispose', () => ({
  disposeAfterPendingDraws: () => undefined,
}));

import {
  alignWordTajweed,
  detectWordTafkhim,
} from '@/services/mushaf/TajweedAlignmentService';
import {WBWVerseView} from '../WBWVerseView';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

interface FixturePage {
  page: number;
  locations: string[];
  texts: {hafs: string[]};
}
const fixture =
  require('@/services/mushaf/__fixtures__/rewayahOverlayFixture.json') as {
    pages: FixturePage[];
    tajweed: IndexedTajweedData;
  };

const page451 = fixture.pages.find(p => p.page === 451);
if (!page451) throw new Error('page 451 is not in the fixture');
mockDkWords = page451.locations
  .map((location, i) => ({location, text: page451.texts.hafs[i]}))
  .filter(({location}) => location.startsWith('37:130:'))
  .map(({location, text}) => ({
    text,
    verseKey: '37:130',
    wordPositionInVerse: Number(location.split(':')[2]),
  }));
const qpc = fixture.tajweed['37:130'];

it('aligns both QPC words of «إِلْ يَاسِينَ» onto its one slot', () => {
  // Slots 1-3 and the end marker; QPC words 1-4 and no verse number.
  expect(mockDkWords.map(w => w.wordPositionInVerse)).toEqual([1, 2, 3, 4]);
  expect(qpc.map(w => w.location)).toEqual([
    '37:130:1',
    '37:130:2',
    '37:130:3',
    '37:130:4',
  ]);
  const slot = mockDkWords[2].text;
  expect(slot.split(' ')).toHaveLength(2);

  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <WBWVerseView
        verseKey="37:130"
        textColor="#111111"
        arabicFontSize={24}
        dkFontFamily="DigitalKhattV2"
        fontMgr={{} as SkTypefaceFontProvider}
        showTranslation={false}
        showTransliteration={false}
        onWordPress={() => undefined}
        selectedWordPosition={null}
        showTajweed
        indexedTajweedData={fixture.tajweed}
        rewayah="hafs"
      />,
    );
  });
  // The grid lays the words out (and aligns their tajweed) once measured.
  const measured = tree.root.find(
    node => typeof node.props.onLayout === 'function',
  );
  act(() => {
    measured.props.onLayout({nativeEvent: {layout: {width: 400}}});
  });

  const calls = (alignWordTajweed as jest.Mock).mock.calls as [
    string,
    unknown,
  ][];
  expect(calls.map(([text]) => text)).toEqual(
    mockDkWords.slice(0, 3).map(w => w.text),
  );
  expect(calls[2][1]).toEqual([
    ...qpc[2].segments,
    {text: ' ', rule: null},
    ...qpc[3].segments,
  ]);
  // The end marker is drawn without tajweed; no slot falls back to tafkhim.
  expect(detectWordTafkhim).not.toHaveBeenCalled();
  act(() => tree.unmount());
});
