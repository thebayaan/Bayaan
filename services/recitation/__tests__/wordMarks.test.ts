import {
  applyVerdicts,
  cancelCheck,
  confirmDue,
  dropLockArtifacts,
  dropRealignment,
  dropSuspects,
  emptyMarkBook,
  finishChecks,
  MARK_CONFIRM_MS,
  markKey,
  NEXT_OK_WINDOW_MS,
  nextConfirmAt,
  REALIGN_AYAT,
  REALIGN_WORDS,
  shownMarks,
  startChecks,
  type MarkBook,
  type VerdictChange,
  type WordMark,
} from '../wordMarks';

function change(
  word: number,
  state: VerdictChange['state'],
  {
    surah = 67,
    ayah = 12,
    totalWords = 10,
    detail,
  }: {
    surah?: number;
    ayah?: number;
    totalWords?: number;
    detail?: VerdictChange['detail'];
  } = {},
): VerdictChange {
  return {surah, ayah, word, totalWords, state, ...(detail ? {detail} : {})};
}

function run(steps: [number, VerdictChange[]][], until: number) {
  let book = emptyMarkBook();
  const confirmed: string[] = [];
  const corrected: string[] = [];
  for (const [at, changes] of steps) {
    const due = confirmDue(book, at);
    book = due.book;
    confirmed.push(...due.confirmed.map(m => `${m.ayah}:${m.word}`));
    const next = applyVerdicts(book, changes, at);
    book = next.book;
    confirmed.push(...next.confirmed.map(m => `${m.ayah}:${m.word}`));
    corrected.push(...next.corrected.map(m => `${m.ayah}:${m.word}`));
  }
  const due = confirmDue(book, until);
  confirmed.push(...due.confirmed.map(m => `${m.ayah}:${m.word}`));
  return {book: due.book, confirmed, corrected};
}

/** A bad verdict at 0 and the reader carrying on correctly at 200 ms. */
function slip(
  word: number,
  state: 'wrong' | 'skipped',
  ayah = 12,
): [number, VerdictChange[]][] {
  return [
    [0, [change(word, state, {ayah})]],
    [200, [change(word + 1, 'ok', {ayah})]],
  ];
}

