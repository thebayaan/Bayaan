// @ai-generated
/**
 * useWordFlashHighlights: the flashed words of a Quran search hit are banded
 * on their line, at their character span; other pages keep their highlights
 * object; the flash ends after 3 s.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import type {
  DKLine,
  DKWordInfo,
} from '@/services/mushaf/DigitalKhattDataService';
import {useMushafWordFlashStore} from '@/store/mushafWordFlashStore';
import {useWordFlashHighlights} from '../useWordFlashHighlights';
import type {LineHighlightMap} from '../verseHighlightLayers';

// Page 1: line 0 holds 1:1 words 1-2, line 1 holds 1:1 words 3-4.
const mockWords = new Map<number, DKWordInfo>(
  ['بِسْمِ', 'ٱللَّهِ', 'ٱلرَّحْمَٰنِ', 'ٱلرَّحِيمِ'].map((text, i) => [
    i + 1,
    {text, verseKey: '1:1', wordPositionInVerse: i + 1},
  ]),
);
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    getWordText: (id: number) => mockWords.get(id)?.text ?? '',
    getWordInfo: (id: number) => mockWords.get(id),
  },
}));
jest.mock('@/services/mushaf/MushafVerseMapService', () => ({
  mushafVerseMapService: {
    getOrderedVerseKeysForPage: (page: number) => (page === 1 ? ['1:1'] : []),
  },
}));

const line = (lineNumber: number, first: number, last: number): DKLine => ({
  page_number: 1,
  line_number: lineNumber,
  line_type: 'ayah',
  is_centered: 0,
  first_word_id: first,
  last_word_id: last,
  surah_number: 1,
});
const LINES = [line(1, 1, 2), line(2, 3, 4)];

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

function renderPage(page: number, base: LineHighlightMap) {
  const results: LineHighlightMap[] = [];
  function Probe(): null {
    results.push(useWordFlashHighlights(page, LINES, base, '#000000', false));
    return null;
  }
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(<Probe />);
  });
  return {
    latest: () => results[results.length - 1],
    renders: () => results.length,
    unmount: () => act(() => renderer?.unmount()),
  };
}

let errorSpy: jest.SpyInstance;
beforeEach(() => {
  jest.useFakeTimers();
  act(() => useMushafWordFlashStore.getState().clear());
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  errorSpy.mockRestore();
  jest.useRealTimers();
});

describe('useWordFlashHighlights', () => {
  it('bands each flashed word on its line and span', () => {
    const base: LineHighlightMap = new Map([
      [0, [{start: 0, end: 1, color: 'red'}]],
    ]);
    const view = renderPage(1, base);
    expect(view.latest()).toBe(base);
    act(() => useMushafWordFlashStore.getState().show('1:1', [2, 3]));
    const out = view.latest();
    // Word 2 starts after "بِسْمِ " on line 0; word 3 opens line 1.
    const word1 = mockWords.get(1)?.text ?? '';
    const word2 = mockWords.get(2)?.text ?? '';
    const word3 = mockWords.get(3)?.text ?? '';
    expect(out.get(0)).toEqual([
      {start: 0, end: 1, color: 'red'},
      {
        start: word1.length + 1,
        end: word1.length + word2.length,
        color: 'rgba(0, 0, 0, 0.25)',
        style: 'band',
      },
    ]);
    expect(out.get(1)).toEqual([
      {
        start: 0,
        end: word3.length - 1,
        color: 'rgba(0, 0, 0, 0.25)',
        style: 'band',
      },
    ]);
    view.unmount();
  });

  it('leaves other pages alone, and does not re-render them', () => {
    const base: LineHighlightMap = new Map();
    const view = renderPage(2, base);
    const before = view.renders();
    act(() => useMushafWordFlashStore.getState().show('1:1', [2]));
    expect(view.latest()).toBe(base);
    expect(view.renders()).toBe(before);
    view.unmount();
  });

  it('ends the flash after 3 seconds', () => {
    const base: LineHighlightMap = new Map();
    const view = renderPage(1, base);
    act(() => useMushafWordFlashStore.getState().show('1:1', [1]));
    expect(view.latest()).not.toBe(base);
    act(() => jest.advanceTimersByTime(2999));
    expect(view.latest()).not.toBe(base);
    act(() => jest.advanceTimersByTime(1));
    expect(view.latest()).toBe(base);
    expect(useMushafWordFlashStore.getState().flash).toBeNull();
    view.unmount();
  });

  it('restarts the timer when the same words flash again', () => {
    act(() => useMushafWordFlashStore.getState().show('1:1', [1]));
    const first = useMushafWordFlashStore.getState().flash?.id;
    act(() => jest.advanceTimersByTime(2000));
    act(() => useMushafWordFlashStore.getState().show('1:1', [1]));
    expect(useMushafWordFlashStore.getState().flash?.id).not.toBe(first);
    act(() => jest.advanceTimersByTime(2000));
    expect(useMushafWordFlashStore.getState().flash).not.toBeNull();
    act(() => jest.advanceTimersByTime(1000));
    expect(useMushafWordFlashStore.getState().flash).toBeNull();
  });
});
