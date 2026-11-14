import type {CorrectionIssue, WorkerOutbound} from '@tilawa/core';
import {
  finalSequence,
  verseMatch,
  wordProgress,
} from '@/test-utils/recitationMocks';
import {
  finishTake,
  startTake,
  takeEvent,
  takePeek,
  type TakeBuilder,
} from '../take';

function newTake(): TakeBuilder {
  return startTake({
    id: 'take-1',
    purpose: 'follow',
    startedAt: 1000,
    hidden: true,
    expected: null,
  });
}

/** Feeds [message, time] pairs in order. */
function feed(b: TakeBuilder, events: [WorkerOutbound, number][]): TakeBuilder {
  return events.reduce((acc, [msg, at]) => takeEvent(acc, msg, at), b);
}

function correction(
  issue: Partial<CorrectionIssue> & Pick<CorrectionIssue, 'kind'>,
  phase: 'error' | 'idle' = 'error',
): WorkerOutbound {
  return {
    type: 'correction',
    state: {
      phase,
      issue: {surah: 18, ayah: 23, word: 1, wordIndex: 0, ...issue},
      resume: null,
      attempt: 0,
      outcome: null,
    },
    totalWords: 10,
  };
}

describe('take reducer', () => {
  it('final_sequence wins over verse_match for the ayah list', () => {
    const b = feed(newTake(), [
      [verseMatch(36, 1, 0.8), 2000],
      [verseMatch(36, 2, 0.7), 3000],
    ]);
    const take = finishTake(
      b,
      [
        finalSequence([
          {surah: 36, ayah: 1, confidence: 0.9},
          {surah: 36, ayah: 2, confidence: 0.85},
          {surah: 36, ayah: 3, confidence: 0.6},
        ]),
      ],
      'user',
      9000,
    );
    expect(take.ayat).toEqual([
      {surah: 36, ayah: 1, confidence: 0.9},
      {surah: 36, ayah: 2, confidence: 0.85},
      {surah: 36, ayah: 3, confidence: 0.6},
    ]);
  });

  it('without final_sequence the ayat follow verse_match order', () => {
    const b = feed(newTake(), [
      [verseMatch(36, 2, 0.7), 2000],
      [verseMatch(36, 1, 0.8), 3000],
      [verseMatch(36, 2, 0.95), 4000],
    ]);
    expect(finishTake(b, [], 'user', 9000).ayat).toEqual([
      {surah: 36, ayah: 2, confidence: 0.7},
      {surah: 36, ayah: 1, confidence: 0.8},
    ]);
  });

  it('a 3 s gap before the next word of the same ayah is a stall on that word', () => {
    const b = feed(newTake(), [
      [wordProgress(36, 4, 2, 9), 1000],
      // A verdict update with no movement does not restart the clock.
      [wordProgress(36, 4, 2, 9), 2500],
      [wordProgress(36, 4, 4, 9), 4200],
    ]);
    expect(finishTake(b, [], 'user', 9000).stalls).toEqual([
      {surah: 36, ayah: 4, wordIndex: 3, ms: 3200, at: 4200},
    ]);
  });

  it('a gap under 3 s is not a stall', () => {
    const b = feed(newTake(), [
      [wordProgress(36, 4, 2, 9), 1000],
      [wordProgress(36, 4, 3, 9), 3900],
    ]);
    expect(finishTake(b, [], 'user', 9000).stalls).toEqual([]);
  });

  it("a gap after an ayah's last word is not a stall", () => {
    const b = feed(newTake(), [
      [wordProgress(36, 4, 8, 9), 1000],
      [wordProgress(36, 5, 0, 12), 7000],
    ]);
    expect(finishTake(b, [], 'user', 9000).stalls).toEqual([]);
  });

  it('gaps over 20 s are breaks, not stalls', () => {
    const b = feed(newTake(), [
      [wordProgress(36, 4, 2, 9), 1000],
      [wordProgress(36, 4, 3, 9), 26000],
    ]);
    expect(finishTake(b, [], 'user', 30000).stalls).toEqual([]);
  });

  it('correction errors are logged once each with their source', () => {
    const b = feed(newTake(), [
      [correction({kind: 'possible_omission', ayah: 22, word: 4}), 2000],
      [correction({kind: 'possible_omission', ayah: 22, word: 4}), 2500],
      [correction({kind: 'possible_vowel', ayah: 22, word: 6}, 'idle'), 2600],
    ]);
    const take = finishTake(
      b,
      [
        correction({
          kind: 'possible_skipped_ayah',
          ayah: 23,
          word: 1,
          source: 'ayah_order',
        }),
      ],
      'user',
      9000,
    );
    expect(take.flags).toEqual([
      {
        kind: 'possible_omission',
        surah: 18,
        ayah: 22,
        word: 4,
        source: 'word',
      },
      {
        kind: 'possible_skipped_ayah',
        surah: 18,
        ayah: 23,
        word: 1,
        source: 'ayah_order',
      },
    ]);
  });

  it('peeks are kept in order', () => {
    let b = newTake();
    b = takePeek(b, {surah: 67, ayah: 3, kind: 'word', at: 2000});
    b = takePeek(b, {surah: 67, ayah: 4, kind: 'ayah', at: 5000});
    expect(finishTake(b, [], 'user', 9000).peeks).toEqual([
      {surah: 67, ayah: 3, kind: 'word', at: 2000},
      {surah: 67, ayah: 4, kind: 'ayah', at: 5000},
    ]);
  });

  it('the record keeps the take, its times and why it stopped', () => {
    const take = finishTake(newTake(), [], 'background', 9000);
    expect(take).toMatchObject({
      id: 'take-1',
      purpose: 'follow',
      startedAt: 1000,
      endedAt: 9000,
      hidden: true,
      expected: null,
      stopReason: 'background',
    });
  });
});
