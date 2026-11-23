// @ai-generated
/**
 * WBWVerseView draws each mushaf word with its own word-by-word gloss, over
 * the bundled data (digital-khatt-v2.db and wbw-en.db). Two damaged
 * word-by-word entries threw the grid's old text matching off:
 *  - 25:42: word 9 holds U+FFFD, so every later word showed the previous
 *    word's gloss and the end marker was drawn as word 17;
 *  - 27:26: word 8 ends with U+200F, so the end marker was drawn as a second
 *    slot of word 8.
 * 2:181 writes بَعْدَ مَا as two mushaf slots of one word-by-word word.
 * services/wbw/__tests__/wordAlignment.database.test.ts checks the pairing
 * of every verse; this checks that the grid draws it. Fallback layout (no
 * font manager); each gloss is "#<word-by-word position>".
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

// The Hafs words of a verse, read from the bundled DigitalKhatt file.
jest.mock('@/hooks/useRewayahWords', () => {
  const Database = jest.requireActual('better-sqlite3');
  const file = jest
    .requireActual('path')
    .join(
      __dirname,
      '../../../../../../data/mushaf/digitalkhatt/digital-khatt-v2.db',
    );
  const db = new Database(file, {readonly: true});
  const words = (verseKey: string) => {
    const [surah, ayah] = verseKey.split(':').map(Number);
    return (
      db
        .prepare(
          'SELECT word, text FROM words WHERE surah = ? AND ayah = ? ORDER BY word',
        )
        .all(surah, ayah) as {word: number; text: string}[]
    ).map(row => ({text: row.text, verseKey, wordPositionInVerse: row.word}));
  };
  return {
    useRewayahWords: (verseKey: string) => ({
      words: words(verseKey),
      status: 'ready',
    }),
  };
});

// The verse's word-by-word words, read from the bundled file as
// WBWDataService reads them, each glossed with its position.
jest.mock('@/services/wbw/WBWDataService', () => {
  const Database = jest.requireActual('better-sqlite3');
  const file = jest
    .requireActual('path')
    .join(__dirname, '../../../../../../data/wbw/wbw-en.db');
  const db = new Database(file, {readonly: true});
  const words = (verseKey: string) =>
    (
      db
        .prepare(
          'SELECT position, text_uthmani FROM words WHERE verse_key = ? ORDER BY position',
        )
        .all(verseKey) as {position: number; text_uthmani: string}[]
    ).map(row => ({
      position: row.position,
      textUthmani: row.text_uthmani || '',
      translation: `#${row.position}`,
      transliteration: '',
      audioUrl: '',
    }));
  return {
    wbwDataService: {
      getVerseWordsCached: words,
      getVerseWords: async (verseKey: string) => words(verseKey),
    },
  };
});

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

/** Every string the grid of a Hafs verse renders, in order. */
function grid(verseKey: string): string[] {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(
      <WBWVerseView
        verseKey={verseKey}
        textColor="#111111"
        arabicFontSize={24}
        dkFontFamily="DigitalKhattV2"
        fontMgr={null}
        showTranslation
        showTransliteration={false}
        onWordPress={() => undefined}
        selectedWordPosition={null}
        showTajweed={false}
        indexedTajweedData={null}
        rewayah="hafs"
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
  const tree = renderer as TestRenderer.ReactTestRenderer;
  walk(tree.toJSON());
  act(() => tree.unmount());
  return strings;
}

/** The glosses drawn, in order: which word-by-word word each slot shows. */
const glosses = (strings: readonly string[]) =>
  strings.filter(s => s.startsWith('#')).map(s => Number(s.slice(1)));

const isEndMarker = (text: string) => text.startsWith('۝');

describe('WBWVerseView pairs each mushaf word with its own gloss', () => {
  it.each([
    ['25:42', 17],
    ['27:26', 8],
  ])('%s: one gloss per word, in order, and the end marker last', (key, n) => {
    const strings = grid(key);
    expect(glosses(strings)).toEqual(Array.from({length: n}, (_, i) => i + 1));
    // The end marker is the last item, drawn without a gloss.
    expect(isEndMarker(strings[strings.length - 1])).toBe(true);
    expect(strings.filter(isEndMarker)).toHaveLength(1);
    expect(strings[strings.length - 2]).toBe(`#${n}`);
  });

  it('2:181: the two slots of بَعْدَ مَا both show word 3', () => {
    const strings = grid('2:181');
    expect(glosses(strings)).toEqual([
      1, 2, 3, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
    ]);
    expect(isEndMarker(strings[strings.length - 1])).toBe(true);
  });
});
