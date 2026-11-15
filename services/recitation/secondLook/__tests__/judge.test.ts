import {joinWords, sayTokens} from '@/test-utils/secondLookSignals';
import {
  prepare,
  relativeTo,
  scoreNothing,
  scoreWord,
  WORD,
  wordSpan,
} from '../ctc';
import {
  cancelAnswer,
  innerGap,
  judgeAnswer,
  judgeWord,
  scoresFarTooLow,
  tokensOf,
} from '../judge';
import golden from './fixtures/judgeGolden.json';
import cancelGolden from './fixtures/cancelGolden.json';

// The goldens are the output of the plain JavaScript originals on the same inputs,
// at the versions fixtures/originals.json names. Cut by
// scripts/second-look/gen_goldens.mjs, whose --check says whether they still hold.

const say = (words: string[], seed = 5) =>
  sayTokens(joinWords(words, tokensOf), seed);

/** Scores in the ayah's text, with two words of left context and one of right. */
function scoresOf(
  said: string[],
  words: string[],
  j: number,
  candidates: string[],
): number[] {
  const {logp, frames} = say(said);
  const left: number[] = [];
  for (const word of words.slice(Math.max(0, j - 2), j)) {
    left.push(...tokensOf(word), WORD);
  }
  const right: number[] = [];
  for (const word of words.slice(j + 1, j + 2)) {
    right.push(WORD, ...tokensOf(word));
  }
  const p = prepare(relativeTo(logp, frames), frames, left, right);
  return candidates.map(c => scoreWord(p, tokensOf(c)));
}

describe('judgeWord', () => {
  describe.each(golden.cases.map(c => [c.name, c] as const))(
    '%s',
    (_name, c) => {
      const {logp, frames} = sayTokens(joinWords(c.said, tokensOf), c.seed);
      const judged = judgeWord(logp, frames, c.words, c.j, c.mut, c.opts);

      it('has the frames the original had', () => {
        expect(frames).toBe(c.frames);
      });

      it('matches the original judge.mjs', () => {
        expect({
          expected: judged.expected,
          nothing: judged.nothing,
          mut: judged.mut,
          near: [],
        }).toEqual(c.result);
      });

      it("matches the original's first pass in rule.mjs", () => {
        expect({
          expected: judged.exact,
          perLetter: judged.perLetter,
          startFrame: judged.startFrame,
          endFrame: judged.endFrame,
        }).toEqual(c.pass);
      });

      it('gives the answer the original policy gives', () => {
        expect(judgeAnswer(judged)).toBe(c.answer);
      });
    },
  );

  it('scores on the frozen context with no options: two left, none right', () => {
    const {logp, frames} = say(['قال', 'نوح', 'رب']);
    const plain = judgeWord(logp, frames, ['قال', 'نوح', 'رب'], 1, []);
    const asked = judgeWord(logp, frames, ['قال', 'نوح', 'رب'], 1, [], {
      leftWords: 2,
      rightWords: 0,
    });
    expect(plain).toEqual(asked);
  });

  it('names the best alternative first', () => {
    const {logp, frames} = say(['قال', 'لوط', 'رب']);
    const result = judgeWord(logp, frames, ['قال', 'نوح', 'رب'], 1, [
      'هود',
      'لوط',
    ]);
    expect(result.mut[0].a).toBe('لوط');
    expect(result.mut[0].s).toBeGreaterThan(result.expected + 5);
  });

  describe("an ayah's first word must begin near the slice's start", () => {
    // The frozen slice starts near the ayah's start, so a first word far into it
    // is not the first word said: past frame 50 it pays for the frames before it.
    const BEFORE = [
      'من',
      'قبل',
      'ان',
      'الله',
      'قال',
      'نوح',
      'رب',
      'انه',
      'كان',
    ];
    const FIRST_FRAME = 2 + 3 * (joinWords(BEFORE, tokensOf).length + 1);

    it('said early in a long slice, it scores 0', () => {
      const {logp, frames} = say(['انك', 'لمن', ...BEFORE]);
      expect(frames).toBeGreaterThan(100);
      expect(judgeWord(logp, frames, ['انك', 'لمن'], 0, []).expected).toBe(0);
    });

    it('said past frame 50, it does not', () => {
      expect(FIRST_FRAME).toBeGreaterThan(50);
      const {logp, frames} = say([...BEFORE, 'انك', 'لمن']);
      expect(
        judgeWord(logp, frames, ['انك', 'لمن'], 0, []).expected,
      ).toBeLessThan(-5);
    });

    it('a later word has left context to place it, so it is not held to this', () => {
      const {logp, frames} = say([...BEFORE, 'انك', 'لمن']);
      expect(judgeWord(logp, frames, ['انك', 'لمن'], 1, []).expected).toBe(0);
    });
  });
});

