// Page turns while following a recitation: with the text shown the page turns
// as its last word is recited, so the reader can see what comes next; with
// the text hidden it turns only once the reader is on the next page, so the
// next page (and any surah heading on it) is not shown early.

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

const mockSettings = {recitationHideText: false};
jest.mock('@/store/mushafSettingsStore', () => ({
  useMushafSettingsStore: (select: (s: typeof mockSettings) => unknown) =>
    select(mockSettings),
}));
jest.mock('@/store/mushafPlayerStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    useMushafPlayerStore: create(() => ({
      playbackState: 'idle',
      currentVerseKey: null,
    })),
  };
});
// Page 562 ends inside 67:12 at its word 5; 67:12 runs on to page 563.
jest.mock('@/components/mushaf/skia/recitedWord', () => ({
  dkWordPosition: (_words: unknown, index: number) => index + 1,
  lastWordOnPage: (lines: {page: number}[]) =>
    lines[0]?.page === 562 ? {verseKey: '67:12', position: 5} : null,
}));
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    getPageLines: (page: number) => [{page}],
    getVerseWords: () => [],
    getPageForVerse: (key: string) =>
      Number(key.split(':')[1]) <= 12 ? 562 : 563,
  },
}));
jest.mock('@/services/mushaf/MushafVerseMapService', () => ({
  mushafVerseMapService: {
    getOrderedVerseKeysForPage: (page: number) =>
      page === 562
        ? ['67:1', '67:2', '67:12']
        : page === 563
          ? ['67:12', '67:13', '67:14']
          : [],
  },
}));

import {useMushafAutoPageTurn} from '../useMushafAutoPageTurn';
import {
  RECITATION_TRACKING_IDLE,
  useRecitationTrackingStore,
} from '@/store/recitationTrackingStore';

function Harness({navigate}: {navigate: (page: number) => void}) {
  useMushafAutoPageTurn(562, navigate);
  return null;
}

function recite(verseKey: string, wordIndex: number): void {
  act(() => {
    useRecitationTrackingStore.setState({
      status: 'listening',
      locked: true,
      verseKey,
      wordIndex,
      totalWords: 9,
    });
  });
}

let navigate: jest.Mock;

function mount(hidden: boolean): void {
  mockSettings.recitationHideText = hidden;
  act(() => {
    TestRenderer.create(<Harness navigate={navigate} />);
  });
}

beforeEach(() => {
  useRecitationTrackingStore.setState(RECITATION_TRACKING_IDLE);
  navigate = jest.fn();
});

describe('useMushafAutoPageTurn while reciting', () => {
  it('with the text shown, the page turns as its last word is recited', () => {
    mount(false);
    recite('67:12', 3);
    expect(navigate).not.toHaveBeenCalled();
    recite('67:12', 4);
    expect(navigate).toHaveBeenCalledWith(563);
  });

  it('with the text hidden, the last word on the page does not turn it', () => {
    mount(true);
    recite('67:12', 4);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('with the text hidden, the first word on the next page turns it', () => {
    mount(true);
    recite('67:12', 4);
    recite('67:12', 5);
    expect(navigate).toHaveBeenCalledWith(563);
  });

  it('with the text hidden, an ayah starting the next page turns it', () => {
    mount(true);
    recite('67:13', 0);
    expect(navigate).toHaveBeenCalledWith(563);
  });
});
