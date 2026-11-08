// The mark rules for the three word fixes: the junction check on an ayah's last
// word, the second judge's answer, and the added-word mark.
import followerConstants from '../followerConstants.npl.json';
import {
  ADDED_HOLD_MS,
  addedKey,
  applyJudgeAnswer,
  applyVerdicts,
  cancelCheck,
  CONFUSED_NEIGHBOURS,
  confirmDue,
  dropLockArtifacts,
  dropRealignment,
  dropSuspects,
  emptyMarkBook,
  endJudgeWaits,
  finishChecks,
  FIRST_SKIP_HEARD,
  holdForJudge,
  isFilteredChunk,
  judgeAnswerMatters,
  judgeAnswerStillDue,
  JUDGE_WAIT_MS,
  MARK_CONFIRM_MS,
  markKey,
  NEXT_OK_WINDOW_MS,
  nextConfirmAt,
  REALIGN_AYAT,
  REALIGN_WORDS,
  rememberVerdicts,
  shownMarks,
  SKIP_FITS_GOP,
  skipsSecondLook,
  startChecks,
  WRONG_FITS_GOP,
  wordMarkKey,
  type EngineWord,
  type JudgedVerdict,
  type MarkBook,
  type SeenVerdict,
  type VerdictChange,
  type WordMark,
} from '../wordMarks';

function change(
  word: number,
  state: VerdictChange['state'],
  extra: Partial<VerdictChange> = {},
): VerdictChange {
  return {surah: 67, ayah: 12, word, totalWords: 10, state, ...extra};
}

const key = (word: number) => markKey(67, 12, word);

function apply(book: MarkBook, changes: VerdictChange[], at: number): MarkBook {
  return applyVerdicts(book, changes, at).book;
}

describe('junction check', () => {
  const unsaid = (extra: Partial<VerdictChange> = {}) =>
    change(9, 'skipped', {detail: {junctionMissing: true}, ...extra});
  const said = (extra: Partial<VerdictChange> = {}) =>
    change(9, 'skipped', {detail: {junctionMissing: false}, ...extra});

  it('a word found unsaid is a missed mark, due at once', () => {
    const book = apply(emptyMarkBook(), [unsaid()], 5000);
    expect(nextConfirmAt(book)).toBe(5000);
    const due = confirmDue(book, 5000);
    expect(due.confirmed).toHaveLength(1);
    expect(due.confirmed[0]).toMatchObject({
      word: 9,
      kind: 'missed',
      status: 'mistake',
      junction: true,
    });
  });

  it('shows though the engine called the word fitting', () => {
    // A skipped word whose gop fits is let off today; the check knows better.
    const book = apply(
      emptyMarkBook(),
      [change(9, 'skipped', {detail: {gop: -1, junctionMissing: true}})],
      5000,
    );
    expect(confirmDue(book, 5000).confirmed).toHaveLength(1);
  });

  it('takes over a wrong verdict the ayah-edge rule had let go', () => {
    let book = apply(emptyMarkBook(), [change(9, 'wrong')], 4000);
    expect(book.get(key(9))?.status).toBe('noted');
    book = apply(book, [unsaid()], 4480);
    expect(confirmDue(book, 4480).confirmed).toHaveLength(1);
  });

  it('turns a waiting skipped suspect into a mark due at once', () => {
    let book = apply(emptyMarkBook(), [change(9, 'skipped')], 4000);
    expect(nextConfirmAt(book)).toBe(4000 + NEXT_OK_WINDOW_MS);
    book = apply(book, [unsaid({repeat: true})], 4480);
    expect(nextConfirmAt(book)).toBe(4480);
  });

  it('reaches a mark that is waiting for the second look', () => {
    let book = apply(emptyMarkBook(), [change(9, 'skipped')], 4000);
    book = apply(book, [change(10, 'ok')], 4100);
    book = apply(book, [change(0, 'ok', {ayah: 13})], 4200);
    const due = confirmDue(book, 4500);
    book = startChecks(due.book, due.confirmed, 7);
    expect(book.get(key(9))?.status).toBe('checking');
    book = apply(book, [unsaid({repeat: true})], 4900);
    const shown = confirmDue(book, 4900);
    expect(shown.confirmed).toHaveLength(1);
    expect(shown.confirmed[0].junction).toBe(true);
    // The check's late answer cannot take it back.
    expect(cancelCheck(shown.book, shown.confirmed[0], 7)).toBe(shown.book);
  });

  it('an ok verdict later turns the mark to corrected', () => {
    const due = confirmDue(apply(emptyMarkBook(), [unsaid()], 5000), 5000);
    const update = applyVerdicts(due.book, [change(9, 'ok')], 9000);
    expect(update.corrected).toHaveLength(1);
    expect(update.book.get(key(9))?.status).toBe('corrected');
  });

  it('skips the second look, unlike other marks', () => {
    const due = confirmDue(apply(emptyMarkBook(), [unsaid()], 5000), 5000);
    expect(skipsSecondLook(due.confirmed[0])).toBe(true);
    const plain: WordMark = {...due.confirmed[0], junction: undefined};
    expect(skipsSecondLook(plain)).toBe(false);
  });

  it('a word found said drops a skipped suspect', () => {
    let book = apply(emptyMarkBook(), [change(9, 'skipped')], 4000);
    book = apply(book, [said({repeat: true})], 4480);
    expect(book.get(key(9))?.status).toBe('noted');
    expect(nextConfirmAt(book)).toBeNull();
  });

  it('a word found said is no new bad verdict', () => {
    let book = apply(emptyMarkBook(), [change(9, 'skipped')], 4000);
    book = apply(book, [said({repeat: true})], 4480);
    expect(book.get(key(9))?.lastBadAt).toBe(4000);
    const before = book;
    expect(apply(before, [said({repeat: true})], 9000)).toBe(before);
  });

  it('a skipped verdict already known to be said is no mark', () => {
    const book = apply(emptyMarkBook(), [said()], 4000);
    expect(book.get(key(9))?.status).toBe('noted');
    expect(nextConfirmAt(book)).toBeNull();
  });

  it('a word found said leaves a suspect of another kind alone', () => {
    // A changed last word the judge has promoted: 'said' is true of it too.
    const verdict: JudgedVerdict = {
      surah: 67,
      ayah: 12,
      word: 9,
      totalWords: 10,
      state: 'wrong',
      at: 4000,
    };
    let book = applyJudgeAnswer(emptyMarkBook(), verdict, 'wrong', []);
    expect(book.get(key(9))?.kind).toBe('wrong');
    book = apply(book, [said({repeat: true})], 5000);
    expect(book.get(key(9))?.status).toBe('suspect');
  });

  it('on a wrong verdict, said changes nothing', () => {
    const book = apply(
      emptyMarkBook(),
      [change(9, 'wrong', {detail: {junctionMissing: false}})],
      4000,
    );
    expect(book.get(key(9))?.status).toBe('noted');
    const interior = apply(
      emptyMarkBook(),
      [change(4, 'wrong', {detail: {junctionMissing: false}})],
      4000,
    );
    expect(interior.get(key(4))?.status).toBe('suspect');
  });
});