describe('judgeAnswer', () => {
  it.each(
    golden.answers.map(
      a => [a.expected, a.nothing, a.scores, a.answer] as const,
    ),
  )(
    'expected %f, no word %f, alternatives %j: as the original policy, %s',
    (expected, nothing, scores, answer) => {
      expect(
        judgeAnswer({
          expected,
          nothing,
          mut: scores.map(s => ({a: '', s})),
        }),
      ).toBe(answer);
    },
  );
});

describe('innerGap', () => {
  it.each(cancelGolden.gaps.map(g => [g.name, g] as const))(
    'matches the original in rule.mjs: %s',
    (_name, c) => {
      const {logp, frames} = sayTokens(
        joinWords(c.said, tokensOf),
        c.seed,
        c.quiet,
      );
      expect(frames).toBe(c.frames);
      expect(innerGap(logp, frames, tokensOf(c.word))).toBe(c.gap);
    },
  );
});

describe('the cancel step', () => {
  it.each(cancelGolden.cancels.map(c => [c.first, c.gap, c.answer] as const))(
    'matches the original in rule.mjs: %s a letter, gap %s, %s',
    (first, gap, answer) => {
      expect(cancelAnswer(first, gap)).toBe(answer);
    },
  );

  it('a word at the limit needs no padded look, one just over it does', () => {
    expect(scoresFarTooLow(-6)).toBe(true);
    expect(scoresFarTooLow(-6.001)).toBe(true);
    expect(scoresFarTooLow(-5.999)).toBe(false);
  });
});

describe('tokensOf', () => {
  it('numbers the letters as the model does', () => {
    expect(tokensOf('ءي')).toEqual([1, 29]);
  });

  it('throws on anything outside the alphabet, without saying what it was', () => {
    expect(() => tokensOf('ة')).toThrow(/^not in the alphabet$/);
  });
});

