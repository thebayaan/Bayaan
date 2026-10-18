import {
  continueKey,
  resumableContinue,
  stableContinue,
  timeLeftLabel,
} from './homeContinue';
import type {ContinueEntry} from '../services/continueListeningStore';

const e = (
  reciterId: string,
  surahNumber: number,
  positionSeconds = 30,
): ContinueEntry => ({
  reciterId,
  rewayahId: 'rw',
  surahNumber,
  positionSeconds,
  durationSeconds: 600,
  updatedAt: 0,
});

describe('stableContinue', () => {
  it('shows the store order the first time', () => {
    const out = stableContinue([], [e('a', 1), e('b', 2)]);
    expect(out.keys).toEqual(['a:1', 'b:2']);
    expect(out.entries.map(continueKey)).toEqual(['a:1', 'b:2']);
  });

  it('keeps the shown order when the store re-sorts, with fresh progress', () => {
    const out = stableContinue(['a:1', 'b:2'], [e('b', 2, 99), e('a', 1)]);
    expect(out.keys).toEqual(['a:1', 'b:2']);
    expect(out.entries[1].positionSeconds).toBe(99);
  });

  it('adds a new entry at the end instead of shifting the cards', () => {
    const out = stableContinue(
      ['a:1', 'b:2'],
      [e('c', 3), e('a', 1), e('b', 2)],
    );
    expect(out.keys).toEqual(['a:1', 'b:2', 'c:3']);
  });

  it('goes back to newest first once focus has left the rail', () => {
    const out = stableContinue(
      ['a:1', 'b:2'],
      [e('c', 3), e('b', 2), e('a', 1)],
      false,
    );
    expect(out.keys).toEqual(['c:3', 'b:2', 'a:1']);
  });

  it('drops entries that left the store', () => {
    const out = stableContinue(['a:1', 'b:2'], [e('b', 2)]);
    expect(out.keys).toEqual(['b:2']);
    expect(out.entries).toHaveLength(1);
  });
});

describe('resumableContinue', () => {
  it('leaves out entries whose reciter is not in the catalog', () => {
    const known = new Set(['a']);
    expect(
      resumableContinue([e('a', 1), e('gone', 2)], id => known.has(id)).map(
        continueKey,
      ),
    ).toEqual(['a:1']);
  });
});

describe('timeLeftLabel', () => {
  const at = (positionSeconds: number, durationSeconds: number): string =>
    timeLeftLabel({positionSeconds, durationSeconds});

  it('says Started when the length is unknown', () => {
    expect(at(30, 0)).toBe('Started');
  });

  it('counts seconds in the last minute of a short surah, not Almost done', () => {
    // Al-'Asr: about a quarter through with 29 s to go.
    expect(at(11, 40)).toBe('29 s left');
  });

  it('says Almost done only near the end', () => {
    expect(at(36, 40)).toBe('Almost done');
    expect(at(560, 600)).toBe('Almost done');
  });

  it('writes minutes, and hours the way collection lengths are written', () => {
    expect(at(0, 12 * 60)).toBe('12 min left');
    expect(at(60, 60 + 134 * 60)).toBe('2 h 14 min left');
  });
});