describe("the second judge's answer", () => {
  function verdict(
    word: number,
    state: JudgedVerdict['state'],
    at: number,
    extra: Partial<JudgedVerdict> = {},
  ): JudgedVerdict {
    return {
      surah: 67,
      ayah: 12,
      word,
      totalWords: 10,
      state,
      at,
      ...extra,
    };
  }
  const seenOk = (word: number, at: number, ayah = 12): SeenVerdict => ({
    surah: 67,
    ayah,
    word,
    state: 'ok',
    at,
  });

  describe('wrong', () => {
    it('promotes a word the ayah-edge rule let go', () => {
      const v = verdict(9, 'wrong', 4000);
      const before = apply(emptyMarkBook(), [change(9, 'wrong')], 4000);
      expect(before.get(key(9))?.status).toBe('noted');
      const book = applyJudgeAnswer(before, v, 'wrong', []);
      expect(book.get(key(9))).toMatchObject({
        status: 'suspect',
        kind: 'wrong',
        since: 4000,
      });
    });

    it('promotes a word the gop-fits rule let go', () => {
      const v = verdict(4, 'wrong', 4000);
      const before = apply(
        emptyMarkBook(),
        [change(4, 'wrong', {detail: {gop: -0.5}})],
        4000,
      );
      expect(before.get(key(4))?.status).toBe('noted');
      const book = applyJudgeAnswer(before, v, 'wrong', []);
      expect(book.get(key(4))?.status).toBe('suspect');
    });

    it('promotes a word with no entry, whatever verdict woke it', () => {
      const v = verdict(4, 'unsure', 4000);
      const book = applyJudgeAnswer(emptyMarkBook(), v, 'wrong', []);
      expect(book.get(key(4))).toMatchObject({
        status: 'suspect',
        kind: 'wrong',
        since: 4000,
        lastBadAt: 4000,
      });
    });

    it('keeps the audio time of the verdict for the second look', () => {
      const v = verdict(4, 'unsure', 4000, {audioTime: 12.48});
      const book = applyJudgeAnswer(emptyMarkBook(), v, 'wrong', []);
      expect(book.get(key(4))?.lastBadAudio).toBe(12.48);
    });

    it('credits a next-word ok seen since the verdict', () => {
      const v = verdict(4, 'wrong', 4000);
      const seen = [seenOk(5, 4480)];
      const before = apply(emptyMarkBook(), [change(5, 'ok')], 4480);
      const book = applyJudgeAnswer(before, v, 'wrong', seen);
      expect(book.get(key(4))?.followedAt).toBe(4480);
      // Late as it came, it shows now.
      const due = confirmDue(book, 4960);
      expect(due.confirmed.map(m => m.word)).toEqual([4]);
    });

    it('credits the ok on an existing suspect that waited for the judge', () => {
      const v = verdict(4, 'wrong', 4000);
      let book = apply(emptyMarkBook(), [change(4, 'wrong')], 4000);
      book = holdForJudge(book, v, 4000);
      book = apply(book, [change(5, 'ok')], 4480);
      expect(confirmDue(book, 4900).confirmed).toEqual([]);
      book = applyJudgeAnswer(book, v, 'wrong', [seenOk(5, 4480)]);
      expect(book.get(key(4))?.followedAt).toBe(4480);
      expect(confirmDue(book, 4960).confirmed.map(m => m.word)).toEqual([4]);
    });

    it('credits the word after the next, and the next ayah', () => {
      const lastWord = verdict(9, 'wrong', 4000);
      expect(
        applyJudgeAnswer(emptyMarkBook(), lastWord, 'wrong', [
          seenOk(0, 4480, 13),
        ]).get(key(9))?.followedAt,
      ).toBe(4480);
      expect(
        applyJudgeAnswer(emptyMarkBook(), verdict(4, 'wrong', 4000), 'wrong', [
          seenOk(6, 4960),
        ]).get(key(4))?.followedAt,
      ).toBe(4960);
    });

    it('does not credit an ok before the verdict, too late, or on another word', () => {
      const v = verdict(4, 'wrong', 4000);
      const seen = [
        seenOk(5, 3999),
        seenOk(5, 4000 + NEXT_OK_WINDOW_MS + 1),
        seenOk(7, 4480),
      ];
      const book = applyJudgeAnswer(emptyMarkBook(), v, 'wrong', seen);
      expect(book.get(key(4))?.followedAt).toBeUndefined();
    });

    it('without a next-word ok the suspect goes at the window, as today', () => {
      const v = verdict(4, 'wrong', 4000);
      const book = applyJudgeAnswer(emptyMarkBook(), v, 'wrong', []);
      const due = confirmDue(book, 4000 + NEXT_OK_WINDOW_MS);
      expect(due.confirmed).toEqual([]);
      expect(due.book.get(key(4))?.status).toBe('noted');
    });

    it('does nothing when the word has since been heard ok', () => {
      const v = verdict(4, 'wrong', 4000);
      const seen = [seenOk(4, 4480)];
      const before = apply(emptyMarkBook(), [change(4, 'wrong')], 4000);
      const flipped = apply(before, [change(4, 'ok')], 4480);
      expect(flipped.get(key(4))?.status).toBe('noted');
      const book = applyJudgeAnswer(flipped, v, 'wrong', seen);
      expect(book.get(key(4))?.status).toBe('noted');
    });

    it('leaves a shown mark and a mark in its second look alone', () => {
      const v = verdict(4, 'wrong', 4000);
      let book = apply(emptyMarkBook(), [change(4, 'wrong')], 4000);
      book = apply(book, [change(5, 'ok')], 4100);
      const due = confirmDue(book, 4500);
      expect(applyJudgeAnswer(due.book, v, 'wrong', [])).toBe(due.book);
      const checking = startChecks(due.book, due.confirmed, 3);
      expect(applyJudgeAnswer(checking, v, 'wrong', [])).toBe(checking);
    });
  });

  describe('absent', () => {
    it('makes a missed suspect from a wrong or skipped verdict', () => {
      for (const state of ['wrong', 'skipped'] as const) {
        const v = verdict(9, state, 4000);
        const book = applyJudgeAnswer(emptyMarkBook(), v, 'absent', []);
        expect(book.get(key(9))).toMatchObject({
          status: 'suspect',
          kind: 'missed',
        });
      }
    });

    it('credits a next-word ok seen since the verdict', () => {
      const v = verdict(4, 'skipped', 4000);
      const book = applyJudgeAnswer(emptyMarkBook(), v, 'absent', [
        seenOk(5, 4100),
      ]);
      expect(book.get(key(4))?.followedAt).toBe(4100);
    });

    it('does nothing on an unsure or ok verdict', () => {
      for (const state of ['unsure', 'ok'] as const) {
        const v = verdict(4, state, 4000);
        const book = emptyMarkBook();
        expect(applyJudgeAnswer(book, v, 'absent', [])).toBe(book);
      }
    });
  });

  describe('fits', () => {
    it('drops the suspect of an interior wrong or a skipped verdict', () => {
      const wrong = verdict(4, 'wrong', 4000);
      let book = apply(emptyMarkBook(), [change(4, 'wrong')], 4000);
      book = applyJudgeAnswer(book, wrong, 'fits', []);
      expect(book.has(key(4))).toBe(false);
      const skipped = verdict(9, 'skipped', 4000);
      book = apply(emptyMarkBook(), [change(9, 'skipped')], 4000);
      book = applyJudgeAnswer(book, skipped, 'fits', []);
      expect(book.has(key(9))).toBe(false);
    });

    it('leaves a junction mark alone', () => {
      const v = verdict(9, 'skipped', 4000);
      const book = apply(
        emptyMarkBook(),
        [change(9, 'skipped', {detail: {junctionMissing: true}})],
        4000,
      );
      const after = applyJudgeAnswer(book, v, 'fits', []);
      expect(after.get(key(9))?.status).toBe('suspect');
      expect(after.get(key(9))?.junction).toBe(true);
    });

    it('does not make a mark, and leaves a shown one', () => {
      const v = verdict(4, 'unsure', 4000);
      const empty = emptyMarkBook();
      expect(applyJudgeAnswer(empty, v, 'fits', [])).toBe(empty);
      let book = apply(emptyMarkBook(), [change(4, 'wrong')], 4000);
      book = apply(book, [change(5, 'ok')], 4100);
      const shown = confirmDue(book, 4500).book;
      expect(
        applyJudgeAnswer(shown, verdict(4, 'wrong', 4000), 'fits', []),
      ).toBe(shown);
    });
  });

  describe('the wait', () => {
    it('holds a suspect back until the answer', () => {
      const v = verdict(4, 'wrong', 4000);
      let book = apply(emptyMarkBook(), [change(4, 'wrong')], 4000);
      book = apply(book, [change(5, 'ok')], 4100);
      book = holdForJudge(book, v, 4000);
      expect(nextConfirmAt(book)).toBe(4000 + JUDGE_WAIT_MS);
      expect(confirmDue(book, 4900).confirmed).toEqual([]);
      book = applyJudgeAnswer(book, v, 'neither', []);
      expect(book.get(key(4))?.judgeUntil).toBeUndefined();
      expect(nextConfirmAt(book)).toBe(4000 + MARK_CONFIRM_MS);
      expect(confirmDue(book, 4900).confirmed).toHaveLength(1);
    });

    it('an older answer does not let go of the wait for a newer verdict', () => {
      const first = verdict(4, 'wrong', 4000);
      const second = verdict(4, 'skipped', 4480);
      let book = apply(emptyMarkBook(), [change(4, 'wrong')], 4000);
      book = holdForJudge(book, first, 4000);
      book = apply(book, [change(5, 'ok')], 4100);
      book = apply(book, [change(4, 'skipped')], 4480);
      book = holdForJudge(book, second, 4480);
      book = applyJudgeAnswer(book, first, 'neither', []);
      expect(confirmDue(book, 4960).confirmed).toEqual([]);
      book = applyJudgeAnswer(book, second, 'fits', []);
      expect(book.get(key(4))?.status).toBe('noted');
    });

    it('with no answer the mark shows at the deadline', () => {
      const v = verdict(4, 'wrong', 4000);
      let book = apply(emptyMarkBook(), [change(4, 'wrong')], 4000);
      book = apply(book, [change(5, 'ok')], 4100);
      book = holdForJudge(book, v, 4000);
      expect(confirmDue(book, 4000 + JUDGE_WAIT_MS).confirmed).toHaveLength(1);
    });

    it('holds nothing else: no entry, a noted word or a junction mark', () => {
      const v = verdict(4, 'wrong', 4000);
      const empty = emptyMarkBook();
      expect(holdForJudge(empty, v, 4000)).toBe(empty);
      const noted = apply(
        emptyMarkBook(),
        [change(4, 'wrong', {detail: {gop: -0.5}})],
        4000,
      );
      expect(holdForJudge(noted, v, 4000)).toBe(noted);
      const junction = apply(
        emptyMarkBook(),
        [change(9, 'skipped', {detail: {junctionMissing: true}})],
        4000,
      );
      expect(holdForJudge(junction, verdict(9, 'skipped', 4000), 4000)).toBe(
        junction,
      );
    });
  });

  describe('verdicts seen lately', () => {
    it('keeps what a late answer can need, without repeats or old ones', () => {
      let seen = rememberVerdicts(
        [],
        [change(5, 'ok'), change(6, 'ok', {repeat: true})],
        1000,
      );
      expect(seen.map(v => v.word)).toEqual([5]);
      seen = rememberVerdicts(seen, [change(7, 'unsure')], 2000);
      expect(seen.map(v => v.word)).toEqual([5, 7]);
      seen = rememberVerdicts(seen, [], 1000 + 3 * NEXT_OK_WINDOW_MS);
      expect(seen).toEqual([]);
    });
  });
});

