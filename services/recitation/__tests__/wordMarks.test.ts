import {
  applyVerdicts,
  confirmDue,
  dropSuspects,
  emptyMarkBook,
  MARK_CONFIRM_MS,
  NEXT_OK_WINDOW_MS,
  nextConfirmAt,
  shownMarks,
  type VerdictChange,
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
