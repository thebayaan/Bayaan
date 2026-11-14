import {
  ADDED_HOLD_MS,
  addedKey,
  applyVerdicts,
  confirmDue,
  emptyMarkBook,
  markKey,
  MARK_CONFIRM_MS,
  shownMarks,
  type MarkBook,
  type MarkStatus,
  type VerdictChange,
  type WordMark,
} from '../../wordMarks';
import {applyLiveOpinions, type LiveMarkGate} from '../liveMarks';
import type {LiveOpinion, LiveVerdict} from '../types';

// The live lane of the mark book, word by word. Places are 18:3 with ten words.

const open: LiveMarkGate = {dismissed: () => false, revealed: () => true};

function opinion(
  word: number,
  verdict: LiveVerdict,
  extra: {final?: boolean; reading?: number; audioFrom?: number} = {},
): LiveOpinion {
  const audioFrom = extra.audioFrom ?? 10 + word * 0.5;
  return {
    surah: 18,
    ayah: 3,
    word,
    totalWords: 10,
    verdict,
    final: extra.final ?? true,
    evidence: {
      letterShare: verdict === 'fine' ? 0 : 0.6,
      gap: verdict === 'fine' ? 0 : 4.2,
      audioFrom,
      audioTo: audioFrom + 0.4,
      reading: extra.reading ?? 0,
    },
  };
}

const key = (word: number) => markKey(18, 3, word);

function followerMark(
  word: number,
  status: MarkStatus,
  extra: Partial<WordMark> = {},
): WordMark {
  return {
    surah: 18,
    ayah: 3,
    word,
    totalWords: 10,
    kind: 'wrong',
    status,
    since: 1000,
    lastBadAt: 1000,
    lastBadAudio: 12,
    ...extra,
  };
}

const bookOf = (...marks: [string, WordMark][]): MarkBook => new Map(marks);

describe('a final missed or changed opinion', () => {
  it('shows a mistake at once, with its evidence', () => {
    const update = applyLiveOpinions(
      emptyMarkBook(),
      [opinion(4, 'changed'), opinion(6, 'missed')],
      5000,
      open,
    );
    expect(update.confirmed.map(m => `${m.kind}:${m.word}`)).toEqual([
      'wrong:4',
      'missed:6',
    ]);
    const mark = update.book.get(key(4));
    expect(mark).toMatchObject({status: 'mistake', since: 5000});
    expect(mark?.live).toEqual(opinion(4, 'changed').evidence);
    expect(shownMarks(update.book, new Set()).map(m => m.word)).toEqual([4, 6]);
  });

  it('changes nothing when it comes again', () => {
    const first = applyLiveOpinions(
      emptyMarkBook(),
      [opinion(4, 'changed')],
      5000,
      open,
    );
    const again = applyLiveOpinions(
      first.book,
      [opinion(4, 'changed'), opinion(4, 'missed')],
      5500,
      open,
    );
    expect(again.book).toBe(first.book);
    expect(again.confirmed).toEqual([]);
    expect(again.corrected).toEqual([]);
  });

  it('marks a word in an ayah edge too', () => {
    const update = applyLiveOpinions(
      emptyMarkBook(),
      [opinion(0, 'changed'), opinion(9, 'changed')],
      5000,
      open,
    );
    expect(update.confirmed.map(m => m.word)).toEqual([0, 9]);
  });
});

describe('opinions that are not final', () => {
  it('move nothing', () => {
    const book = bookOf([
      key(4),
      {
        ...followerMark(4, 'mistake'),
        live: opinion(4, 'changed').evidence,
      },
    ]);
    for (const o of [
      opinion(2, 'changed', {final: false}),
      opinion(3, 'missed', {final: false}),
      opinion(4, 'fine', {final: false, reading: 1}),
    ]) {
      const update = applyLiveOpinions(book, [o], 5000, open);
      expect(update.book).toBe(book);
      expect(update.confirmed).toEqual([]);
      expect(update.corrected).toEqual([]);
    }
  });
});