describe('an answer about an older verdict', () => {
  const verdict = (at: number): JudgedVerdict => ({
    surah: 67,
    ayah: 12,
    word: 4,
    totalWords: 10,
    state: 'wrong',
    at,
    audioTime: at / 1000,
  });
  const wrongThenSkipped = () =>
    apply(
      apply(emptyMarkBook(), [change(4, 'wrong', {detail: {gop: -3}})], 5000),
      [change(4, 'skipped', {detail: {gop: -9}})],
      5480,
    );

  it('does not change the kind a newer verdict gave the word', () => {
    const book = applyJudgeAnswer(
      wrongThenSkipped(),
      verdict(5000),
      'wrong',
      [],
    );
    expect(book.get(key(4))?.kind).toBe('missed');
    expect(book.get(key(4))?.identified).toBe(true);
  });

  it('about the latest verdict, it does', () => {
    const book = applyJudgeAnswer(
      wrongThenSkipped(),
      {...verdict(5480), state: 'skipped'},
      'wrong',
      [],
    );
    expect(book.get(key(4))?.kind).toBe('wrong');
  });
});

describe('what the second judge identified', () => {
  const verdict = (at = 5000): JudgedVerdict => ({
    surah: 67,
    ayah: 12,
    word: 4,
    totalWords: 10,
    state: 'wrong',
    at,
    audioTime: at / 1000,
  });
  const suspect = () =>
    apply(emptyMarkBook(), [change(4, 'wrong', {detail: {gop: -3}})], 5000);

  it('wrong on a suspect says so', () => {
    const book = applyJudgeAnswer(suspect(), verdict(), 'wrong', []);
    expect(book.get(key(4))?.identified).toBe(true);
  });

  it('absent on a suspect says so', () => {
    const book = applyJudgeAnswer(suspect(), verdict(), 'absent', []);
    expect(book.get(key(4))?.identified).toBe(true);
  });

  it('a word it raises says so', () => {
    const book = applyJudgeAnswer(emptyMarkBook(), verdict(), 'wrong', []);
    expect(book.get(key(4))?.identified).toBe(true);
  });

  it('neither says nothing', () => {
    const book = applyJudgeAnswer(suspect(), verdict(), 'neither', []);
    expect(book.get(key(4))?.identified).toBeUndefined();
  });

  it('an answer about a verdict before the word became a suspect does not count', () => {
    const book = apply(
      apply(suspect(), [change(4, 'ok')], 5500),
      [change(4, 'wrong', {detail: {gop: -3}})],
      6000,
    );
    const later = applyJudgeAnswer(book, verdict(5000), 'wrong', []);
    expect(later.get(key(4))?.identified).toBeUndefined();
  });

  it('a word let off and raised again starts with a clean slate', () => {
    const answered = applyJudgeAnswer(suspect(), verdict(), 'wrong', []);
    const noted = cancelCheck(
      startChecks(answered, [answered.get(key(4)) as WordMark], 1),
      {surah: 67, ayah: 12, word: 4},
      1,
    );
    const again = apply(noted, [change(4, 'wrong', {detail: {gop: -3}})], 9000);
    expect(again.get(key(4))?.status).toBe('suspect');
    expect(again.get(key(4))?.identified).toBeUndefined();
  });
});