describe('word marks', () => {
  it('holds a suspect half a second: one 480 ms chunk of flicker never shows', () => {
    expect(MARK_CONFIRM_MS).toBe(500);
  });

  it('a wrong word that stays wrong, with the next word heard correctly, becomes a mistake', () => {
    const {book, confirmed} = run(slip(2, 'wrong'), MARK_CONFIRM_MS);
    expect(confirmed).toEqual(['12:2']);
    expect(shownMarks(book, new Set())).toEqual([
      expect.objectContaining({
        surah: 67,
        ayah: 12,
        word: 2,
        kind: 'wrong',
        status: 'mistake',
      }),
    ]);
  });

  it('is not shown before the confirm delay', () => {
    const {book} = run(slip(2, 'wrong'), MARK_CONFIRM_MS - 1);
    expect(shownMarks(book, new Set())).toEqual([]);
  });

  it('is shown only once the reader carries on correctly: noise around a word is not a slip', () => {
    const {book} = run(
      [
        [0, [change(2, 'wrong')]],
        [300, [change(3, 'unsure')]],
        [600, [change(4, 'wrong')]],
      ],
      2000,
    );
    expect(shownMarks(book, new Set())).toEqual([]);
  });

  it('a correct word two words on also counts', () => {
    const {book} = run(
      [
        [0, [change(2, 'wrong')]],
        [300, [change(3, 'unsure')]],
        [700, [change(4, 'ok')]],
      ],
      800,
    );
    expect(shownMarks(book, new Set()).map(m => m.word)).toEqual([2]);
  });

  it("after an ayah's last word, the next ayah's first word counts", () => {
    const {book} = run(
      [
        [0, [change(9, 'skipped')]],
        [400, [change(0, 'ok', {ayah: 13})]],
      ],
      MARK_CONFIRM_MS,
    );
    expect(shownMarks(book, new Set()).map(m => m.word)).toEqual([9]);
  });

  it('a suspect not followed by a correct word in time is dropped', () => {
    const {book, confirmed} = run(
      [
        [0, [change(2, 'wrong')]],
        [NEXT_OK_WINDOW_MS + 100, [change(3, 'ok')]],
      ],
      NEXT_OK_WINDOW_MS + 1000,
    );
    expect(confirmed).toEqual([]);
    expect(shownMarks(book, new Set())).toEqual([]);
  });

  it('a verdict that flips back within the delay leaves no trace', () => {
    const {book, confirmed} = run(
      [
        [0, [change(2, 'wrong')]],
        [200, [change(3, 'ok')]],
        [480, [change(2, 'pending')]],
        [1500, [change(2, 'ok')]],
      ],
      5000,
    );
    expect(confirmed).toEqual([]);
    expect(shownMarks(book, new Set())).toEqual([]);
  });

  it('a skipped word is a missed word', () => {
    const {book} = run(slip(4, 'skipped'), MARK_CONFIRM_MS);
    expect(shownMarks(book, new Set())[0]).toMatchObject({
      kind: 'missed',
      status: 'mistake',
    });
  });

  it("'wrong' on an ayah's first or last word is not a mistake: that is mostly joining ayat", () => {
    const {book} = run(
      [
        [0, [change(0, 'wrong'), change(9, 'wrong')]],
        [200, [change(1, 'ok'), change(0, 'ok', {ayah: 13})]],
      ],
      MARK_CONFIRM_MS * 3,
    );
    expect(shownMarks(book, new Set())).toEqual([]);
  });

  it("an ayah's first or last word can still be missed", () => {
    const {book} = run(
      [
        [0, [change(0, 'skipped'), change(9, 'skipped')]],
        [200, [change(1, 'ok'), change(0, 'ok', {ayah: 13})]],
      ],
      MARK_CONFIRM_MS,
    );
    expect(shownMarks(book, new Set()).map(m => m.word)).toEqual([0, 9]);
  });

  it('a mistake recited again correctly becomes corrected', () => {
    const {book, corrected} = run(
      [
        ...slip(2, 'wrong'),
        [2000, [change(2, 'pending')]],
        [3000, [change(2, 'ok')]],
      ],
      4000,
    );
    expect(corrected).toEqual(['12:2']);
    expect(shownMarks(book, new Set())[0]).toMatchObject({
      word: 2,
      kind: 'wrong',
      status: 'corrected',
    });
  });

  it('a mistake stays a mistake when it is only re-heard or unclear', () => {
    const {book} = run(
      [
        ...slip(2, 'skipped'),
        [2000, [change(2, 'pending')]],
        [2500, [change(2, 'unsure')]],
      ],
      4000,
    );
    expect(shownMarks(book, new Set())[0]).toMatchObject({
      status: 'mistake',
    });
  });

  it('a corrected word judged wrong again is a mistake again once the reader carries on', () => {
    const {book, confirmed} = run(
      [
        ...slip(2, 'wrong'),
        [2000, [change(2, 'ok')]],
        [5000, [change(2, 'wrong')]],
        [5200, [change(3, 'pending')]],
        [5300, [change(3, 'ok')]],
      ],
      5000 + MARK_CONFIRM_MS,
    );
    expect(confirmed).toEqual(['12:2', '12:2']);
    expect(shownMarks(book, new Set())[0]).toMatchObject({status: 'mistake'});
  });

  it('marks inside an ayah flagged as skipped are left to the ayah flag', () => {
    const {book} = run(slip(2, 'skipped'), MARK_CONFIRM_MS);
    expect(shownMarks(book, new Set(['67:12']))).toEqual([]);
    expect(shownMarks(book, new Set(['67:14']))).toHaveLength(1);
  });

  it('shown marks are in recitation order', () => {
    const {book} = run(
      [
        [0, [change(5, 'skipped', {ayah: 13})]],
        [10, [change(3, 'skipped', {ayah: 12})]],
        [200, [change(6, 'ok', {ayah: 13}), change(4, 'ok', {ayah: 12})]],
      ],
      2000,
    );
    expect(shownMarks(book, new Set()).map(m => `${m.ayah}:${m.word}`)).toEqual(
      ['12:3', '13:5'],
    );
  });

  it('the first words of the ayah after a skipped one are left alone: that is the jump, not a slip', () => {
    const {book} = run(
      [
        [
          0,
          [
            change(0, 'skipped', {ayah: 13}),
            change(2, 'skipped', {ayah: 13}),
            change(3, 'skipped', {ayah: 13}),
          ],
        ],
        [200, [change(4, 'ok', {ayah: 13})]],
      ],
      MARK_CONFIRM_MS,
    );
    expect(shownMarks(book, new Set(['67:12'])).map(m => m.word)).toEqual([3]);
  });

  it('a suspect is due at the hold once the next word was heard, else when it would be dropped', () => {
    const waiting = applyVerdicts(emptyMarkBook(), [change(2, 'wrong')], 0);
    expect(nextConfirmAt(waiting.book)).toBe(NEXT_OK_WINDOW_MS);
    const followed = applyVerdicts(waiting.book, [change(3, 'ok')], 200);
    expect(nextConfirmAt(followed.book)).toBe(MARK_CONFIRM_MS);
    const late = applyVerdicts(waiting.book, [change(3, 'ok')], 900);
    expect(nextConfirmAt(late.book)).toBe(900);
  });

  describe('the engine scores behind a bad verdict', () => {
    it('a skip whose expected word still fits the audio is not a mistake: the alignment slipped, not the reader', () => {
      const {book} = run(
        [
          [0, [change(4, 'skipped', {detail: {gop: -1.2, heardRatio: 0.1}})]],
          [200, [change(5, 'ok')]],
        ],
        MARK_CONFIRM_MS * 2,
      );
      expect(shownMarks(book, new Set())).toEqual([]);
    });

    it('a skip whose word does not fit the audio at all is a mistake', () => {
      const {book} = run(
        [
          [0, [change(4, 'skipped', {detail: {gop: -13, heardRatio: 0}})]],
          [200, [change(5, 'ok')]],
        ],
        MARK_CONFIRM_MS,
      );
      expect(shownMarks(book, new Set()).map(m => m.word)).toEqual([4]);
    });

    it('a wrong word that fits the audio well is not a mistake', () => {
      const {book} = run(
        [
          [0, [change(4, 'wrong', {detail: {gop: -0.4, heardRatio: 0.6}})]],
          [200, [change(5, 'ok')]],
        ],
        MARK_CONFIRM_MS * 2,
      );
      expect(shownMarks(book, new Set())).toEqual([]);
    });

    it("an ayah's first word judged skipped though part of it was heard is not a mistake", () => {
      const {book} = run(
        [
          [0, [change(0, 'skipped', {detail: {heardRatio: 0.3}})]],
          [200, [change(1, 'ok')]],
        ],
        MARK_CONFIRM_MS * 2,
      );
      expect(shownMarks(book, new Set())).toEqual([]);
    });

    it("an ayah's first word with nothing of it heard is still missed", () => {
      const {book} = run(
        [
          [0, [change(0, 'skipped', {detail: {heardRatio: 0}})]],
          [200, [change(1, 'ok')]],
        ],
        MARK_CONFIRM_MS,
      );
      expect(shownMarks(book, new Set()).map(m => m.word)).toEqual([0]);
    });
  });

  describe('confusion is not a slip', () => {
    it('a suspect with three other words around it gone bad is dropped', () => {
      const {book, confirmed} = run(
        [
          [
            0,
            [
              change(3, 'wrong'),
              change(4, 'skipped'),
              change(5, 'wrong'),
              change(6, 'skipped'),
            ],
          ],
          [200, [change(7, 'ok'), change(8, 'ok')]],
        ],
        MARK_CONFIRM_MS * 2,
      );
      expect(confirmed).toEqual([]);
      expect(shownMarks(book, new Set())).toEqual([]);
    });

    it('two other bad words around it are not enough to drop it', () => {
      // Word 4 has two bad words around it (2 and 6); each slip is followed
      // by a correct word.
      const {book} = run(
        [
          [
            0,
            [
              change(2, 'wrong'),
              change(3, 'ok'),
              change(4, 'skipped'),
              change(5, 'ok'),
              change(6, 'wrong'),
              change(7, 'ok'),
            ],
          ],
        ],
        MARK_CONFIRM_MS,
      );
      expect(shownMarks(book, new Set()).map(m => m.word)).toEqual([2, 4, 6]);
    });

    it('when the engine loses the reader, pending suspects go but shown mistakes stay', () => {
      let {book} = run(slip(2, 'wrong'), MARK_CONFIRM_MS);
      book = applyVerdicts(book, [change(6, 'wrong')], 600).book;
      book = dropSuspects(book);
      expect(shownMarks(book, new Set()).map(m => m.word)).toEqual([2]);
      book = applyVerdicts(book, [change(7, 'ok')], 700).book;
      book = confirmDue(book, 5000).book;
      expect(shownMarks(book, new Set()).map(m => m.word)).toEqual([2]);
    });
  });
});

