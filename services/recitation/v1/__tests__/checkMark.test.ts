import {BLANK, WORD} from '../../secondLook/ctc';
import {tokensOf} from '../../secondLook/judge';
import {checkV1Mark, type CheckContext} from '../checkMark';
import type {V1Mark, V1Timeline} from '../types';

const VOCAB = 31;

/** Log-probabilities for these words said in order, with silence around. */
function said(words: readonly string[]): {logp: Float32Array; frames: number} {
  const path: number[] = [BLANK, BLANK, BLANK];
  words.forEach((w, i) => {
    if (i > 0) path.push(WORD, BLANK);
    for (const t of tokensOf(w)) path.push(t, t, BLANK);
  });
  path.push(BLANK, BLANK, BLANK);
  const logp = new Float32Array(path.length * VOCAB).fill(-20);
  path.forEach((tok, t) => {
    logp[t * VOCAB + tok] = -0.01;
  });
  return {logp, frames: path.length};
}

// Two ayat of four words each, in the second model's letters.
const AYAT: Record<string, string[]> = {
  '1:1': ['بتث', 'جحخ', 'دذر', 'زسش'],
  '1:2': ['صضط', 'ظعغ', 'فقك', 'لمن'],
};

const emptyTimeline: V1Timeline = {
  words: new Map(),
  ayahEntered: new Map(),
  path: [],
};

/** A context whose second model hears `runs` in turn. */
function context(
  runs: {logp: Float32Array; frames: number}[],
  extra: Partial<CheckContext> = {},
): CheckContext {
  let i = 0;
  return {
    places: {
      wordFrames: () => null,
      ayahEnteredAt: () => 0,
      wordCount: (s, a) => AYAT[`${s}:${a}`]?.length ?? 0,
    },
    timeline: emptyTimeline,
    heard: () => 16000 * 60,
    samples: (start, end) => new Float32Array(Math.max(0, end - start)),
    features: async () => ({data: new Float32Array(40 * 80), frames: 40}),
    run: async () => runs[Math.min(i++, runs.length - 1)],
    letters: (s, a) => AYAT[`${s}:${a}`] ?? null,
    alternatives: () => [],
    ...extra,
  };
}

const mark = (over: Partial<V1Mark>): V1Mark => ({
  id: 'm',
  state: 'confirmed',
  errorClass: 'wrong_word',
  surah: 1,
  ayah: 1,
  word: 1,
  totalWords: 4,
  audioTime: 5,
  confidence: 0.8,
  ...over,
});

describe('checkV1Mark: wrong and left-out words (the step 2 rule)', () => {
  it('cancels an interior wrong word the judge hears as written', async () => {
    const answer = await checkV1Mark(
      mark({word: 1}),
      context([said(['بتث', 'جحخ', 'دذر'])]),
    );
    expect(answer).toMatchObject({
      outcome: 'cancelled',
      why: 'the written word fits',
    });
    expect(answer.detail.say).toBe('fits');
  });

  it('keeps a word the judge hears as another word', async () => {
    const answer = await checkV1Mark(
      mark({word: 1}),
      context([said(['بتث', 'ثجح', 'دذر'])], {alternatives: () => ['ثجح']}),
    );
    expect(answer).toMatchObject({outcome: 'kept'});
    expect(answer.detail.say).toBe('wrong');
  });

  it('cancels a left-out first word that was said', async () => {
    const answer = await checkV1Mark(
      mark({word: 0, errorClass: 'omitted_word'}),
      context([said(['بتث', 'جحخ'])]),
    );
    expect(answer).toMatchObject({
      outcome: 'cancelled',
      why: 'the written word fits',
    });
  });

  it('on an ayah edge a fitting word goes to the cancel step, which cancels it', async () => {
    const answer = await checkV1Mark(
      mark({word: 3}),
      context([said(['جحخ', 'دذر', 'زسش']), said(['زسش'])]),
    );
    expect(answer).toMatchObject({
      outcome: 'cancelled',
      why: 'no spelling beats it',
    });
    expect(answer.detail.gap).not.toBeNull();
  });

  it('fails open, so the mark shows, on corrupted model output', async () => {
    const bad = said(['بتث', 'جحخ']);
    bad.logp[4 * VOCAB + 7] = -4e5;
    const answer = await checkV1Mark(mark({word: 1}), context([bad]));
    expect(answer).toMatchObject({
      outcome: 'failed',
      reason: 'corrupted model output, row 4',
    });
  });

  it('fails open for a word with no letters (the three split ayat)', async () => {
    const answer = await checkV1Mark(mark({surah: 15, ayah: 7}), context([]));
    expect(answer).toMatchObject({
      outcome: 'failed',
      reason: 'no letters for this word',
    });
  });

  it('fails open on a slice too short to score', async () => {
    const answer = await checkV1Mark(
      mark({word: 1}),
      context([said(['بتث'])], {
        features: async () => ({data: new Float32Array(0), frames: 3}),
      }),
    );
    expect(answer).toMatchObject({
      outcome: 'failed',
      reason: 'too little of the slice',
    });
  });
});