describe('a word the second judge says fits', () => {
  const verdict = (word: number, at: number): JudgedVerdict => ({
    surah: 67,
    ayah: 12,
    word,
    totalWords: 10,
    state: 'wrong',
    at,
    audioTime: at / 1000,
  });
  const bad = (word: number) => change(word, 'wrong', {detail: {gop: -3}});

  it('leaves no entry when this verdict made it: it was never bad', () => {
    let book = apply(emptyMarkBook(), [bad(4)], 5000);
    book = applyJudgeAnswer(book, verdict(4, 5000), 'fits', []);
    expect(book.has(key(4))).toBe(false);
  });

  it('nor when the verdict was let off at once and only noted', () => {
    let book = apply(
      emptyMarkBook(),
      [change(4, 'wrong', {detail: {gop: -0.5}})],
      5000,
    );
    expect(book.get(key(4))?.status).toBe('noted');
    book = applyJudgeAnswer(book, verdict(4, 5000), 'fits', []);
    expect(book.has(key(4))).toBe(false);
  });

  it('so it does not count towards the confusion rule', () => {
    let book = apply(
      emptyMarkBook(),
      [bad(1), bad(2), bad(3), bad(4), change(5, 'ok')],
      5000,
    );
    for (const word of [1, 2, 3]) {
      book = applyJudgeAnswer(book, verdict(word, 5000), 'fits', []);
    }
    expect(confirmDue(book, 5500).confirmed.map(m => m.word)).toEqual([4]);
  });

  it('keeps an entry older than this verdict, noted', () => {
    let book = apply(emptyMarkBook(), [bad(4)], 4000);
    book = apply(book, [bad(4)], 5000);
    book = applyJudgeAnswer(book, verdict(4, 5000), 'fits', []);
    expect(book.get(key(4))?.status).toBe('noted');
  });

  it('on an ayah edge it does nothing', () => {
    let book = apply(emptyMarkBook(), [change(9, 'wrong')], 5000);
    book = applyJudgeAnswer(book, verdict(9, 5000), 'fits', []);
    expect(book.get(key(9))?.status).toBe('noted');
  });
});

describe('the confusion rule when the second judge held a word back', () => {
  const verdict = (word: number, at: number): JudgedVerdict => ({
    surah: 67,
    ayah: 12,
    word,
    totalWords: 10,
    state: 'wrong',
    at,
    audioTime: at / 1000,
  });
  const bad = (word: number) => change(word, 'wrong', {detail: {gop: -3}});
  /** Word 4 falls due at 5500, but waits for the judge's answer until 6500. */
  const heldBack = () => {
    let book = apply(emptyMarkBook(), [bad(4)], 5000);
    book = holdForJudge(book, verdict(4, 5000), 5000);
    return apply(book, [change(5, 'ok')], 5200);
  };
  const others = [1, 2, 3];

  it('words gone bad after its own time do not count', () => {
    let book = heldBack();
    book = apply(book, others.map(bad), 6000);
    book = applyJudgeAnswer(book, verdict(4, 5000), 'neither', []);
    expect(confirmDue(book, 6500).confirmed.map(m => m.word)).toContain(4);
  });

  it('words gone bad before its own time do', () => {
    let book = heldBack();
    book = apply(book, others.map(bad), 5400);
    book = applyJudgeAnswer(book, verdict(4, 5000), 'neither', []);
    const due = confirmDue(book, 6500);
    expect(due.confirmed.map(m => m.word)).not.toContain(4);
    expect(due.book.get(key(4))?.status).toBe('noted');
  });

  it('words gone bad before its own time and again after it still count', () => {
    let book = heldBack();
    book = apply(book, others.map(bad), 5400);
    book = apply(book, others.map(bad), 6000);
    book = applyJudgeAnswer(book, verdict(4, 5000), 'neither', []);
    expect(confirmDue(book, 6500).confirmed.map(m => m.word)).not.toContain(4);
  });

  it('a word the judge raised is held to the time it would have fallen due', () => {
    let book = apply(emptyMarkBook(), others.map(bad), 6000);
    book = applyJudgeAnswer(book, verdict(4, 5000), 'wrong', [
      {surah: 67, ayah: 12, word: 5, state: 'ok', at: 5200},
    ]);
    expect(confirmDue(book, 6500).confirmed.map(m => m.word)).toContain(4);
  });

  it('with no judge in the way, nothing changes: all of it counts up to now', () => {
    let book = apply(emptyMarkBook(), [bad(4)], 5000);
    book = apply(book, [change(5, 'ok')], 5200);
    book = apply(book, others.map(bad), 6000);
    expect(confirmDue(book, 6500).confirmed.map(m => m.word)).not.toContain(4);
  });
});

