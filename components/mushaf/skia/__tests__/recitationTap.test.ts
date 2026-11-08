// Tapping a marked word: which mark, if any, is under the tapped character.

const mockSpans = [
  {start: 0, wordEnd: 4, info: {verseKey: '67:12', wordPositionInVerse: 2}},
  {start: 6, wordEnd: 11, info: {verseKey: '67:12', wordPositionInVerse: 3}},
];
jest.mock('@/services/mushaf/lineWordSpans', () => ({
  getLineWordSpans: () => mockSpans,
}));
const mockVerseWords = [1, 2, 3, 4].map(p => ({
  verseKey: '67:12',
  wordPositionInVerse: p,
  text: 'w',
}));
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {getVerseWords: () => mockVerseWords},
}));

import type {DKLine} from '@/services/mushaf/DigitalKhattDataService';
import type {WordMark} from '@/services/recitation/wordMarks';
import {markAtChar} from '../recitationTap';

const LINE = {line_type: 'ayah'} as unknown as DKLine;

function mark(word: number): WordMark {
  return {
    surah: 67,
    ayah: 12,
    word,
    totalWords: 4,
    kind: 'wrong',
    status: 'mistake',
    since: 0,
  };
}

describe('markAtChar', () => {
  it("finds the mark on the tapped word (Tilawa's index 2 is the 3rd word)", () => {
    expect(markAtChar(LINE, 8, [mark(0), mark(2)])).toEqual(mark(2));
  });

  it('a tap on a word without a mark finds nothing', () => {
    expect(markAtChar(LINE, 2, [mark(2)])).toBeNull();
  });

  it('a tap between words finds nothing', () => {
    expect(markAtChar(LINE, 5, [mark(1), mark(2)])).toBeNull();
  });

  it('no marks, nothing to find', () => {
    expect(markAtChar(LINE, 8, [])).toBeNull();
  });

  describe('an added mark', () => {
    // Before Tilawa's index 2 (the 3rd word, 6 to 11); the gap before it is 5.
    const added: WordMark = {...mark(2), kind: 'added'};

    it('a tap on the gap before its word finds it', () => {
      expect(markAtChar(LINE, 5, [added])).toEqual(added);
    });

    it('so does a tap on the first letter of its word', () => {
      expect(markAtChar(LINE, 6, [added])).toEqual(added);
    });

    it('so does a tap anywhere on its word: the gap alone is too small to hit', () => {
      expect(markAtChar(LINE, 8, [added])).toEqual(added);
      expect(markAtChar(LINE, 11, [added])).toEqual(added);
    });

    it('a tap on the word before does not', () => {
      expect(markAtChar(LINE, 3, [added])).toBeNull();
    });

    it('a red mark on the same word comes first on its letters', () => {
      expect(markAtChar(LINE, 6, [added, mark(2)])).toEqual(mark(2));
      expect(markAtChar(LINE, 8, [added, mark(2)])).toEqual(mark(2));
      expect(markAtChar(LINE, 5, [added, mark(2)])).toEqual(added);
    });
  });
});