describe('checkV1Mark: added words', () => {
  it('keeps an added word where something else was said in the gap', async () => {
    const answer = await checkV1Mark(
      mark({errorClass: 'added_word', word: 2}),
      context([said(['بتث', 'جحخ', 'هوي', 'دذر', 'زسش'])]),
    );
    expect(answer).toMatchObject({
      outcome: 'kept',
      why: 'an extra word was said',
    });
    expect(answer.detail.insertionGain).toBeGreaterThan(10);
  });

  it('cancels it where the words follow each other', async () => {
    const answer = await checkV1Mark(
      mark({errorClass: 'added_word', word: 2}),
      context([said(['بتث', 'جحخ', 'دذر', 'زسش'])]),
    );
    expect(answer).toMatchObject({
      outcome: 'cancelled',
      why: 'nothing extra was said',
    });
  });

  it('cancels it where the reader repeated the word before', async () => {
    const answer = await checkV1Mark(
      mark({errorClass: 'added_word', word: 2}),
      context([said(['بتث', 'جحخ', 'جحخ', 'دذر', 'زسش'])]),
    );
    expect(answer).toMatchObject({
      outcome: 'cancelled',
      why: 'a repeat, not an added word',
    });
  });
});

describe('checkV1Mark: where an added word and a late mark are read', () => {
  it('reads only the gap before the word Tilawa names, and marks that word', async () => {
    const before = await checkV1Mark(
      mark({errorClass: 'added_word', word: 2}),
      context([said(['بتث', 'جحخ', 'هوي', 'دذر', 'زسش'])]),
    );
    expect(before).toMatchObject({
      outcome: 'kept',
      gapRight: {surah: 1, ayah: 1, word: 2},
    });
    // An extra word after the named one is no part of this mark.
    const after = await checkV1Mark(
      mark({errorClass: 'added_word', word: 2}),
      context([said(['بتث', 'جحخ', 'دذر', 'هوي', 'زسش'])]),
    );
    expect(after).toMatchObject({
      outcome: 'cancelled',
      why: 'nothing extra was said',
    });
  });

  it('a mark confirmed late is read where its word was heard', async () => {
    const timeline: V1Timeline = {
      words: new Map([['1:1:1', {from: 4, to: 5}]]),
      ayahEntered: new Map([['1:1', 3]]),
      path: [[4, {surah: 1, ayah: 1, word: 1}]],
    };
    const answer = await checkV1Mark(
      mark({word: 1, audioTime: 30}),
      context([said(['بتث', 'جحخ', 'دذر'])], {timeline}),
    );
    expect(answer.detail.slice?.[1]).toBeCloseTo(5.48, 2);
  });

  it('a mark confirmed before its word was heard is read where the word came', async () => {
    const timeline: V1Timeline = {
      words: new Map([['1:1:1', {from: 5, to: 6}]]),
      ayahEntered: new Map([['1:1', 4]]),
      path: [[5, {surah: 1, ayah: 1, word: 1}]],
    };
    const answer = await checkV1Mark(
      mark({word: 1, audioTime: 2}),
      context([said(['بتث', 'جحخ', 'دذر'])], {timeline}),
    );
    expect(answer.detail.slice?.[1]).toBeCloseTo(6.48, 2);
  });

  it('a first word the follower never landed on is read where the reader went on', async () => {
    const timeline: V1Timeline = {
      words: new Map([['1:2:0', {from: 7, to: 8}]]),
      ayahEntered: new Map([['1:2', 7]]),
      path: [[7, {surah: 1, ayah: 2, word: 0}]],
    };
    const answer = await checkV1Mark(
      mark({word: 0, audioTime: 2}),
      context([said(['بتث', 'جحخ'])], {timeline}),
    );
    expect(answer.detail.slice?.[1]).toBeCloseTo(7.48, 2);
  });

  it('a left-out word confirmed late is read where the word before it was heard', async () => {
    const timeline: V1Timeline = {
      words: new Map([['1:1:0', {from: 6, to: 7}]]),
      ayahEntered: new Map([['1:1', 6]]),
      path: [[6, {surah: 1, ayah: 1, word: 0}]],
    };
    const answer = await checkV1Mark(
      mark({word: 1, errorClass: 'omitted_word', audioTime: 40}),
      context([said(['بتث', 'دذر'])], {timeline}),
    );
    expect(answer.detail.slice?.[1]).toBeCloseTo(7.48, 2);
  });
});