describe('losing the reader while the second judge is out', () => {
  const verdict = (at = 5000): JudgedVerdict => ({
    surah: 67,
    ayah: 12,
    word: 4,
    totalWords: 10,
    state: 'wrong',
    at,
    audioTime: at / 1000,
  });
  const held = () => {
    let book = apply(
      emptyMarkBook(),
      [change(4, 'wrong', {detail: {gop: -3}})],
      5000,
    );
    book = holdForJudge(book, verdict(), 5000);
    return apply(book, [change(5, 'ok')], 5200);
  };

  it('a suspect past its own time, waiting only for the judge, stays', () => {
    const book = dropSuspects(held(), 5500);
    expect(book.get(key(4))?.status).toBe('suspect');
  });

  it('one not yet past the 500 ms hold goes', () => {
    const book = dropSuspects(held(), 5499);
    expect(book.get(key(4))?.status).toBe('noted');
  });

  it('one the next word has not followed goes', () => {
    const book = holdForJudge(
      apply(emptyMarkBook(), [change(4, 'wrong', {detail: {gop: -3}})], 5000),
      verdict(),
      5000,
    );
    expect(dropSuspects(book, 6000).get(key(4))?.status).toBe('noted');
  });

  it('one not waiting for the judge goes, as ever', () => {
    const book = apply(
      apply(emptyMarkBook(), [change(4, 'wrong', {detail: {gop: -3}})], 5000),
      [change(5, 'ok')],
      5200,
    );
    expect(dropSuspects(book, 6000).get(key(4))?.status).toBe('noted');
  });

  it('with no time given, every suspect goes', () => {
    expect(dropSuspects(held()).get(key(4))?.status).toBe('noted');
  });

  describe('an answer still out', () => {
    const seenOk = (word: number, at: number, ayah = 12): SeenVerdict => ({
      surah: 67,
      ayah,
      word,
      state: 'ok',
      at,
    });

    it('stands when its word would have shown by now', () => {
      expect(judgeAnswerStillDue(verdict(), [seenOk(5, 5200)], 5500)).toBe(
        true,
      );
    });

    it('not when too little time has gone by', () => {
      expect(judgeAnswerStillDue(verdict(), [seenOk(5, 5200)], 5499)).toBe(
        false,
      );
    });

    it('not when no next word was heard', () => {
      expect(judgeAnswerStillDue(verdict(), [seenOk(8, 5200)], 6000)).toBe(
        false,
      );
    });

    it('not on a next word from before the verdict', () => {
      expect(judgeAnswerStillDue(verdict(), [seenOk(5, 4900)], 6000)).toBe(
        false,
      );
    });

    it('not on a next word heard too long after it', () => {
      expect(judgeAnswerStillDue(verdict(), [seenOk(5, 8001)], 9000)).toBe(
        false,
      );
    });
  });
});

describe('judgeAnswerMatters', () => {
  const verdict: JudgedVerdict = {
    surah: 67,
    ayah: 12,
    word: 4,
    totalWords: 10,
    state: 'wrong',
    at: 5000,
    audioTime: 5,
  };
  const suspect = () =>
    apply(emptyMarkBook(), [change(4, 'wrong', {detail: {gop: -3}})], 5000);
  const seen = (state: VerdictChange['state'], at: number): SeenVerdict[] => [
    {surah: 67, ayah: 12, word: 4, state, at},
  ];

  it('on a suspect, or a word with no mark, it does', () => {
    expect(judgeAnswerMatters(suspect(), verdict, [])).toBe(true);
    expect(judgeAnswerMatters(emptyMarkBook(), verdict, [])).toBe(true);
  });

  it('on a word already shown it does not', () => {
    const shown = confirmDue(
      apply(suspect(), [change(5, 'ok')], 5100),
      5600,
    ).book;
    expect(shown.get(key(4))?.status).toBe('mistake');
    expect(judgeAnswerMatters(shown, verdict, [])).toBe(false);
  });

  it('on a word heard otherwise since then it does not', () => {
    expect(judgeAnswerMatters(suspect(), verdict, seen('ok', 5480))).toBe(
      false,
    );
    expect(judgeAnswerMatters(suspect(), verdict, seen('unsure', 5480))).toBe(
      false,
    );
  });

  it('heard badly since then, it still does', () => {
    expect(judgeAnswerMatters(suspect(), verdict, seen('skipped', 5480))).toBe(
      true,
    );
  });

  it('on a junction mark it does not', () => {
    const book = apply(
      emptyMarkBook(),
      [change(4, 'skipped', {detail: {junctionMissing: true}})],
      5000,
    );
    expect(judgeAnswerMatters(book, verdict, [])).toBe(false);
  });

  it('next to an added mark it does not', () => {
    const book = apply(
      suspect(),
      [
        change(5, 'ok', {
          repeat: true,
          addedBefore: {
            sounds: 4,
            noGap: -3,
            left: {surah: 67, ayah: 12, word: 4},
          },
        }),
      ],
      5200,
    );
    expect(judgeAnswerMatters(book, verdict, [])).toBe(false);
  });

  it('whatever it says, the answer then changes nothing but the wait', () => {
    const heard = seen('ok', 5480);
    for (const answer of ['wrong', 'absent', 'fits', 'neither'] as const) {
      const after = applyJudgeAnswer(suspect(), verdict, answer, heard);
      expect(after.get(key(4))?.status).toBe('suspect');
      expect(after.get(key(4))?.kind).toBe('wrong');
    }
  });
});

describe('isFilteredChunk', () => {
  const lock: EngineWord = {surah: 67, ayah: 12, word: 4};

  it('the chunk where the engine found the reader', () => {
    expect(isFilteredChunk([change(4, 'ok')], lock)).toBe(true);
    expect(isFilteredChunk([change(4, 'ok')], null)).toBe(false);
  });

  it('a chunk re-aligning a long stretch across ayat', () => {
    const many = Array.from({length: REALIGN_WORDS}, (_, i) =>
      change(i, 'ok', {ayah: 12 + (i % 3)}),
    );
    expect(isFilteredChunk(many, null)).toBe(true);
    expect(isFilteredChunk(many.slice(1), null)).toBe(false);
  });
});