describe('ctc', () => {
  const {raw} = golden;

  it('matches the original to the last bit', () => {
    const {logp, frames} = say(['قال', 'نوح', 'رب'], raw.seed);
    expect(frames).toBe(raw.frames);
    const rel = relativeTo(logp, frames);
    expect(Array.from(rel).reduce((a, b) => a + b, 0)).toBe(raw.relSum);
    const left = [...tokensOf('قال'), WORD];
    const right = [WORD, ...tokensOf('رب')];
    const p = prepare(rel, frames, left, right);
    expect(Array.from(p.exitL)).toEqual(raw.exitL);
    expect(Array.from(p.exitR)).toEqual(raw.exitR);
    expect(Array.from(p.exitRest)).toEqual(raw.exitRest);
    expect(scoreWord(p, tokensOf('نوح'))).toBe(raw.word);
    expect(scoreWord(p, tokensOf('لوط'))).toBe(raw.other);
    expect(scoreNothing(p)).toBe(raw.nothing);
  });

  it('matches the original at an ayah with no context on either side', () => {
    const {logp, frames} = say(['قال', 'نوح', 'رب'], raw.seed);
    const p = prepare(relativeTo(logp, frames), frames, [], []);
    expect(scoreWord(p, tokensOf('نوح'))).toBe(raw.noContext.word);
    expect(scoreNothing(p)).toBe(raw.noContext.nothing);
  });

  it('the word said scores 0 and another word scores lower', () => {
    const [expected, other] = scoresOf(
      ['قال', 'نوح', 'رب'],
      ['قال', 'نوح', 'رب'],
      1,
      ['نوح', 'لوط'],
    );
    expect(Math.abs(expected)).toBeLessThan(1e-5);
    expect(other).toBeLessThan(-5);
  });

  it('a prefix is not free at the start of the text', () => {
    // Said فانك at the start of an ayah, expected انك: ف has no place to go.
    const [expected, said] = scoresOf(['فانك', 'لمن'], ['انك', 'لمن'], 0, [
      'انك',
      'فانك',
    ]);
    expect(Math.abs(said)).toBeLessThan(1e-5);
    expect(expected).toBeLessThan(said - 3);
  });

  it('a suffix is not free at the end of the text', () => {
    // Said عليهما last, expected عليه: ما has no place to go.
    const [expected, said] = scoresOf(['سلم', 'عليهما'], ['سلم', 'عليه'], 1, [
      'عليه',
      'عليهما',
    ]);
    expect(Math.abs(said)).toBeLessThan(1e-5);
    expect(expected).toBeLessThan(said - 3);
  });

  it('frames outside the text are free', () => {
    const [expected] = scoresOf(
      ['من', 'قبل', 'قال', 'نوح', 'رب', 'انه', 'كان'],
      ['قال', 'نوح', 'رب'],
      1,
      ['نوح'],
    );
    expect(Math.abs(expected)).toBeLessThan(1e-5);
  });

  it('the slice may cut the context on both sides', () => {
    // Starts inside قال and ends inside رب.
    const {logp, frames} = say(['قال', 'نوح', 'رب']);
    const from = 6;
    const to = frames - 3;
    const cut = logp.slice(from * 31, to * 31);
    const left = [...tokensOf('قال'), WORD];
    const right = [WORD, ...tokensOf('رب')];
    const p = prepare(relativeTo(cut, to - from), to - from, left, right);
    expect(Math.abs(scoreWord(p, tokensOf('نوح')))).toBeLessThan(1e-5);
    expect(scoreWord(p, tokensOf('لوط'))).toBeLessThan(-5);
  });

  it('a word left out: the expected word does not fit, and no word does', () => {
    const {logp, frames} = say(['قال', 'رب']);
    const left = [...tokensOf('قال'), WORD];
    const right = [WORD, ...tokensOf('رب')];
    const p = prepare(relativeTo(logp, frames), frames, left, right);
    expect(scoreWord(p, tokensOf('نوح'))).toBeLessThan(-5);
    expect(Math.abs(scoreNothing(p))).toBeLessThan(1e-5);
  });

  it('at the end of the text only blanks may follow no word', () => {
    // A separator with free frames here would hide any word.
    const {logp, frames} = say(['قال', 'نوح']);
    const left = [...tokensOf('قال'), WORD];
    const p = prepare(relativeTo(logp, frames), frames, left, []);
    expect(scoreNothing(p)).toBeLessThan(-5);
  });

  it('a doubled letter needs its blank', () => {
    const tokens = tokensOf('ابب');
    const {logp, frames} = sayTokens(tokens, 5);
    const p = prepare(relativeTo(logp, frames), frames, [], []);
    expect(Math.abs(scoreWord(p, tokens))).toBeLessThan(1e-5);
    // One ب only: the second burst has no token to go to.
    expect(scoreWord(p, tokensOf('اب'))).toBeLessThan(-3);
  });

  describe('wordSpan', () => {
    it('finds the frames the word holds, with the blanks after its last letter', () => {
      // Two quiet frames, then three frames for each of قال's letters, then a
      // separator: نوح starts at frame 2 + 3 * 4.
      const {logp, frames} = say(['قال', 'نوح']);
      const left = [...tokensOf('قال'), WORD];
      const p = prepare(relativeTo(logp, frames), frames, left, []);
      const span = wordSpan(p, tokensOf('نوح'));
      expect(span?.startFrame).toBe(14);
      expect(span?.score).toBeCloseTo(scoreWord(p, tokensOf('نوح')), 3);
      // Its last letter's second frame or a blank after it, within the slice.
      expect(span?.endFrame).toBeGreaterThanOrEqual(14 + 2 * 3 + 1);
      expect(span?.endFrame).toBeLessThan(frames);
    });

    it('agrees with the score on every golden case', () => {
      for (const c of golden.cases) {
        const {logp, frames} = sayTokens(joinWords(c.said, tokensOf), c.seed);
        const judged = judgeWord(logp, frames, c.words, c.j, c.mut, c.opts);
        expect(Math.abs(judged.exact - c.pass.expected)).toBe(0);
        expect(judged.startFrame).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
