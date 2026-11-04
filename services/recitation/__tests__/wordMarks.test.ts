import {
  applyVerdicts,
  confirmDue,
  emptyMarkBook,
  MARK_CONFIRM_MS,
  shownMarks,
  type VerdictChange,
} from '../wordMarks';

function change(
  word: number,
  state: VerdictChange['state'],
  {surah = 67, ayah = 12, totalWords = 10} = {},
): VerdictChange {
  return {surah, ayah, word, totalWords, state};
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

describe('word marks', () => {
  it('a wrong word that stays wrong becomes a mistake after the confirm delay', () => {
    const {book, confirmed} = run([[0, [change(2, 'wrong')]]], MARK_CONFIRM_MS);
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
    const {book} = run([[0, [change(2, 'wrong')]]], MARK_CONFIRM_MS - 1);
    expect(shownMarks(book, new Set())).toEqual([]);
  });

  it('a verdict that flips back within the delay leaves no trace', () => {
    const {book, confirmed} = run(
      [
        [0, [change(2, 'wrong')]],
        [480, [change(2, 'pending')]],
        [1500, [change(2, 'ok')]],
      ],
      5000,
    );
    expect(confirmed).toEqual([]);
    expect(shownMarks(book, new Set())).toEqual([]);
  });

  it('a skipped word is a missed word', () => {
    const {book} = run([[0, [change(4, 'skipped')]]], MARK_CONFIRM_MS);
    expect(shownMarks(book, new Set())[0]).toMatchObject({
      kind: 'missed',
      status: 'mistake',
    });
  });

  it("'wrong' on an ayah's first or last word is not a mistake: that is mostly joining ayat", () => {
    const {book} = run(
      [[0, [change(0, 'wrong'), change(9, 'wrong')]]],
      MARK_CONFIRM_MS * 3,
    );
    expect(shownMarks(book, new Set())).toEqual([]);
  });

  it("an ayah's first or last word can still be missed", () => {
    const {book} = run(
      [[0, [change(0, 'skipped'), change(9, 'skipped')]]],
      MARK_CONFIRM_MS,
    );
    expect(shownMarks(book, new Set()).map(m => m.word)).toEqual([0, 9]);
  });

  it('a mistake recited again correctly becomes corrected', () => {
    const {book, corrected} = run(
      [
        [0, [change(2, 'wrong')]],
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
        [0, [change(2, 'skipped')]],
        [2000, [change(2, 'pending')]],
        [2500, [change(2, 'unsure')]],
      ],
      4000,
    );
    expect(shownMarks(book, new Set())[0]).toMatchObject({
      status: 'mistake',
    });
  });

  it('a corrected word judged wrong again is a mistake again after the delay', () => {
    const {book, confirmed} = run(
      [
        [0, [change(2, 'wrong')]],
        [2000, [change(2, 'ok')]],
        [5000, [change(2, 'wrong')]],
      ],
      5000 + MARK_CONFIRM_MS,
    );
    expect(confirmed).toEqual(['12:2', '12:2']);
    expect(shownMarks(book, new Set())[0]).toMatchObject({status: 'mistake'});
  });

  it('marks inside an ayah flagged as skipped are left to the ayah flag', () => {
    const {book} = run([[0, [change(2, 'skipped')]]], MARK_CONFIRM_MS);
    expect(shownMarks(book, new Set(['67:12']))).toEqual([]);
    expect(shownMarks(book, new Set(['67:13']))).toHaveLength(1);
  });

  it('shown marks are in recitation order', () => {
    const {book} = run(
      [
        [0, [change(5, 'skipped', {ayah: 13})]],
        [10, [change(3, 'skipped', {ayah: 12})]],
      ],
      2000,
    );
    expect(shownMarks(book, new Set()).map(m => `${m.ayah}:${m.word}`)).toEqual(
      ['12:3', '13:5'],
    );
  });
});