describe('added-word mark', () => {
  const left: EngineWord = {surah: 67, ayah: 12, word: 3};
  const added = {sounds: 6, noGap: -3.5, left};
  const addedOn = (word: number, state: VerdictChange['state'] = 'ok') =>
    change(word, state, {addedBefore: added});

  function shownRed(word: number, at: number): MarkBook {
    let book = apply(emptyMarkBook(), [change(word, 'wrong')], at);
    book = apply(book, [change(word + 1, 'ok')], at + 100);
    return confirmDue(book, at + MARK_CONFIRM_MS).book;
  }

  it('shows at once, under its own key, on the right word', () => {
    const update = applyVerdicts(emptyMarkBook(), [addedOn(4)], 5000);
    expect(update.confirmed).toHaveLength(1);
    expect(update.confirmed[0]).toMatchObject({
      word: 4,
      kind: 'added',
      status: 'mistake',
    });
    expect(update.book.get(addedKey({surah: 67, ayah: 12, word: 4}))).toEqual(
      update.confirmed[0],
    );
    expect(update.book.has(key(4))).toBe(false);
    expect(shownMarks(update.book, new Set()).map(m => m.kind)).toEqual([
      'added',
    ]);
  });

  it('its key is apart from the red key of the same word', () => {
    const word = {surah: 67, ayah: 12, word: 4};
    expect(addedKey(word)).not.toBe(markKey(67, 12, 4));
    const mark: WordMark = {
      ...word,
      totalWords: 10,
      kind: 'added',
      status: 'mistake',
      since: 0,
    };
    expect(wordMarkKey(mark)).toBe(addedKey(word));
    expect(wordMarkKey({...mark, kind: 'wrong'})).toBe(markKey(67, 12, 4));
  });

  it('skips the second look', () => {
    const update = applyVerdicts(emptyMarkBook(), [addedOn(4)], 5000);
    expect(skipsSecondLook(update.confirmed[0])).toBe(true);
  });

  it('marks a place once', () => {
    const first = applyVerdicts(emptyMarkBook(), [addedOn(4)], 5000);
    const second = applyVerdicts(first.book, [addedOn(4)], 5480);
    expect(second.confirmed).toEqual([]);
    expect(
      second.book.get(addedKey({surah: 67, ayah: 12, word: 4}))?.since,
    ).toBe(5000);
  });

  it('clears a suspect on either neighbour', () => {
    let book = apply(
      emptyMarkBook(),
      [change(3, 'wrong'), change(4, 'wrong'), change(5, 'wrong')],
      4000,
    );
    book = apply(book, [addedOn(4, 'unsure')], 4480);
    expect(book.get(key(3))?.status).toBe('noted');
    expect(book.get(key(4))?.status).toBe('noted');
    expect(book.get(key(5))?.status).toBe('suspect');
  });

  it('clears a shown red mark and one in its second look', () => {
    let book = apply(shownRed(3, 3000), [addedOn(4)], 5000);
    expect(book.get(key(3))?.status).toBe('noted');
    expect(shownMarks(book, new Set()).map(m => m.kind)).toEqual(['added']);
    book = apply(emptyMarkBook(), [change(4, 'wrong')], 4000);
    book = apply(book, [change(5, 'ok')], 4100);
    const due = confirmDue(book, 4500);
    book = startChecks(due.book, due.confirmed, 9);
    book = apply(book, [addedOn(4)], 4600);
    expect(book.get(key(4))?.status).toBe('noted');
    expect(finishChecks(book, 9).confirmed).toEqual([]);
  });

  it('clears the last word of the ayah before', () => {
    const between = change(0, 'ok', {
      ayah: 13,
      addedBefore: {...added, left: {surah: 67, ayah: 12, word: 9}},
    });
    let book = apply(emptyMarkBook(), [change(9, 'skipped')], 4000);
    book = apply(book, [between], 4480);
    expect(book.get(key(9))?.status).toBe('noted');
    expect(book.has(addedKey({surah: 67, ayah: 13, word: 0}))).toBe(true);
  });

  it('holds back a red mark that arrives after it, on either neighbour', () => {
    let book = apply(emptyMarkBook(), [addedOn(4)], 4000);
    book = apply(book, [change(3, 'wrong'), change(4, 'skipped')], 4480);
    expect(book.get(key(3))?.status).toBe('noted');
    expect(book.get(key(4))?.status).toBe('noted');
    expect(nextConfirmAt(book)).toBeNull();
  });

  it('holds back a junction mark and a judge answer on them too', () => {
    const between = change(0, 'ok', {
      ayah: 13,
      addedBefore: {...added, left: {surah: 67, ayah: 12, word: 9}},
    });
    let book = apply(emptyMarkBook(), [between], 4000);
    book = apply(
      book,
      [change(9, 'skipped', {detail: {junctionMissing: true}})],
      4480,
    );
    expect(book.get(key(9))?.status).toBe('noted');
    const answer: JudgedVerdict = {
      surah: 67,
      ayah: 13,
      word: 0,
      totalWords: 8,
      state: 'wrong',
      at: 4000,
    };
    const after = applyJudgeAnswer(book, answer, 'wrong', []);
    expect(after.get(markKey(67, 13, 0))?.status).not.toBe('suspect');
  });

  it('leaves the words further off free', () => {
    let book = apply(emptyMarkBook(), [addedOn(4)], 4000);
    book = apply(book, [change(5, 'wrong'), change(2, 'wrong')], 4480);
    expect(book.get(key(5))?.status).toBe('suspect');
    expect(book.get(key(2))?.status).toBe('suspect');
  });

  it('gone, it holds nothing back', () => {
    let book = apply(emptyMarkBook(), [addedOn(4)], 4000);
    const next = new Map(book);
    next.delete(addedKey({surah: 67, ayah: 12, word: 4}));
    book = apply(next, [change(4, 'wrong')], 4480);
    expect(book.get(key(4))?.status).toBe('suspect');
  });

  it('a repeated state only carries the mark: it is no new verdict', () => {
    let book = apply(emptyMarkBook(), [change(2, 'wrong')], 4000);
    const repeat = change(4, 'ok', {repeat: true, addedBefore: added});
    book = apply(book, [repeat], 4100);
    // The word after the next is not credited by a repeat.
    expect(book.get(key(2))?.followedAt).toBeUndefined();
    expect(book.has(addedKey({surah: 67, ayah: 12, word: 4}))).toBe(true);
  });

  it('does not count towards the confusion rule', () => {
    // Added marks around a suspect are not words gone bad.
    let book = apply(emptyMarkBook(), [change(5, 'wrong')], 4000);
    for (const word of [2, 3, 7]) {
      book = apply(book, [addedOn(word)], 4100);
    }
    book = apply(book, [change(6, 'ok')], 4200);
    expect(confirmDue(book, 4500).confirmed.map(m => m.word)).toEqual([5]);
  });

  it('the lock chunk drops it, and keeps a good verdict', () => {
    const kept = dropLockArtifacts([addedOn(4, 'ok'), addedOn(5, 'wrong')], {
      surah: 67,
      ayah: 12,
      word: 4,
    });
    expect(kept).toEqual([change(4, 'ok')]);
  });

  it('a realignment chunk drops it, and repeats do not count as judged', () => {
    const many = Array.from({length: REALIGN_WORDS}, (_, i) =>
      change(i, 'ok', {
        ayah: 12 + (i % 3),
        addedBefore: {...added, left: {surah: 67, ayah: 12, word: i}},
      }),
    );
    expect(dropRealignment(many).every(c => !c.addedBefore)).toBe(true);
    const repeats = many.map(c => ({...c, repeat: true}));
    expect(dropRealignment(repeats)).toEqual(repeats);
  });

  it('stays shown when the engine loses the reader', () => {
    const book = apply(emptyMarkBook(), [addedOn(4)], 4000);
    expect(shownMarks(dropSuspects(book), new Set())).toHaveLength(1);
  });
});