describe('checkV1Mark: the basmala before a first word', () => {
  // The app text's basmala (1:1) and two first ayat, in the second model's letters.
  const OPENINGS: Record<string, string[]> = {
    '1:1': ['بسم', 'الله', 'الرحمن', 'الرحيم'],
    '2:1': ['الم'],
    '9:1': ['الم'],
    '2:5': ['اولءك', 'علي', 'هدي'],
  };
  const withOpenings = (
    runs: {logp: Float32Array; frames: number}[],
    timeline: V1Timeline = emptyTimeline,
  ) =>
    context(runs, {
      letters: (s, a) => OPENINGS[`${s}:${a}`] ?? null,
      timeline,
    });
  const basmalaThen = (words: string[]) =>
    said(['بسم', 'الله', 'الرحمن', 'الرحيم', ...words]);

  it("a surah's first word said after the basmala is read with it, and fits", async () => {
    const answer = await checkV1Mark(
      mark({surah: 2, ayah: 1, word: 0, totalWords: 1}),
      withOpenings([basmalaThen(['الم']), said(['الم'])]),
    );
    expect(answer).toMatchObject({outcome: 'cancelled'});
  });

  it('At-Tawbah has no basmala: the same audio is not read with one', async () => {
    const answer = await checkV1Mark(
      mark({surah: 9, ayah: 1, word: 0, totalWords: 1}),
      withOpenings([basmalaThen(['الم']), said(['الم'])]),
    );
    expect(answer.outcome).not.toBe('cancelled');
  });

  it("no added word before a surah's first word", async () => {
    const answer = await checkV1Mark(
      mark({
        errorClass: 'added_word',
        surah: 2,
        ayah: 1,
        word: 0,
        totalWords: 1,
      }),
      withOpenings([basmalaThen(['الم'])]),
    );
    expect(answer).toMatchObject({
      outcome: 'cancelled',
      why: "before a first word the reader may say the basmala or a'udhu billah",
    });
    expect(answer.detail.slice).toBeUndefined();
  });

  it("no added word before the take's first word, mid-surah", async () => {
    const answer = await checkV1Mark(
      mark({
        errorClass: 'added_word',
        surah: 2,
        ayah: 5,
        word: 0,
        totalWords: 3,
      }),
      withOpenings([basmalaThen(['اولءك', 'علي'])], {
        words: new Map([['2:5:0', {from: 4, to: 5}]]),
        ayahEntered: new Map([['2:5', 4]]),
        path: [[4, {surah: 2, ayah: 5, word: 0}]],
      }),
    );
    expect(answer).toMatchObject({outcome: 'cancelled'});
  });
});

describe('checkV1Mark: skipped passages', () => {
  // The reader read 1:1 to its second word, then went on at 1:2's first word.
  const skipTimeline: V1Timeline = {
    words: new Map([
      ['1:1:0', {from: 0.5, to: 1}],
      ['1:1:1', {from: 1, to: 2}],
      ['1:2:0', {from: 2, to: 3}],
    ]),
    ayahEntered: new Map([
      ['1:1', 0.5],
      ['1:2', 2],
    ]),
    path: [
      [0.5, {surah: 1, ayah: 1, word: 0}],
      [1, {surah: 1, ayah: 1, word: 1}],
      [2, {surah: 1, ayah: 2, word: 0}],
    ],
  };

  it('keeps a skip the audio shows, and says where the reader went on', async () => {
    const answer = await checkV1Mark(
      mark({errorClass: 'skipped_passage', word: 2, audioTime: 3}),
      context([said(['بتث', 'جحخ', 'صضط', 'ظعغ'])], {timeline: skipTimeline}),
    );
    expect(answer).toMatchObject({
      outcome: 'kept',
      resumedAt: {surah: 1, ayah: 2, word: 0},
    });
    expect(answer.detail.skipGain).toBeGreaterThan(6);
  });

  it('finds where the reader went on even when the follower walked into the skipped words first', async () => {
    const walked: V1Timeline = {
      ...skipTimeline,
      path: [
        [0.5, {surah: 1, ayah: 1, word: 0}],
        [1, {surah: 1, ayah: 1, word: 1}],
        [2, {surah: 1, ayah: 1, word: 2}],
        [2.5, {surah: 1, ayah: 1, word: 3}],
      ],
    };
    const answer = await checkV1Mark(
      mark({errorClass: 'skipped_passage', word: 2, audioTime: 20}),
      context([said(['بتث', 'جحخ', 'صضط', 'ظعغ'])], {timeline: walked}),
    );
    expect(answer).toMatchObject({
      outcome: 'kept',
      resumedAt: {surah: 1, ayah: 2, word: 0},
    });
    // Read from just before the last word read, not at the late confirmation.
    expect(answer.detail.slice).toEqual([0, 6]);
  });

  it('cancels it when the words were said after all', async () => {
    const answer = await checkV1Mark(
      mark({errorClass: 'skipped_passage', word: 2, audioTime: 3}),
      context([said(['بتث', 'جحخ', 'دذر', 'زسش'])], {timeline: skipTimeline}),
    );
    expect(answer).toMatchObject({
      outcome: 'cancelled',
      why: 'the skipped words were said',
    });
  });

  it('fails open when the words before the skip were never heard', async () => {
    const answer = await checkV1Mark(
      mark({errorClass: 'skipped_passage', word: 2, audioTime: 3}),
      context([said(['بتث'])]),
    );
    expect(answer).toMatchObject({
      outcome: 'failed',
      reason: 'the words before the skip were not heard',
    });
  });
});