describe('dropLockArtifacts', () => {
  const lock = {surah: 67, ayah: 12, word: 3};

  it('drops a bad verdict on the word the engine locked onto: it may have been heard from its middle', () => {
    expect(dropLockArtifacts([change(3, 'wrong')], lock)).toEqual([]);
    expect(dropLockArtifacts([change(3, 'skipped')], lock)).toEqual([]);
  });

  it('drops bad verdicts before that word: they were not heard in this lock', () => {
    expect(
      dropLockArtifacts(
        [change(1, 'skipped'), change(2, 'wrong', {ayah: 11})],
        lock,
      ),
    ).toEqual([]);
  });

  it('drops bad verdicts after that word too: the whole chunk was judged from replayed audio', () => {
    expect(
      dropLockArtifacts(
        [change(4, 'wrong'), change(0, 'skipped', {ayah: 13})],
        lock,
      ),
    ).toEqual([]);
  });

  it('keeps every other verdict of that chunk', () => {
    const fine = [
      change(3, 'ok'),
      change(2, 'unsure'),
      change(3, 'pending'),
      change(5, 'ok'),
    ];
    expect(dropLockArtifacts([change(4, 'wrong'), ...fine], lock)).toEqual(
      fine,
    );
  });

  it('keeps everything when the engine did not lock in that chunk', () => {
    const changes = [change(3, 'wrong'), change(1, 'skipped')];
    expect(dropLockArtifacts(changes, null)).toEqual(changes);
  });
});