describe('how long an added mark reaches', () => {
  const left: EngineWord = {surah: 67, ayah: 12, word: 3};
  const addedOn = (word: number, extra: Partial<VerdictChange> = {}) =>
    change(word, 'ok', {addedBefore: {sounds: 6, noGap: -3.5, left}, ...extra});
  const AT = 100000;

  function shownRed(word: number, at: number): MarkBook {
    let book = apply(emptyMarkBook(), [change(word, 'wrong')], at);
    book = apply(book, [change(word + 1, 'ok')], at + 100);
    return confirmDue(book, at + MARK_CONFIRM_MS).book;
  }

  it('a bad verdict on a neighbour goes through once the time is up', () => {
    const start = apply(emptyMarkBook(), [addedOn(4)], AT);
    const held = apply(start, [change(3, 'wrong')], AT + ADDED_HOLD_MS);
    expect(held.get(key(3))?.status).toBe('noted');
    const free = apply(start, [change(3, 'wrong')], AT + ADDED_HOLD_MS + 1);
    expect(free.get(key(3))?.status).toBe('suspect');
    const right = apply(start, [change(4, 'wrong')], AT + ADDED_HOLD_MS + 1);
    expect(right.get(key(4))?.status).toBe('suspect');
  });

  it('a word found unsaid goes through once the time is up', () => {
    const start = apply(emptyMarkBook(), [addedOn(9)], AT);
    const unsaid = change(9, 'skipped', {detail: {junctionMissing: true}});
    const book = apply(start, [unsaid], AT + ADDED_HOLD_MS + 1);
    expect(confirmDue(book, AT + ADDED_HOLD_MS + 1).confirmed).toHaveLength(1);
  });

  it('the judge can raise a neighbour once the time is up, and not before', () => {
    const start = apply(emptyMarkBook(), [addedOn(4)], AT);
    const verdict = (at: number): JudgedVerdict => ({
      surah: 67,
      ayah: 12,
      word: 3,
      totalWords: 10,
      state: 'wrong',
      at,
    });
    const soon = verdict(AT + ADDED_HOLD_MS);
    const late = verdict(AT + ADDED_HOLD_MS + 1);
    expect(judgeAnswerMatters(start, soon, [])).toBe(false);
    expect(judgeAnswerMatters(start, late, [])).toBe(true);
    expect(applyJudgeAnswer(start, soon, 'wrong', []).has(key(3))).toBe(false);
    expect(applyJudgeAnswer(start, late, 'wrong', []).get(key(3))?.status).toBe(
      'suspect',
    );
  });

  it('a mark from a verdict in the time before it is cleared', () => {
    const book = apply(shownRed(3, AT - ADDED_HOLD_MS), [addedOn(4)], AT);
    expect(book.get(key(3))?.status).toBe('noted');
  });

  it('an older mark stays', () => {
    const book = apply(shownRed(3, AT - ADDED_HOLD_MS - 1), [addedOn(4)], AT);
    expect(book.get(key(3))?.status).toBe('mistake');
    expect(shownMarks(book, new Set()).map(m => m.kind)).toEqual([
      'wrong',
      'added',
    ]);
  });

  it('a corrected word stays, however recent', () => {
    let book = shownRed(3, AT - 1000);
    book = apply(book, [change(3, 'ok')], AT - 500);
    expect(book.get(key(3))?.status).toBe('corrected');
    book = apply(book, [addedOn(4)], AT);
    expect(book.get(key(3))?.status).toBe('corrected');
  });

  it('an older mark read again correctly, an extra word before it, is corrected', () => {
    const update = applyVerdicts(
      shownRed(4, AT - 30000),
      [addedOn(4, {addedBefore: {sounds: 6, noGap: -3.5, left}})],
      AT,
    );
    expect(update.corrected).toHaveLength(1);
    expect(update.book.get(key(4))?.status).toBe('corrected');
  });
});

describe('a junction mark on a word that was already a suspect', () => {
  const unsaid = () =>
    change(9, 'skipped', {repeat: true, detail: {junctionMissing: true}});

  it('is due at once, though the suspect was waiting for the judge', () => {
    let book = apply(
      emptyMarkBook(),
      [change(9, 'skipped', {detail: {gop: -9}})],
      4000,
    );
    book = holdForJudge(book, {surah: 67, ayah: 12, word: 9}, 4000);
    expect(nextConfirmAt(book)).toBe(4000 + NEXT_OK_WINDOW_MS);
    book = apply(book, [unsaid()], 4480);
    expect(nextConfirmAt(book)).toBe(4480);
    expect(confirmDue(book, 4480).confirmed.map(m => m.word)).toEqual([9]);
  });
});

