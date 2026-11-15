// The added-word rule on real engine code: the corpus and cost table from
// @tilawa/core, over a made-up corpus. Nothing here is Quran text.
import followerConstants from '../followerConstants.npl.json';
import {
  buildVocab,
  collapse,
  fold,
  rejectReason,
  soundCount,
  wordShaped,
  type RuleContext,
  type WordGapReport,
  type WordVocab,
} from '../addedWord';

const {QuranCorpus} = jest.requireActual<{
  QuranCorpus: new (data: unknown) => RuleContext['corpus'];
}>('../../../node_modules/@tilawa/core/dist/recitation/corpus.js');
const {costTable} = jest.requireActual<{
  costTable: () => RuleContext['table'];
}>('../../../node_modules/@tilawa/core/dist/recitation/phonemeCost.js');

// Made-up words, in the follower's phonemes.
const W = {
  a: 'بَتَك',
  b: 'لَمَس',
  c: 'نَدَف',
  d: 'رَجَط',
  e: 'غَزَق',
  f: 'شَهَل',
  g: 'حَصَر',
  extra: 'سَقَب',
  longWord: 'ثَبَتَكُ',
  shortWord: 'هُمَ',
};

function corpusOf(ayat: string[][]) {
  const word = (ph: string) => ['g', ph, 'p'];
  const surahs = Array.from({length: 114}, (_, i) => ({
    n: i + 1,
    name: 's',
    nameEn: 's',
    ayahs:
      i === 0
        ? ayat.map((words, a) => ({n: a + 1, m: '', w: words.map(word)}))
        : [{n: 1, m: '', w: [W.extra, W.longWord, W.shortWord].map(word)}],
  }));
  return new QuranCorpus({v: 2, surahs});
}

// Surah 1: three ayat; the extra word is a word of another surah.
const corpus = corpusOf([
  [W.a, W.b, W.c, W.d],
  [W.e, W.f, W.g],
  [W.c, W.a],
]);
const table = costTable();
const noPause = async () => undefined;

let vocab: WordVocab;
beforeAll(async () => {
  vocab = await buildVocab(corpus, noPause);
});

function gap(extra: Partial<WordGapReport> = {}): WordGapReport {
  return {
    from: 10,
    to: 15,
    chars: W.extra,
    prev: 'ك',
    fitL: 0,
    fitR: 0,
    leftWord: 0,
    noGap: -3,
    ...extra,
  };
}
const reason = (g: WordGapReport, right = 1, v: WordVocab | null = vocab) =>
  rejectReason(g, right, {corpus, table, vocab: v});

describe('the shape of a run', () => {
  it('counts lengthened sounds once', () => {
    expect(collapse('ممم')).toBe('م');
    expect(soundCount('سَسَقَقَب')).toBe(soundCount('سَسَقَب') + 2);
    expect(soundCount('بببَ')).toBe(2);
  });

  it('a word has a consonant, a vowel and one more sound', () => {
    expect(wordShaped('هُم')).toBe(true);
    expect(wordShaped('وَ')).toBe(false);
    expect(wordShaped('ممم')).toBe(false);
    expect(wordShaped('ااا')).toBe(false);
  });

  it('folds spellings of one sound and marks that are no sound', () => {
    expect(fold('ۥۥ')).toBe('و');
    expect(fold('ۦ')).toBe('ي');
    expect(fold('أ')).toBe(fold('إ'));
    expect(fold('بڇ')).toBe('ب');
  });
});