describe('dropRealignment', () => {
  /** `count` words judged ok, spread in turn over `ayat` of surah 67. */
  function judged(count: number, ayat: number[]): VerdictChange[] {
    return Array.from({length: count}, (_, i) =>
      change(i, 'ok', {ayah: ayat[i % ayat.length]}),
    );
  }

  it('acts on 11 words judged at once across 3 ayat', () => {
    expect(REALIGN_WORDS).toBe(11);
    expect(REALIGN_AYAT).toBe(3);
  });

  it('drops the bad verdicts of a chunk that judges that many: the tracker re-aligned a stretch it had left pending', () => {
    const bad = [change(1, 'wrong', {ayah: 13}), change(2, 'skipped')];
    const fine = [...judged(9, [11, 12, 13]), change(4, 'pending')];
    expect(dropRealignment([...bad, ...fine])).toEqual(fine);
  });

  it('counts an unsure word as judged, and keeps it', () => {
    const fine = [...judged(9, [11, 12, 13]), change(0, 'unsure')];
    expect(dropRealignment([...fine, change(1, 'wrong')])).toEqual(fine);
  });

  it('keeps a chunk of 10 judged words', () => {
    const changes = [...judged(9, [11, 12, 13]), change(1, 'wrong')];
    expect(dropRealignment(changes)).toEqual(changes);
  });

  it('keeps 11 judged words within 2 ayat', () => {
    const changes = [...judged(10, [12, 13]), change(1, 'wrong')];
    expect(dropRealignment(changes)).toEqual(changes);
  });

  it('pending verdicts count neither as judged words nor towards the ayat', () => {
    const fewWords = [
      ...judged(9, [11, 12, 13]),
      change(1, 'wrong'),
      change(5, 'pending'),
      change(6, 'pending'),
    ];
    expect(dropRealignment(fewWords)).toEqual(fewWords);
    const fewAyat = [
      ...judged(10, [12, 13]),
      change(1, 'wrong'),
      change(0, 'pending', {ayah: 14}),
    ];
    expect(dropRealignment(fewAyat)).toEqual(fewAyat);
  });
});

