// A mark appearing on a canvas says nothing to a screen reader, so it is announced.
import React from 'react';
import {AccessibilityInfo} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';
import type {WordMark} from '@/services/recitation/wordMarks';
import {useRecitationTrackingStore} from '@/store/recitationTrackingStore';
import {useRecitationMarkAnnouncements} from '../useRecitationMarkAnnouncements';

jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    getVerseWords: () =>
      [1, 2, 3, 4].map(p => ({
        verseKey: '18:3',
        wordPositionInVerse: p,
        text: 'w',
      })),
  },
}));

function mark(extra: Partial<WordMark> = {}): WordMark {
  return {
    surah: 18,
    ayah: 3,
    word: 1,
    totalWords: 4,
    kind: 'wrong',
    status: 'mistake',
    since: 0,
    ...extra,
  };
}

function Host(): null {
  useRecitationMarkAnnouncements();
  return null;
}

describe('announcing word marks', () => {
  let announce: jest.SpyInstance;
  let host: TestRenderer.ReactTestRenderer;

  beforeEach(async () => {
    announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => undefined);
    useRecitationTrackingStore.setState({status: 'listening', marks: []});
    await act(async () => {
      host = TestRenderer.create(<Host />);
    });
  });

  afterEach(async () => {
    await act(async () => host.unmount());
    announce.mockRestore();
    useRecitationTrackingStore.setState({status: 'off', marks: []});
  });

  const setMarks = (marks: WordMark[]) =>
    act(async () => {
      useRecitationTrackingStore.setState({marks});
    });

  it('says what may have happened, and where', async () => {
    await setMarks([mark()]);
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith(
      'You may have said a different word here. Al-Kahf · ayah 3 · word 2',
    );
  });

  it('says an added mark is before its word', async () => {
    await setMarks([mark({kind: 'added'})]);
    expect(announce).toHaveBeenCalledWith(
      'An extra word may have been heard here. Al-Kahf · ayah 3 · before word 2',
    );
  });

  it('says a mark once, and only the new one when another comes', async () => {
    const first = mark();
    await setMarks([first]);
    await setMarks([first]);
    expect(announce).toHaveBeenCalledTimes(1);
    await setMarks([first, mark({word: 3, kind: 'missed'})]);
    expect(announce).toHaveBeenCalledTimes(2);
    expect(announce).toHaveBeenLastCalledWith(
      'You may have missed this word. Al-Kahf · ayah 3 · word 4',
    );
  });

  it('a word and the added mark before it are two marks', async () => {
    await setMarks([mark(), mark({kind: 'added'})]);
    expect(announce).toHaveBeenCalledTimes(2);
  });

  it('a mark corrected says nothing', async () => {
    const first = mark();
    await setMarks([first]);
    await setMarks([{...first, status: 'corrected'}]);
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it('a word marked again after it was corrected is said again', async () => {
    const first = mark();
    await setMarks([first]);
    await setMarks([{...first, status: 'corrected'}]);
    await setMarks([first]);
    expect(announce).toHaveBeenCalledTimes(2);
  });

  it('says nothing once the take is over', async () => {
    await act(async () => {
      useRecitationTrackingStore.setState({status: 'off', marks: [mark()]});
    });
    expect(announce).not.toHaveBeenCalled();
  });
});