describe('rejectReason', () => {
  it('marks a whole word of the corpus that nothing nearby explains', () => {
    expect(reason(gap())).toBeNull();
  });

  it('refuses a run too short or with no vowel', () => {
    expect(reason(gap({chars: 'وَ'}))).toBe('shape');
    expect(reason(gap({chars: 'سقب'}))).toBe('shape');
  });

  it('refuses when a neighbour does not fit once the run is out', () => {
    expect(reason(gap({fitL: 0.16}))).toBe('fit');
    expect(reason(gap({fitR: 0.16}))).toBe('fit');
    expect(reason(gap({fitL: 0.15, fitR: 0.15}))).toBeNull();
  });

  it('compares fits at three decimals, as the rule was set', () => {
    expect(reason(gap({fitL: 0.15000000596}))).toBeNull();
    expect(reason(gap({fitL: 0.1504}))).toBeNull();
    expect(reason(gap({fitL: 0.1506}))).toBe('fit');
  });

  it('gives a last word of an ayah more room', () => {
    // Left word 3 ends ayah 1, right word 4 starts ayah 2.
    expect(reason(gap({leftWord: 3, fitL: 0.39}), 4)).toBeNull();
    expect(reason(gap({leftWord: 3, fitL: 0.41}), 4)).toBe('fit');
    expect(reason(gap({leftWord: 2, fitR: 0.39}), 3)).toBeNull();
  });

  it('refuses what is no word of the corpus', () => {
    expect(reason(gap({chars: 'زَجَض'}))).toBe('not_a_word');
  });

  it('a long word may differ in its final vowel, a short one not', () => {
    expect(reason(gap({chars: 'ثَبَتَكِ'}))).toBeNull();
    expect(reason(gap({chars: 'هُمِ'}))).toBe('not_a_word');
  });

  it("takes the left word's last sound back when the run starts on a vowel", () => {
    expect(reason(gap({chars: W.extra.slice(1), prev: W.extra[0]}))).toBeNull();
  });

  it('takes off a leading nasal with no vowel after it', () => {
    expect(reason(gap({chars: `ن${W.extra}`}))).toBeNull();
    expect(reason(gap({chars: `نَ${W.extra}`}))).toBe('not_a_word');
  });

  it('asks the audio to insist', () => {
    expect(reason(gap({noGap: -1.9}))).toBe('no_evidence');
    expect(reason(gap({noGap: -2}))).toBeNull();
    expect(reason(gap({noGap: null as unknown as number}))).toBe('no_scores');
  });

  describe('nearby text', () => {
    it('the next words begun early', () => {
      // The right word itself, said before the place it belongs.
      expect(reason(gap({chars: W.b}), 1)).toBe('repeat');
    });

    it('whole words said again', () => {
      // Left word 2 is c, right word 3 is d; a is two words back.
      expect(reason(gap({leftWord: 2, chars: W.a}), 3)).toBe('repeat');
    });

    it('a word from further back is not a repeat of a short run', () => {
      // Word a of ayah 3 is 7 words past ayah 1's a: over backShort for a short run.
      const far = corpusOf([
        [W.a, W.b, W.c, W.d, W.e, W.f, W.g, W.extra, W.b],
        [W.g],
      ]);
      const v = {corpus: far, table, vocab};
      expect(rejectReason(gap({leftWord: 7, chars: W.a}), 8, v)).toBeNull();
    });
  });

  it('the start of a phrase readers add', () => {
    const [phrase] = followerConstants.addedWord.notTextPhrases;
    const chars = phrase.slice(0, 7);
    const v = new Set<string>([fold(chars)]);
    const withPhrase = {exact: v, loose: v};
    expect(reason(gap({chars}), 1, withPhrase)).toBe('phrase');
  });

  it('with no vocabulary yet it marks nothing', () => {
    expect(reason(gap(), 1, null)).toBe('not_ready');
  });
});

describe('buildVocab', () => {
  it('holds every word, folded, and yields between steps', async () => {
    const pause = jest.fn(async () => undefined);
    const many = corpusOf(
      Array.from({length: 30}, () => Array.from({length: 100}, () => W.a)),
    );
    const v = await buildVocab(many, pause, 500);
    expect(v.exact.has(fold(W.a))).toBe(true);
    expect(v.exact.has(fold(W.extra))).toBe(true);
    expect(pause.mock.calls.length).toBeGreaterThanOrEqual(6);
  });
});
