import type {Reciter, Rewayah} from '../types/reciter';
import type {ContinueEntry} from './continueListeningStore';

const rewayah = (id: string, surahs: number[]): Rewayah =>
  ({
    id,
    reciter_id: 'r',
    name: 'Hafs A an Asim',
    style: 'murattal',
    server: `https://cdn/${id}/`,
    source_type: 'mp3quran',
    surah_total: surahs.length,
    surah_list: surahs,
    mp3quran_read_id: null,
    qdc_reciter_id: null,
    is_active: true,
    created_at: '',
    updated_at: '',
  }) as Rewayah;

const reciter = (id: string, rewayat: Rewayah[]): Reciter =>
  ({id, name: id, rewayat}) as unknown as Reciter;

jest.mock('./tvDataService', () => {
  const actual = jest.requireActual('./tvDataService');
  return {...actual, getCachedRewayat: () => null};
});

import {firstVoice, surahProgress, visibleQueue} from './surahsPlayback';

describe('visibleQueue', () => {
  const voice = {reciterId: 'a', rewayahId: 'w', surahNumber: 80};

  it('queues the shown surahs the recitation has, in order', () => {
    const known = [rewayah('w', [78, 80, 81, 114])];
    expect(
      visibleQueue(voice, [78, 79, 80, 81], known).map(q => q.surahNumber),
    ).toEqual([78, 80, 81]);
    expect(visibleQueue(voice, [78, 80], known)[0]).toEqual({
      reciterId: 'a',
      rewayahId: 'w',
      surahNumber: 78,
    });
  });

  it('keeps every shown surah when the recitation is not known yet', () => {
    expect(visibleQueue(voice, [78, 79, 80]).map(q => q.surahNumber)).toEqual([
      78, 79, 80,
    ]);
  });

  it('always holds the pressed surah', () => {
    expect(
      visibleQueue(voice, [1, 2], [rewayah('w', [1])]).map(q => q.surahNumber),
    ).toEqual([80, 1]);
  });
});

describe('firstVoice', () => {
  it('starts with the first shown surah someone has', () => {
    const list = [reciter('a', [rewayah('w', [2, 3])])];
    expect(firstVoice(list, [1, 2, 3])).toEqual({
      reciterId: 'a',
      rewayahId: 'w',
      surahNumber: 2,
    });
  });

  it('falls back to the next candidate, and is null when nobody has any', () => {
    const list = [
      reciter('a', [rewayah('w', [2])]),
      reciter('b', [rewayah('v', [1])]),
    ];
    expect(firstVoice(list, [1])?.reciterId).toBe('b');
    expect(firstVoice(list, [50])).toBeNull();
  });

  it('keeps the chosen reciter when only the first shown surah is missing', () => {
    const list = [
      reciter('a', [rewayah('w', [2, 3])]),
      reciter('b', [rewayah('v', [1, 2, 3])]),
    ];
    expect(firstVoice(list, [1, 2, 3])).toEqual({
      reciterId: 'a',
      rewayahId: 'w',
      surahNumber: 2,
    });
  });
});

describe('surahProgress', () => {
  const entry = (
    reciterId: string,
    surahNumber: number,
    positionSeconds: number,
    durationSeconds = 100,
  ): ContinueEntry => ({
    reciterId,
    rewayahId: 'w',
    surahNumber,
    positionSeconds,
    durationSeconds,
    updatedAt: 0,
  });

  it('keeps the latest entry per surah and skips unknown lengths', () => {
    const {bySurah} = surahProgress([
      entry('a', 1, 50),
      entry('b', 1, 10),
      entry('a', 2, 5, 0),
    ]);
    expect(bySurah.get(1)).toBeCloseTo(0.5);
    expect(bySurah.has(2)).toBe(false);
  });

  it('keeps exact shares, so thresholds are not moved by the rounding', () => {
    const {bySurah} = surahProgress([entry('a', 1, 970, 1000)]);
    expect(bySurah.get(1)).toBe(0.97);
  });

  it('limits to one reciter when asked', () => {
    const {bySurah} = surahProgress(
      [entry('b', 1, 10), entry('a', 1, 50)],
      'a',
    );
    expect(bySurah.get(1)).toBeCloseTo(0.5);
  });

  it('changes its key only when a bar visibly moves', () => {
    const at = (pos: number): string =>
      surahProgress([entry('a', 1, pos, 1000)]).key;
    // 5 s of a 1000 s surah: the same 2% step.
    expect(at(500)).toBe(at(505));
    expect(at(500)).not.toBe(at(530));
    expect(surahProgress([]).key).toBe('');
  });
});