describe('marks and audio time', () => {
  const at = (book: MarkBook, word: number) => book.get(markKey(67, 12, word));

  it('a suspect keeps the audio time of its verdict', () => {
    const {book} = applyVerdicts(
      emptyMarkBook(),
      [change(3, 'wrong')],
      1000,
      12.48,
    );
    expect(at(book, 3)).toMatchObject({status: 'suspect', lastBadAudio: 12.48});
  });

  it('a later bad verdict moves it, and an ok verdict does not', () => {
    let {book} = applyVerdicts(
      emptyMarkBook(),
      [change(3, 'wrong')],
      1000,
      12.48,
    );
    ({book} = applyVerdicts(book, [change(4, 'ok')], 1100, 12.96));
    expect(at(book, 3)?.lastBadAudio).toBe(12.48);
    ({book} = applyVerdicts(book, [change(3, 'skipped')], 1200, 13.44));
    expect(at(book, 3)).toMatchObject({kind: 'missed', lastBadAudio: 13.44});
  });

  it('a bad verdict the rules let off still moves it', () => {
    let {book} = applyVerdicts(
      emptyMarkBook(),
      [change(3, 'skipped')],
      1000,
      12.48,
    );
    ({book} = applyVerdicts(
      book,
      [change(3, 'wrong', {detail: {gop: -0.2}})],
      1200,
      12.96,
    ));
    expect(at(book, 3)).toMatchObject({status: 'suspect', lastBadAudio: 12.96});
  });

  it('a mark the rules note keeps it too', () => {
    const {book} = applyVerdicts(
      emptyMarkBook(),
      [change(0, 'wrong')],
      1000,
      12.48,
    );
    expect(at(book, 0)).toMatchObject({status: 'noted', lastBadAudio: 12.48});
  });

  it('a suspect that becomes a mistake keeps it', () => {
    let {book} = applyVerdicts(
      emptyMarkBook(),
      [change(3, 'wrong'), change(4, 'ok')],
      1000,
      12.48,
    );
    const due = confirmDue(book, 1000 + MARK_CONFIRM_MS);
    book = due.book;
    expect(due.confirmed[0].lastBadAudio).toBe(12.48);
    ({book} = applyVerdicts(book, [change(3, 'skipped')], 2000, 14.4));
    expect(at(book, 3)).toMatchObject({status: 'mistake', lastBadAudio: 14.4});
  });

  it('with no audio time, as the bench replays call it, marks have none', () => {
    const {book} = applyVerdicts(emptyMarkBook(), [change(3, 'wrong')], 1000);
    expect(at(book, 3)?.lastBadAudio).toBeUndefined();
  });
});