describe('a word the follower holds', () => {
  it.each<MarkStatus>(['suspect', 'checking', 'mistake'])(
    'is left alone while it is %s',
    status => {
      const book = bookOf([key(4), followerMark(4, status)]);
      const update = applyLiveOpinions(
        book,
        [opinion(4, 'missed')],
        5000,
        open,
      );
      expect(update.book).toBe(book);
      expect(update.confirmed).toEqual([]);
    },
  );

  it('is marked once the follower has let it go', () => {
    const book = bookOf([key(4), followerMark(4, 'noted')]);
    const update = applyLiveOpinions(book, [opinion(4, 'missed')], 5000, open);
    expect(update.book.get(key(4))).toMatchObject({
      status: 'mistake',
      kind: 'missed',
    });
    expect(update.confirmed).toHaveLength(1);
  });

  it('corrected by the follower is marked only from a later reading', () => {
    const book = bookOf([key(4), followerMark(4, 'corrected')]);
    const same = applyLiveOpinions(
      book,
      [opinion(4, 'changed', {audioFrom: 11})],
      5000,
      open,
    );
    expect(same.book).toBe(book);
    const later = applyLiveOpinions(
      book,
      [opinion(4, 'changed', {audioFrom: 13, reading: 1})],
      5000,
      open,
    );
    expect(later.book.get(key(4))).toMatchObject({status: 'mistake'});
  });
});

describe('the gate', () => {
  it('keeps a dismissed word clean', () => {
    const update = applyLiveOpinions(
      emptyMarkBook(),
      [opinion(4, 'changed')],
      5000,
      {...open, dismissed: k => k === key(4)},
    );
    expect(update.book.size).toBe(0);
  });

  it('keeps a hidden word that is not revealed clean', () => {
    const revealed = jest.fn(
      (word: {word: number; totalWords: number}) => word.word < 4,
    );
    const update = applyLiveOpinions(
      emptyMarkBook(),
      [opinion(3, 'changed'), opinion(4, 'changed')],
      5000,
      {...open, revealed},
    );
    expect(update.confirmed.map(m => m.word)).toEqual([3]);
    expect(revealed).toHaveBeenCalledWith(
      expect.objectContaining({word: 4, totalWords: 10}),
    );
  });
});

describe('an added mark', () => {
  const added = (word: number, since: number): [string, WordMark] => [
    addedKey({surah: 18, ayah: 3, word}),
    {
      ...followerMark(word, 'mistake', {since, lastBadAt: since}),
      kind: 'added',
    },
  ];

  it('holds red off the word and the word before it', () => {
    const book = bookOf(added(5, 4000));
    const update = applyLiveOpinions(
      book,
      [opinion(4, 'changed'), opinion(5, 'changed'), opinion(6, 'changed')],
      5000,
      open,
    );
    expect(update.confirmed.map(m => m.word)).toEqual([6]);
  });

  it('only within its reach', () => {
    const book = bookOf(added(5, 4000));
    const update = applyLiveOpinions(
      book,
      [opinion(5, 'changed')],
      4000 + ADDED_HOLD_MS + 1,
      open,
    );
    expect(update.confirmed.map(m => m.word)).toEqual([5]);
  });

  it('taking a live mark back, keeps it back for that reading', () => {
    const shown = applyLiveOpinions(
      emptyMarkBook(),
      [opinion(4, 'changed')],
      5000,
      open,
    ).book;
    const change: VerdictChange = {
      surah: 18,
      ayah: 3,
      word: 5,
      totalWords: 10,
      state: 'ok',
      addedBefore: {sounds: 6, noGap: -3, left: {surah: 18, ayah: 3, word: 4}},
    };
    const taken = applyVerdicts(shown, [change], 5200).book;
    expect(taken.get(key(4))?.status).toBe('noted');
    const later = 5200 + ADDED_HOLD_MS + 1;
    const again = applyLiveOpinions(
      taken,
      [opinion(4, 'changed')],
      later,
      open,
    );
    expect(again.book).toBe(taken);
    const reread = applyLiveOpinions(
      taken,
      [opinion(4, 'changed', {reading: 1})],
      later,
      open,
    );
    expect(reread.book.get(key(4))?.status).toBe('mistake');
  });
});

