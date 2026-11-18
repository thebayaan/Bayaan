// The added-word mark on a Digital Khatt page: a small red caret in the gap before
// the right word, no letters coloured. Skia is a recorder here, so this checks what
// would be drawn, not how it looks: nobody has seen it on a screen.
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import type {WordMark} from '@/services/recitation/wordMarks';

// Two lines of made-up words. Ayah 1: words 1, 2, then its marker, on line 0, and
// word 3 on line 1. Ayah 2 follows on line 1, after ayah 1's marker on that line.
//   line 0: id 1 (1:1) id 2 (1:2)
//   line 1: id 3 (1:3) id 4 (marker of ayah 1) id 5 (2:1) id 6 (2:2)
const mockWords: Record<
  number,
  {text: string; verseKey: string; wordPositionInVerse: number}
> = {
  1: {text: 'ابت', verseKey: '5:1', wordPositionInVerse: 1},
  2: {text: 'جحخ', verseKey: '5:1', wordPositionInVerse: 2},
  3: {text: 'دذر', verseKey: '5:1', wordPositionInVerse: 3},
  4: {text: '۝١', verseKey: '5:1', wordPositionInVerse: 4},
  5: {text: 'زسش', verseKey: '5:2', wordPositionInVerse: 1},
  6: {text: 'صضط', verseKey: '5:2', wordPositionInVerse: 2},
};
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    getWordText: (id: number) => mockWords[id]?.text ?? '',
    getWordInfo: (id: number) => mockWords[id],
    getVerseWords: (key: string) =>
      Object.values(mockWords).filter(w => w.verseKey === key),
  },
}));
jest.mock('@/services/mushaf/MushafVerseMapService', () => ({
  mushafVerseMapService: {
    getOrderedVerseKeysForPage: () => ['5:1', '5:2'],
    getVerseSegmentsForPage: () => [],
  },
}));

import {useRecitationTrackingStore} from '@/store/recitationTrackingStore';
import {useRecitationLineHighlights} from '../useRecitationLineHighlights';
import {useRecitationMarkColors} from '../useRecitationMarkColors';
import type {LineHighlightMap} from '../verseHighlightLayers';

const LINES = [
  {line_type: 'ayah', first_word_id: 1, last_word_id: 2},
  {line_type: 'ayah', first_word_id: 3, last_word_id: 6},
] as never[];
const NO_HIGHLIGHTS: LineHighlightMap = new Map();

function mark(
  ayah: number,
  word: number,
  totalWords: number,
  kind: WordMark['kind'],
): WordMark {
  return {surah: 5, ayah, word, totalWords, kind, status: 'mistake', since: 0};
}

function pageWith(marks: WordMark[]) {
  useRecitationTrackingStore.setState({marks});
  const out: {
    highlights?: LineHighlightMap;
    colors?: ReturnType<typeof useRecitationMarkColors>;
  } = {};
  function Page(): null {
    out.highlights = useRecitationLineHighlights(
      1,
      LINES,
      NO_HIGHLIGHTS,
      '#000000',
      false,
    );
    out.colors = useRecitationMarkColors(LINES, null, false);
    return null;
  }
  act(() => {
    TestRenderer.create(<Page />);
  });
  return out;
}

afterEach(() => {
  useRecitationTrackingStore.setState({marks: []});
});

describe('where the caret goes', () => {
  it('in the gap before the right word, from that word', () => {
    const {highlights} = pageWith([mark(1, 1, 3, 'added')]);
    expect(highlights?.get(0)).toEqual([
      {start: 4, end: 6, color: '#D32F2F', style: 'caret'},
    ]);
    expect(highlights?.get(1)).toBeUndefined();
  });

  it('at a line break, at the start of the line holding the right word', () => {
    const {highlights} = pageWith([mark(1, 2, 3, 'added')]);
    expect(highlights?.get(0)).toBeUndefined();
    expect(highlights?.get(1)).toEqual([
      {start: 0, end: 2, color: '#D32F2F', style: 'caret'},
    ]);
  });

  it("between ayat, before the next ayah's first word, after the ayah number", () => {
    const {highlights} = pageWith([mark(2, 0, 2, 'added')]);
    // Line 1 reads: word, space, marker, space, then ayah 2's first word at 7.
    expect(highlights?.get(1)).toEqual([
      {start: 7, end: 9, color: '#D32F2F', style: 'caret'},
    ]);
  });

  it('a red word and a caret on one word are two runs', () => {
    const {highlights} = pageWith([
      mark(1, 1, 3, 'wrong'),
      mark(1, 1, 3, 'added'),
    ]);
    expect(highlights?.get(0)?.map(h => h.style)).toEqual([
      'underline',
      'caret',
    ]);
  });
});

describe('no letters are coloured', () => {
  it('an added mark colours nothing', () => {
    const {colors} = pageWith([mark(1, 1, 3, 'added')]);
    expect(colors).toBeNull();
  });

  it('a red mark beside it still does', () => {
    const {colors} = pageWith([mark(1, 1, 3, 'added'), mark(2, 1, 2, 'wrong')]);
    expect(colors?.[0]).toBeNull();
    // Ayah 2's second word, at 11 to 13 of line 1.
    expect([...(colors?.[1]?.keys() ?? [])]).toEqual([11, 12, 13]);
  });
});