describe('marks under a second look', () => {
  /** A wrong word at 0, followed by a correct one, and due: about to show. */
  function dueMark(word = 3): {book: MarkBook; confirmed: WordMark[]} {
    const {book} = applyVerdicts(
      emptyMarkBook(),
      [change(word, 'wrong'), change(word + 1, 'ok')],
      0,
      12.48,
    );
    return confirmDue(book, MARK_CONFIRM_MS);
  }

  function checking(word = 3, id = 7): MarkBook {
    const {book, confirmed} = dueMark(word);
    return startChecks(book, confirmed, id);
  }

  const statusOf = (book: MarkBook, word = 3) =>
    book.get(markKey(67, 12, word))?.status;
  const NO_SKIPS = new Set<string>();

  it('a mark being checked is not shown', () => {
    const book = checking();
    expect(statusOf(book)).toBe('checking');
    expect(shownMarks(book, NO_SKIPS)).toEqual([]);
  });

  it('a mark being checked is not confirmed again, or waited for', () => {
    const book = checking();
    const due = confirmDue(book, 60000);
    expect(due.book).toBe(book);
    expect(due.confirmed).toEqual([]);
    expect(nextConfirmAt(book)).toBeNull();
  });

  it('losing the reader leaves a check to finish, as it leaves a shown mistake', () => {
    const book = checking();
    expect(dropSuspects(book)).toBe(book);
  });

  it('a mark that stays is shown as a mistake, with nothing left of the check', () => {
    const update = finishChecks(checking(), 7);
    expect(statusOf(update.book)).toBe('mistake');
    expect(update.confirmed).toEqual([
      expect.objectContaining({word: 3, status: 'mistake', kind: 'wrong'}),
    ]);
    expect(update.confirmed[0].checkId).toBeUndefined();
    expect(shownMarks(update.book, NO_SKIPS)).toHaveLength(1);
  });

  it('a cancelled mark is noted like a dropped suspect, and counts towards confusion', () => {
    const before = checking();
    const book = cancelCheck(before, change(3, 'wrong'), 7);
    const mark = book.get(markKey(67, 12, 3));
    expect(mark?.status).toBe('noted');
    expect(mark?.lastBadAt).toBe(0);
    expect(shownMarks(book, NO_SKIPS)).toEqual([]);
    expect(finishChecks(book, 7).confirmed).toEqual([]);
  });

  it('a cancelled mark that goes bad again is a fresh suspect', () => {
    const cancelled = cancelCheck(checking(), change(3, 'wrong'), 7);
    const {book} = applyVerdicts(cancelled, [change(3, 'skipped')], 2000, 14.4);
    expect(book.get(markKey(67, 12, 3))).toMatchObject({
      status: 'suspect',
      since: 2000,
      lastBadAudio: 14.4,
    });
  });

  it('an answer settles only its own check', () => {
    const book = checking(3, 7);
    expect(cancelCheck(book, change(3, 'wrong'), 8)).toBe(book);
    const update = finishChecks(book, 8);
    expect(update.book).toBe(book);
    expect(update.confirmed).toEqual([]);
  });

  it('an answer for a word gone from the book changes nothing', () => {
    const book = checking();
    expect(cancelCheck(book, change(5, 'wrong'), 7)).toBe(book);
  });

  it('several marks of one check settle together', () => {
    const first = dueMark(3);
    const both = applyVerdicts(
      first.book,
      [change(6, 'wrong'), change(7, 'ok')],
      0,
      12.48,
    );
    const due = confirmDue(both.book, MARK_CONFIRM_MS);
    const marks = [...first.confirmed, ...due.confirmed];
    const book = startChecks(due.book, marks, 7);
    const update = finishChecks(cancelCheck(book, change(3, 'wrong'), 7), 7);
    expect(update.confirmed.map(m => m.word)).toEqual([6]);
    expect(statusOf(update.book, 3)).toBe('noted');
    expect(statusOf(update.book, 6)).toBe('mistake');
  });

  it('with no id every mark still being checked is shown: the take is over', () => {
    const first = dueMark(3);
    const late = applyVerdicts(
      first.book,
      [change(6, 'wrong'), change(7, 'ok')],
      0,
      12.48,
    );
    const due = confirmDue(late.book, MARK_CONFIRM_MS);
    let book = startChecks(due.book, first.confirmed, 7);
    book = startChecks(book, due.confirmed, 8);
    const update = finishChecks(book);
    expect(update.confirmed.map(m => m.word).sort()).toEqual([3, 6]);
    expect(finishChecks(update.book).confirmed).toEqual([]);
  });

  it('an ok verdict during a check drops the mark, as it does a suspect', () => {
    const update = applyVerdicts(checking(), [change(3, 'ok')], 700);
    expect(statusOf(update.book)).toBe('noted');
    expect(update.corrected).toEqual([]);
    expect(finishChecks(update.book, 7).confirmed).toEqual([]);
  });

  it.each(['unsure', 'pending'] as const)(
    '%s during a check leaves it running: it would not have touched a shown mistake',
    state => {
      const update = applyVerdicts(checking(), [change(3, state)], 700);
      expect(statusOf(update.book)).toBe('checking');
    },
  );

  it('a bad verdict during a check only moves its times', () => {
    const {book} = applyVerdicts(
      checking(),
      [change(3, 'skipped')],
      700,
      13.44,
    );
    expect(book.get(markKey(67, 12, 3))).toMatchObject({
      status: 'checking',
      kind: 'wrong',
      since: 0,
      lastBadAt: 700,
      lastBadAudio: 13.44,
    });
  });

  it('a word followed during a check is not counted as followed', () => {
    const {book} = applyVerdicts(checking(), [change(4, 'ok')], 700);
    expect(book.get(markKey(67, 12, 3))?.followedAt).toBe(0);
  });
});