describe('a junction mark that is over', () => {
  const unsaid = change(9, 'skipped', {detail: {junctionMissing: true}});
  const verdict: JudgedVerdict = {
    surah: 67,
    ayah: 12,
    word: 9,
    totalWords: 10,
    state: 'wrong',
    at: 40000,
  };

  it('corrected, the judge can raise the word again', () => {
    const due = confirmDue(apply(emptyMarkBook(), [unsaid], 5000), 5000);
    let book = apply(due.book, [change(9, 'ok')], 6000);
    expect(book.get(key(9))).toMatchObject({status: 'corrected'});
    expect(book.get(key(9))?.junction).toBeUndefined();
    book = apply(book, [change(9, 'wrong')], verdict.at);
    expect(judgeAnswerMatters(book, verdict, [])).toBe(true);
    const raised = applyJudgeAnswer(book, verdict, 'wrong', []);
    expect(raised.get(key(9))).toMatchObject({
      status: 'suspect',
      kind: 'wrong',
    });
  });

  it('noted, it no longer counts as one', () => {
    const book = apply(
      apply(emptyMarkBook(), [unsaid], 5000),
      [change(9, 'ok')],
      5100,
    );
    expect(book.get(key(9))?.status).toBe('noted');
    expect(book.get(key(9))?.junction).toBeUndefined();
  });

  it('standing, it still takes no answer', () => {
    const book = confirmDue(apply(emptyMarkBook(), [unsaid], 5000), 5000).book;
    expect(applyJudgeAnswer(book, verdict, 'fits', [])).toBe(book);
    expect(judgeAnswerMatters(book, verdict, [])).toBe(false);
  });
});

describe('an answer of fits about an older verdict', () => {
  const verdict = (
    state: JudgedVerdict['state'],
    at: number,
  ): JudgedVerdict => ({
    surah: 67,
    ayah: 12,
    word: 4,
    totalWords: 10,
    state,
    at,
  });

  it('leaves a newer bad verdict standing', () => {
    let book = apply(
      emptyMarkBook(),
      [change(4, 'wrong', {detail: {gop: -3}})],
      4000,
    );
    book = apply(
      book,
      [change(4, 'skipped', {detail: {gop: -9}}), change(5, 'ok')],
      4480,
    );
    const after = applyJudgeAnswer(book, verdict('wrong', 4000), 'fits', []);
    expect(after.get(key(4))?.status).toBe('suspect');
    const shown = confirmDue(
      applyJudgeAnswer(after, verdict('skipped', 4480), 'neither', []),
      4980,
    );
    expect(shown.confirmed.map(m => m.word)).toEqual([4]);
  });

  it('about the newest verdict, it still drops the word', () => {
    const book = apply(
      emptyMarkBook(),
      [change(4, 'wrong', {detail: {gop: -3}})],
      4000,
    );
    const after = applyJudgeAnswer(book, verdict('wrong', 4000), 'fits', []);
    expect(after.has(key(4))).toBe(false);
  });
});

describe('the junction check says said and the judge says absent', () => {
  const skipped = change(9, 'skipped', {detail: {gop: -9}});
  const next = change(0, 'ok', {ayah: 13});
  const said = change(9, 'skipped', {
    repeat: true,
    detail: {junctionMissing: false},
  });
  const verdict: JudgedVerdict = {
    surah: 67,
    ayah: 12,
    word: 9,
    totalWords: 10,
    state: 'skipped',
    at: 4000,
  };
  const seen: SeenVerdict[] = [
    {surah: 67, ayah: 13, word: 0, state: 'ok', at: 4000},
  ];

  it('the judge wins, in whichever order they come', () => {
    const start = apply(emptyMarkBook(), [skipped, next], 4000);
    const absentFirst = apply(
      applyJudgeAnswer(start, verdict, 'absent', seen),
      [said],
      4480,
    );
    const saidFirst = applyJudgeAnswer(
      apply(start, [said], 4480),
      verdict,
      'absent',
      seen,
    );
    for (const book of [absentFirst, saidFirst]) {
      expect(book.get(key(9))).toMatchObject({
        status: 'suspect',
        kind: 'missed',
      });
    }
  });

  it('with no such answer, said still drops the skipped suspect', () => {
    const start = apply(emptyMarkBook(), [skipped, next], 4000);
    const answered = applyJudgeAnswer(start, verdict, 'neither', seen);
    expect(apply(answered, [said], 4480).get(key(9))?.status).toBe('noted');
  });
});

describe('at the end of a take', () => {
  it('a word that waits only for the judge is due by its own rules', () => {
    let book = apply(
      emptyMarkBook(),
      [change(4, 'wrong'), change(5, 'ok')],
      4000,
    );
    book = holdForJudge(book, {surah: 67, ayah: 12, word: 4}, 4000);
    expect(confirmDue(book, 4700).confirmed).toEqual([]);
    const due = confirmDue(endJudgeWaits(book), 4700);
    expect(due.confirmed.map(m => m.word)).toEqual([4]);
  });

  it('a word not followed yet stays unshown', () => {
    let book = apply(emptyMarkBook(), [change(4, 'wrong')], 4000);
    book = holdForJudge(book, {surah: 67, ayah: 12, word: 4}, 4000);
    expect(confirmDue(endJudgeWaits(book), 4700).confirmed).toEqual([]);
  });

  it('a word not yet past its 500 ms stays unshown', () => {
    let book = apply(
      emptyMarkBook(),
      [change(4, 'wrong'), change(5, 'ok')],
      4000,
    );
    book = holdForJudge(book, {surah: 67, ayah: 12, word: 4}, 4000);
    expect(confirmDue(endJudgeWaits(book), 4100).confirmed).toEqual([]);
  });

  it('with no wait on any word, the book is the same one', () => {
    const book = apply(emptyMarkBook(), [change(4, 'wrong')], 4000);
    expect(endJudgeWaits(book)).toBe(book);
  });
});

describe("the rules' tuned numbers", () => {
  it('come from the NPL file, with the same values as before', () => {
    const {marks} = followerConstants;
    expect(MARK_CONFIRM_MS).toBe(marks.confirmMs);
    expect(NEXT_OK_WINDOW_MS).toBe(marks.nextOkWindowMs);
    expect(SKIP_FITS_GOP).toBe(marks.skipFitsGop);
    expect(WRONG_FITS_GOP).toBe(marks.wrongFitsGop);
    expect(FIRST_SKIP_HEARD).toBe(marks.firstSkipHeard);
    expect(CONFUSED_NEIGHBOURS).toBe(marks.confusedNeighbours);
    expect(REALIGN_WORDS).toBe(marks.realignWords);
    expect(REALIGN_AYAT).toBe(marks.realignAyat);
    expect(marks).toEqual({
      confirmMs: 500,
      nextOkWindowMs: 3000,
      nextOkWords: 2,
      skipFitsGop: -5,
      wrongFitsGop: -1,
      firstSkipHeard: 0.1,
      confusedNeighbours: 3,
      neighbourSpan: 3,
      neighbourWindowMs: 2000,
      realignWords: 11,
      realignAyat: 3,
      afterSkipWords: 3,
    });
  });
});
