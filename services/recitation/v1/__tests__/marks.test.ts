import type {V1CheckAnswer} from '../checkMark';
import {
  answerV1Check,
  checkingV1,
  emptyV1Book,
  noteV1Mark,
  noteV1Place,
  shownV1,
  type V1Book,
} from '../marks';
import type {V1Mark} from '../types';

const mark = (over: Partial<V1Mark>): V1Mark => ({
  id: 'm1',
  state: 'suspected',
  errorClass: 'wrong_word',
  surah: 1,
  ayah: 1,
  word: 2,
  totalWords: 4,
  audioTime: 3,
  confidence: 0.8,
  ...over,
});

const kept: V1CheckAnswer = {outcome: 'kept', why: 'x', detail: {}, ms: 1};
const cancelled: V1CheckAnswer = {
  outcome: 'cancelled',
  why: 'x',
  detail: {},
  ms: 1,
};
const failed: V1CheckAnswer = {
  outcome: 'failed',
  reason: 'x',
  detail: {},
  ms: 1,
};

const counts = () => 4;

/** Suspected, confirmed and answered, as one mark goes through. */
function through(
  book: V1Book,
  m: Partial<V1Mark>,
  answer: V1CheckAnswer,
): V1Book {
  book = noteV1Mark(book, mark({...m, state: 'suspected'})).book;
  const confirmed = noteV1Mark(book, mark({...m, state: 'confirmed'}));
  expect(confirmed.toCheck?.status).toBe('checking');
  return answerV1Check(confirmed.book, confirmed.toCheck?.id ?? '', answer);
}

describe('v1 marks', () => {
  it('a suspicion shows nothing and asks for no check', () => {
    const {book, toCheck} = noteV1Mark(emptyV1Book(), mark({}));
    expect(toCheck).toBeNull();
    expect(shownV1(book, counts).marks).toEqual([]);
  });

  it('a confirmed mark shows only once the check keeps it, as its kind', () => {
    const {book, toCheck} = noteV1Mark(
      emptyV1Book(),
      mark({state: 'confirmed'}),
    );
    expect(shownV1(book, counts).marks).toEqual([]);
    expect(checkingV1(book)).toHaveLength(1);
    const after = answerV1Check(book, toCheck?.id ?? '', kept);
    expect(shownV1(after, counts).marks).toEqual([
      {
        surah: 1,
        ayah: 1,
        word: 2,
        totalWords: 4,
        kind: 'wrong',
        status: 'mistake',
        since: 3000,
      },
    ]);
  });

  it('a cancelled mark never shows; a failed check shows it', () => {
    expect(
      shownV1(through(emptyV1Book(), {}, cancelled), counts).marks,
    ).toEqual([]);
    expect(
      shownV1(through(emptyV1Book(), {}, failed), counts).marks,
    ).toHaveLength(1);
  });

  it('maps a left-out word to missed', () => {
    const book = through(emptyV1Book(), {errorClass: 'omitted_word'}, kept);
    expect(shownV1(book, counts).marks[0].kind).toBe('missed');
  });

  it('a self-correction turns a shown mark corrected and drops one not shown yet', () => {
    const shown = through(emptyV1Book(), {}, kept);
    const corrected = noteV1Mark(shown, mark({state: 'resolved'})).book;
    expect(shownV1(corrected, counts).marks[0].status).toBe('corrected');

    const checking = noteV1Mark(emptyV1Book(), mark({state: 'confirmed'})).book;
    const resolved = noteV1Mark(checking, mark({state: 'resolved'})).book;
    // The check's answer after that changes nothing.
    const late = answerV1Check(resolved, 'm1', kept);
    expect(shownV1(late, counts).marks).toEqual([]);
  });

  it('an uncertain mark is dropped', () => {
    const checking = noteV1Mark(emptyV1Book(), mark({state: 'confirmed'})).book;
    const book = noteV1Mark(checking, mark({state: 'uncertain'})).book;
    expect(answerV1Check(book, 'm1', kept).get('m1')?.status).toBe('dropped');
  });

  it('a confirmed state seen twice asks for one check', () => {
    const first = noteV1Mark(emptyV1Book(), mark({state: 'confirmed'}));
    expect(
      noteV1Mark(first.book, mark({state: 'confirmed'})).toCheck,
    ).toBeNull();
  });

  describe('the restart rule', () => {
    it('corrects a mark once the reader goes back before it and reads past it', () => {
      let book = through(emptyV1Book(), {}, kept);
      book = noteV1Place(book, {surah: 1, ayah: 1, word: 3});
      expect(book.get('m1')?.status).toBe('shown');
      book = noteV1Place(book, {surah: 1, ayah: 1, word: 0});
      book = noteV1Place(book, {surah: 1, ayah: 1, word: 1});
      expect(book.get('m1')?.status).toBe('shown');
      book = noteV1Place(book, {surah: 1, ayah: 1, word: 3});
      expect(book.get('m1')?.status).toBe('corrected');
    });

    it('keeps it when a newer mark stands on the same word', () => {
      let book = through(emptyV1Book(), {}, kept);
      book = noteV1Place(book, {surah: 1, ayah: 1, word: 0});
      book = through(book, {id: 'm2', audioTime: 9}, kept);
      book = noteV1Place(book, {surah: 1, ayah: 1, word: 3});
      expect(book.get('m1')?.status).toBe('shown');
      expect(shownV1(book, counts).marks).toHaveLength(1);
    });

    it('leaves added words and skips alone', () => {
      let book = through(emptyV1Book(), {errorClass: 'added_word'}, kept);
      book = noteV1Place(book, {surah: 1, ayah: 1, word: 0});
      book = noteV1Place(book, {surah: 1, ayah: 1, word: 3});
      expect(book.get('m1')?.status).toBe('shown');
    });
  });

  it('an added word sits on the word after the gap the check found', () => {
    const book = through(emptyV1Book(), {errorClass: 'added_word'}, {
      ...kept,
      gapRight: {surah: 1, ayah: 1, word: 3},
    } as V1CheckAnswer);
    expect(shownV1(book, counts).marks).toEqual([
      expect.objectContaining({word: 3, kind: 'added', status: 'mistake'}),
    ]);
  });

  it('a skip over more whole ayat than a reader skips by mistake shows nothing', () => {
    const book = through(
      emptyV1Book(),
      {errorClass: 'skipped_passage', word: 0},
      {...kept, resumedAt: {surah: 1, ayah: 6, word: 0}} as V1CheckAnswer,
    );
    expect(shownV1(book, counts)).toEqual({marks: [], skippedAyat: []});
  });

  it('a skip marks the words it left out and flags whole ayat', () => {
    const book = through(
      emptyV1Book(),
      {errorClass: 'skipped_passage', word: 2},
      {
        ...kept,
        resumedAt: {surah: 1, ayah: 3, word: 1},
      } as V1CheckAnswer,
    );
    const shown = shownV1(book, counts);
    expect(shown.marks.map(m => `${m.ayah}:${m.word}:${m.kind}`)).toEqual([
      '1:2:missed',
      '1:3:missed',
      '3:0:missed',
    ]);
    expect(shown.skippedAyat).toEqual(['1:2']);
  });
});
