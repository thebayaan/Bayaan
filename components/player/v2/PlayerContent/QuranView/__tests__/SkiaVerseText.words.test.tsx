// @ai-generated
/**
 * SkiaVerseText with `words` (a rewayah verse row, decision 3): it draws
 * exactly the given words (blank slots skipped, as the mushaf lays them
 * out) instead of reading a verse key's words, and runs the overlays on
 * those words. Without `words` it reads `verseKey` as before.
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import type {DKWordInfo} from '@/services/mushaf/DigitalKhattDataService';

const mockDrawn: string[] = [];
const mockWordsCalls: unknown[][] = [];
const mockOverlayWords: unknown[] = [];

jest.mock('@shopify/react-native-skia', () => ({
  Canvas: () => null,
  Paragraph: () => null,
  Group: () => null,
  RoundedRect: () => null,
  Skia: {
    Color: (c: string) => c,
    ParagraphBuilder: {
      Make: () => {
        let text = '';
        return {
          pushStyle: () => undefined,
          pop: () => undefined,
          addText: (t: string) => {
            text += t;
          },
          build: () => {
            mockDrawn.push(text);
            return {
              layout: () => undefined,
              getHeight: () => 10,
              getRectsForRange: () => [],
              dispose: () => undefined,
            };
          },
        };
      },
    },
  },
  TextHeightBehavior: {DisableAll: 0},
  TextDirection: {RTL: 0},
}));

jest.mock('@/utils/skiaTextWeight', () => ({
  createTextStrokePaint: () => undefined,
  getArabicTextWeightStrokeWidth: () => 0,
}));

jest.mock('@/hooks/useRewayahWords', () => ({
  useRewayahWords: (verseKey: string | null, rewayah: string) => {
    mockWordsCalls.push([verseKey, rewayah]);
    return verseKey
      ? {
          words: [{text: 'KEYED', verseKey, wordPositionInVerse: 1}],
          status: 'ready',
        }
      : {words: [], status: 'ready'};
  },
}));

jest.mock('@/services/mushaf/AllahNameHighlightService', () => ({
  getTextAllahNameCharMap: () => null,
}));

jest.mock('../verseOverlays', () => ({
  computeVerseCharRuleMap: (input: {words: unknown}) => {
    mockOverlayWords.push(input.words);
    return null;
  },
  computeVerseDiffRanges: (input: {words: unknown}) => {
    mockOverlayWords.push(input.words);
    return [];
  },
}));

import SkiaVerseText from '../SkiaVerseText';
import type {SkTypefaceFontProvider} from '@shopify/react-native-skia';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

function draw(props: {verseKey?: string; words?: readonly DKWordInfo[]}) {
  let out: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    out = TestRenderer.create(
      <SkiaVerseText
        {...props}
        rewayah="warsh"
        fontMgr={{} as SkTypefaceFontProvider}
        fontFamily="DigitalKhattV2"
        fontSize={24}
        textColor="#111111"
        showTajweed={false}
        width={320}
        indexedTajweedData={null}
      />,
    );
  });
  act(() => out!.unmount());
}

beforeEach(() => {
  mockDrawn.length = 0;
  mockWordsCalls.length = 0;
  mockOverlayWords.length = 0;
});

describe('SkiaVerseText words', () => {
  // Placeholder words of one row: a blank slot in the middle, and a verse
  // number inline at the end of the last slot.
  const words: DKWordInfo[] = [
    {text: 'w1', verseKey: '1:7', wordPositionInVerse: 1},
    {text: '', verseKey: '1:7', wordPositionInVerse: 2},
    {text: 'w3 ۝٦', verseKey: '1:7', wordPositionInVerse: 3},
  ];

  it('draws exactly the given words, without reading a verse', () => {
    draw({verseKey: '1:6', words});
    expect(mockWordsCalls.every(([key]) => key === null)).toBe(true);
    expect(mockDrawn[mockDrawn.length - 1]).toBe('w1 w3 ۝٦');
    expect(mockOverlayWords.length).toBeGreaterThan(0);
    expect(mockOverlayWords.every(w => w === words)).toBe(true);
  });

  it('without words it reads the verse key, as before', () => {
    draw({verseKey: '2:1'});
    expect(mockWordsCalls[mockWordsCalls.length - 1]).toEqual(['2:1', 'warsh']);
    expect(mockDrawn[mockDrawn.length - 1]).toBe('KEYED');
  });
});