describe('correcting a live mark', () => {
  const shown = () =>
    applyLiveOpinions(emptyMarkBook(), [opinion(4, 'changed')], 5000, open)
      .book;

  it('a fine reading of the same reading does nothing', () => {
    const book = shown();
    const update = applyLiveOpinions(book, [opinion(4, 'fine')], 6000, open);
    expect(update.book).toBe(book);
  });

  it('a fine later reading corrects it, once', () => {
    const book = shown();
    const update = applyLiveOpinions(
      book,
      [opinion(4, 'fine', {reading: 1})],
      6000,
      open,
    );
    expect(update.book.get(key(4))?.status).toBe('corrected');
    expect(update.corrected.map(m => m.word)).toEqual([4]);
    expect(update.book.get(key(4))?.live?.reading).toBe(1);
    const again = applyLiveOpinions(
      update.book,
      [opinion(4, 'fine', {reading: 1}), opinion(4, 'changed')],
      6500,
      open,
    );
    expect(again.book).toBe(update.book);
  });

  it('a later bad reading marks it again', () => {
    const corrected = applyLiveOpinions(
      shown(),
      [opinion(4, 'fine', {reading: 1})],
      6000,
      open,
    ).book;
    const update = applyLiveOpinions(
      corrected,
      [opinion(4, 'missed', {reading: 2})],
      7000,
      open,
    );
    expect(update.book.get(key(4))).toMatchObject({
      status: 'mistake',
      kind: 'missed',
    });
    expect(update.confirmed).toHaveLength(1);
  });

  it('once the follower writes over it, the readings it settled do not mark it again', () => {
    const settled = new Map<string, number>();
    const gate: LiveMarkGate = {
      ...open,
      settled: k => settled.get(k),
    };
    const first = applyLiveOpinions(
      emptyMarkBook(),
      [opinion(4, 'changed')],
      5000,
      gate,
    );
    settled.set(key(4), 0);
    const fixed = applyLiveOpinions(
      first.book,
      [opinion(4, 'fine', {reading: 1})],
      6000,
      gate,
    );
    settled.set(key(4), 1);
    const change = (state: VerdictChange['state']): VerdictChange => ({
      surah: 18,
      ayah: 3,
      word: 4,
      totalWords: 10,
      state,
    });
    let book = applyVerdicts(fixed.book, [change('wrong')], 6100).book;
    book = applyVerdicts(book, [change('ok')], 6200).book;
    book = confirmDue(book, 6200 + MARK_CONFIRM_MS).book;
    expect(book.get(key(4))?.live).toBeUndefined();
    const sentAgain = [opinion(4, 'changed'), opinion(4, 'fine', {reading: 1})];
    const again = applyLiveOpinions(book, sentAgain, 7000, gate);
    expect(again.confirmed).toEqual([]);
    expect(again.book).toBe(book);
    const later = applyLiveOpinions(
      book,
      [opinion(4, 'changed', {reading: 2})],
      7500,
      gate,
    );
    expect(later.confirmed.map(m => m.live?.reading)).toEqual([2]);
  });

  it('a fine opinion never touches a follower mistake', () => {
    const book = bookOf([key(4), followerMark(4, 'mistake')]);
    const update = applyLiveOpinions(
      book,
      [opinion(4, 'fine', {reading: 3})],
      6000,
      open,
    );
    expect(update.book).toBe(book);
  });
});

describe('the follower lane leaves live marks alone', () => {
  const shown = () =>
    applyLiveOpinions(emptyMarkBook(), [opinion(4, 'changed')], 5000, open)
      .book;
  const verdict = (
    word: number,
    state: VerdictChange['state'],
  ): VerdictChange => ({
    surah: 18,
    ayah: 3,
    word,
    totalWords: 10,
    state,
    detail: {gop: -9, heardRatio: 1, distance: 0.6},
  });

  it.each<VerdictChange['state']>(['ok', 'unsure', 'pending'])(
    "a later '%s' on the word neither notes nor corrects it",
    state => {
      const book = shown();
      const update = applyVerdicts(book, [verdict(4, state)], 6000);
      expect(update.book).toBe(book);
      expect(update.corrected).toEqual([]);
    },
  );

  it('a later bad verdict only notes when it came', () => {
    const update = applyVerdicts(shown(), [verdict(4, 'wrong')], 6000, 14);
    expect(update.book.get(key(4))).toMatchObject({
      status: 'mistake',
      lastBadAt: 6000,
      lastBadAudio: 14,
    });
    expect(update.book.get(key(4))?.live).toBeDefined();
  });

  it('live marks do not count towards confusion', () => {
    let book = emptyMarkBook();
    book = applyLiveOpinions(
      book,
      [opinion(3, 'changed'), opinion(5, 'changed'), opinion(6, 'changed')],
      5000,
      open,
    ).book;
    book = applyVerdicts(book, [verdict(4, 'wrong')], 5000).book;
    book = applyVerdicts(book, [verdict(5, 'ok')], 5200).book;
    const update = confirmDue(book, 5000 + MARK_CONFIRM_MS);
    expect(update.confirmed.map(m => m.word)).toEqual([4]);
  });
});
