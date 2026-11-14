// @ai-generated
import {cutText, isolate, markRuns, pickBilingualText} from '../text';

describe('pickBilingualText', () => {
  it('follows the language’s bilingual content', () => {
    expect(pickBilingualText('ناشر', 'Publisher', 'en')).toBe('Publisher');
    expect(pickBilingualText('ناشر', 'Publisher', 'ar')).toBe('ناشر');
  });

  it('falls back to Arabic when the English form is empty', () => {
    expect(pickBilingualText('ناشر', '', 'en')).toBe('ناشر');
  });
});

it('isolate wraps a value in FSI and PDI', () => {
  expect(isolate('«ا»')).toBe('\u2068«ا»\u2069');
});

describe('cutText', () => {
  it('keeps a short text and cuts a long one at a space', () => {
    expect(cutText('كلمة كلمة', 400)).toBe('كلمة كلمة');
    const long = 'كلمة '.repeat(100);
    const cut = cutText(long, 400);
    expect(cut.length).toBeLessThanOrEqual(401);
    expect(cut.endsWith('كلمة…')).toBe(true);
  });
});

describe('markRuns', () => {
  it('splits a text into marked and unmarked runs', () => {
    expect(markRuns('مَالِكِ', [[2, 3]])).toEqual([
      {text: 'مَ', marked: false},
      {text: 'ا', marked: true},
      {text: 'لِكِ', marked: false},
    ]);
  });

  it('merges overlapping marks and clamps them to the text', () => {
    expect(
      markRuns('abcdef', [
        [4, 9],
        [0, 2],
        [1, 3],
      ]),
    ).toEqual([
      {text: 'abc', marked: true},
      {text: 'd', marked: false},
      {text: 'ef', marked: true},
    ]);
    expect(markRuns('ab', [])).toEqual([{text: 'ab', marked: false}]);
  });
});
