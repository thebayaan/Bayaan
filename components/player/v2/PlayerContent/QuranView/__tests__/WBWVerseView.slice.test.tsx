// @ai-generated
/**
 * WBWVerseView `wordRange` / `hafsNotice` (a rewayah verse row, decision 3):
 * a row that holds part of a Hafs verse shows only the Hafs words of its own
 * slots (and the Hafs end marker only when its slot is in the row), matched
 * over the whole verse first; the disclosure can name the Hafs verse.
 * Without them the grid is the whole verse with its usual disclosure.
 * Placeholder words.
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

jest.mock('@shopify/react-native-skia', () => ({
  Canvas: () => null,
  Paragraph: () => null,
  Skia: {},
  TextHeightBehavior: {DisableAll: 0},
  TextDirection: {RTL: 0},
}));

// Hafs 1:7 as placeholder words: 9 words and the end marker (slot 10).
jest.mock('@/hooks/useRewayahWords', () => {
  const words = Array.from({length: 10}, (_, i) => ({
    text: i === 9 ? '۝٧' : `h${i + 1}`,
    verseKey: '1:7',
    wordPositionInVerse: i + 1,
  }));
  return {useRewayahWords: () => ({words, status: 'ready'})};
});

jest.mock('@/services/wbw/WBWDataService', () => ({
  wbwDataService: {
    getVerseWordsCached: () =>
      Array.from({length: 9}, (_, i) => ({
        position: i + 1,
        textUthmani: `h${i + 1}`,
        translation: `t${i + 1}`,
        transliteration: `tl${i + 1}`,
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
  alignWordTajweed: () => [],
  detectWordTafkhim: () => [],
}));

jest.mock('@/services/mushaf/AllahNameHighlightService', () => ({
  wordContainsAllahName: () => false,
}));

jest.mock('@/utils/skiaTextWeight', () => ({
  createTextStrokePaint: () => undefined,
  getArabicTextWeightStrokeWidth: () => 0,
}));

import {WBWVerseView} from '../WBWVerseView';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

/** Every string the grid renders (fallback layout: no font manager). */
function grid(props: {
  wordRange?: {first: number; last: number};
  hafsNotice?: string;
  rewayah?: 'hafs' | 'warsh';
}): string[] {
  let out: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    out = TestRenderer.create(
      <WBWVerseView
        verseKey="1:7"
        textColor="#111111"
        arabicFontSize={24}
        dkFontFamily="DigitalKhattV2"
        fontMgr={null}
        showTranslation={false}
        showTransliteration={false}
        onWordPress={() => undefined}
        selectedWordPosition={null}
        showTajweed={false}
        indexedTajweedData={null}
        rewayah={props.rewayah ?? 'warsh'}
        wordRange={props.wordRange}
        hafsNotice={props.hafsNotice}
      />,
    );
  });
  const strings: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node === 'string') strings.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object' && 'children' in node) {
      walk((node as {children: unknown}).children);
    }
  };
  walk(out!.toJSON());
  act(() => out!.unmount());
  return strings;
}

describe('WBWVerseView word range', () => {
  it('the whole Hafs verse by default, with the usual disclosure', () => {
    expect(grid({})).toEqual([
      'Word-by-word shown in Hafs',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'h7',
      'h8',
      'h9',
      '۝٧',
    ]);
  });

  it('the first part of a split Hafs verse: its words, no Hafs marker', () => {
    expect(
      grid({
        wordRange: {first: 1, last: 4},
        hafsNotice: 'Word-by-word shown in Hafs 1:7',
      }),
    ).toEqual(['Word-by-word shown in Hafs 1:7', 'h1', 'h2', 'h3', 'h4']);
  });

  it('the later part: its words and the end marker slot it holds', () => {
    expect(grid({wordRange: {first: 5, last: 10}})).toEqual([
      'Word-by-word shown in Hafs',
      'h5',
      'h6',
      'h7',
      'h8',
      'h9',
      '۝٧',
    ]);
  });

  it('a Hafs context shows no disclosure, as before', () => {
    expect(grid({rewayah: 'hafs'})[0]).toBe('h1');
  });
});
