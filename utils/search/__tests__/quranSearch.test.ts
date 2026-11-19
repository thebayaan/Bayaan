// @ai-generated
/**
 * The search engine on a small synthetic index: what makes a phrase, how
 * hits rank, the prefix and hamza rules and the all-words fallback.
 */
import {
  joinPhrase,
  matchedPositions,
  QURAN_MAX_TOKENS,
  QURAN_ONE_WORD_AYAHS,
  searchQuranText,
  type QuranPostingSource,
} from '../quranSearch';
import {
  packPosting,
  verseIndexOf,
  type QuranPosting,
} from '../quranIndexFormat';
import type {QuranQueryToken} from '../quranText';

type Spec = Partial<QuranPosting> & {verseIndex: number; position: number};

function code(spec: Spec): number {
  return packPosting({tier: 3, hasHamza: false, rasmOnly: false, ...spec});
}

/** An in-memory postings source; records its calls. */
function sourceOf(index: Record<string, Spec[]>) {
  const forms = new Map(
    Object.entries(index).map(([form, specs]) => [
      form,
      specs.map(code).sort((a, b) => a - b),
    ]),
  );
  const calls: string[] = [];
  const source: QuranPostingSource = {
    async exact(keys) {
      calls.push(`exact:${keys.join('|')}`);
      const out = new Map<string, readonly number[]>();
      for (const key of keys) {
        const codes = forms.get(key);
        if (codes) out.set(key, codes);
      }
      return out;
    },
    async prefix(prefix, limit) {
      calls.push(`prefix:${prefix}`);
      const out = new Map<string, readonly number[]>();
      for (const [form, codes] of [...forms].sort()) {
        if (form !== prefix && form.startsWith(prefix) && out.size < limit) {
          out.set(form, codes);
        }
      }
      return out;
    },
  };
  return {source, calls};
}

const token = (
  keys: string | string[],
  needsHamza = false,
): QuranQueryToken => ({
  keys: Array.isArray(keys) ? keys : [keys],
  needsHamza,
});

describe('searchQuranText', () => {
  it('finds a phrase only on consecutive slots of one verse', async () => {
    const {source} = sourceOf({
      // verse 0: قال ربك at 5-6; verse 1: قال ... ربك (not consecutive)
      قال: [
        {verseIndex: 0, position: 5},
        {verseIndex: 1, position: 2},
        {verseIndex: 2, position: 128},
      ],
      ربك: [
        {verseIndex: 0, position: 6},
        {verseIndex: 1, position: 9},
        // the next verse's first word: never joined across the verse end
        {verseIndex: 3, position: 1},
      ],
    });
    const found = await searchQuranText([token('قال'), token('ربك')], source);
    expect(found.kind).toBe('phrase');
    expect(found.hits.map(h => [h.verseKey, h.matches])).toEqual([
      ['1:1', [{position: 5, length: 2}]],
    ]);
    expect(found.ayahCount).toBe(1);
    expect(found.occurrenceCount).toBe(1);
  });

  it('ranks exact above clitic-free above article-free above prefix', async () => {
    const {source} = sourceOf({
      كتاب: [
        {verseIndex: 40, position: 1, tier: 1},
        {verseIndex: 30, position: 1, tier: 2},
        {verseIndex: 20, position: 1, tier: 3},
      ],
      كتابه: [{verseIndex: 10, position: 1}],
    });
    const found = await searchQuranText([token('كتاب')], source);
    expect(found.hits.map(h => [h.verseIndex, h.score])).toEqual([
      [20, 130],
      [30, 120],
      [40, 110],
      [10, 90],
    ]);
  });

  it('takes 5 off a rasm-only spelling', async () => {
    const {source} = sourceOf({
      ملك: [
        {verseIndex: 2, position: 1, rasmOnly: true},
        {verseIndex: 5, position: 1},
      ],
    });
    const found = await searchQuranText([token('ملك')], source);
    expect(found.hits.map(h => [h.verseIndex, h.score])).toEqual([
      [5, 130],
      [2, 125],
    ]);
  });

  it('matches a prefix only for the last word, from 3 letters', async () => {
    const {source, calls} = sourceOf({
      الذين: [{verseIndex: 0, position: 1}],
      امنوا: [{verseIndex: 0, position: 2}],
      الذي: [{verseIndex: 3, position: 1}],
    });
    // 'الذ' is not last: no prefix lookup, so no phrase.
    expect(
      (await searchQuranText([token('الذ'), token('امنوا')], source)).hits,
    ).toEqual([]);
    expect(calls).not.toContain('prefix:الذ');
    // Last word, 3 letters: found by prefix.
    const found = await searchQuranText([token('الذين'), token('امن')], source);
    expect(found.hits.map(h => h.verseKey)).toEqual(['1:1']);
    expect(calls).toContain('prefix:امن');
    // Two letters: no prefix lookup.
    calls.length = 0;
    expect((await searchQuranText([token('ال')], source)).hits).toEqual([]);
    expect(calls.some(call => call.startsWith('prefix:'))).toBe(false);
  });

  it('skips words without a hamza when the token was typed with one', async () => {
    const {source} = sourceOf({
      ما: [
        {verseIndex: 7, position: 3, hasHamza: true},
        {verseIndex: 8, position: 1},
      ],
    });
    const water = await searchQuranText([token('ما', true)], source);
    expect(water.hits.map(h => h.verseIndex)).toEqual([7]);
    const what = await searchQuranText([token('ما')], source);
    expect(what.hits.map(h => h.verseIndex)).toEqual([7, 8]);
  });

  it('matches an opening typed as letters as a whole word without a hamza', async () => {
    const {source, calls} = sourceOf({
      // الٓمٓ (2:1), ألم typed without its hamza, and الملك by prefix
      الم: [
        {verseIndex: 7, position: 1},
        {verseIndex: 112, position: 12, hasHamza: true},
      ],
      الملك: [{verseIndex: 300, position: 4}],
    });
    const opening: QuranQueryToken = {
      keys: ['الم'],
      needsHamza: false,
      opening: true,
    };
    const found = await searchQuranText([opening], source);
    expect(found.hits.map(h => h.verseKey)).toEqual(['2:1']);
    expect(calls.some(call => call.startsWith('prefix:'))).toBe(false);
    // The same letters as one word: every match, then the prefix one.
    const word = await searchQuranText([token('الم')], source);
    expect(word.hits.map(h => h.verseIndex)).toEqual([7, 112, 300]);
  });

  describe('a phrase that runs on from an ayah of one word', () => {
    /** A posting at word `position` of the ayah `key`. */
    const at = (key: string, position: number): Spec => ({
      verseIndex: verseIndexOf(key) as number,
      position,
    });
    const {source} = sourceOf({
      الم: [at('2:1', 1), at('3:1', 1), at('2:106', 7)],
      ذلك: [at('2:2', 1), at('2:3', 9), at('2:107', 1)],
      الكتاب: [at('2:2', 2), at('3:3', 4)],
      الله: [at('3:2', 1)],
      حم: [at('42:1', 1)],
      عسق: [at('42:2', 1)],
      كذلك: [at('42:3', 1)],
      تنزيل: [at('2:3', 1)],
    });

    it('finds the words of the next ayah, which is the hit', async () => {
      const found = await searchQuranText(
        [token('الم'), token('ذلك'), token('الكتاب')],
        source,
      );
      expect(found.kind).toBe('phrase');
      expect(found.hits.map(h => [h.verseKey, h.matches])).toEqual([
        ['2:2', [{position: 1, length: 2}]],
      ]);
      // الم الله: 3:1, then 3:2.
      const imran = await searchQuranText(
        [token('الم'), token('الله')],
        source,
      );
      expect(imran.hits.map(h => h.verseKey)).toEqual(['3:2']);
    });

    it('runs on over one-word ayahs in a row (حم عسق كذلك)', async () => {
      const both = await searchQuranText([token('حم'), token('عسق')], source);
      expect(both.hits.map(h => [h.verseKey, h.matches])).toEqual([
        ['42:2', [{position: 1, length: 1}]],
      ]);
      const three = await searchQuranText(
        [token('حم'), token('عسق'), token('كذلك')],
        source,
      );
      expect(three.hits.map(h => [h.verseKey, h.matches])).toEqual([
        ['42:3', [{position: 1, length: 1}]],
      ]);
    });

    it('starts only on a one-word ayah and goes on only into the next', async () => {
      expect(QURAN_ONE_WORD_AYAHS).toContain('2:1');
      expect(QURAN_ONE_WORD_AYAHS).not.toContain('2:106');
      // الم is also a word of 2:106 and ذلك the first of 2:107: no run-on
      // from an ayah of more words, whose end the index does not know.
      const found = await searchQuranText([token('الم'), token('ذلك')], source);
      expect(found.hits.map(h => h.verseKey)).toEqual(['2:2']);
      // تنزيل starts 2:3, two ayahs after 2:1.
      expect(
        (await searchQuranText([token('الم'), token('تنزيل')], source)).hits,
      ).toEqual([]);
      // A one-word token alone is an ordinary search.
      const alone = await searchQuranText([token('الم')], source);
      expect(alone.hits.map(h => h.verseKey)).toEqual(['2:1', '2:106', '3:1']);
    });
  });

  it('matches any key of a token (hamza seat variants)', async () => {
    const {source} = sourceOf({
      مسولا: [{verseIndex: 9, position: 4, hasHamza: true}],
    });
    const found = await searchQuranText(
      [token(['مسوولا', 'مسولا'], true)],
      source,
    );
    expect(found.hits.map(h => h.verseIndex)).toEqual([9]);
  });

  it('uses the keys without a seat only when the token as typed is no word', async () => {
    const {source} = sourceOf({
      // امرأة (a woman) and أمره (his matter), both with a hamza
      امراه: [{verseIndex: 3, position: 2, hasHamza: true}],
      امره: [{verseIndex: 5, position: 4, hasHamza: true}],
      // يسألونك as the index spells it, and the opening يس
      يسالونك: [{verseIndex: 7, position: 1, hasHamza: true}],
      يس: [{verseIndex: 9, position: 1}],
      // أءلهتنا, which أإله starts, and إله
      االهتنا: [{verseIndex: 10, position: 2, hasHamza: true}],
      اله: [{verseIndex: 11, position: 4, hasHamza: true}],
      // a form without a hamza for the first key, with one for the second
      ماا: [{verseIndex: 12, position: 1}],
      ما: [{verseIndex: 13, position: 3, hasHamza: true}],
    });
    const woman = await searchQuranText(
      [token(['امراه', 'امره'], true)],
      source,
    );
    expect(woman.hits.map(h => h.verseIndex)).toEqual([3]);
    // As typed it is no word: the key without its seat letter counts.
    const matter = await searchQuranText(
      [token(['امرات', 'امره'], true)],
      source,
    );
    expect(matter.hits.map(h => h.verseIndex)).toEqual([5]);
    // The start of a word, as typed: its prefix matches, with the others.
    const typing = await searchQuranText([token(['يسا', 'يس'], true)], source);
    expect(typing.hits.map(h => h.verseIndex)).toEqual([7]);
    const god = await searchQuranText([token(['االه', 'اله'], true)], source);
    expect(god.hits.map(h => h.verseIndex)).toEqual([11, 10]);
    // Postings the hamza rule skips are no word.
    const water = await searchQuranText([token(['ماا', 'ما'], true)], source);
    expect(water.hits.map(h => h.verseIndex)).toEqual([13]);
  });

  it('searches ayahs pasted with their numbers by the first of them', async () => {
    const {source} = sourceOf({
      // الحمد لله in verses 1 and 4; الرحمن الرحيم at the start of verse 2
      الحمد: [
        {verseIndex: 1, position: 1},
        {verseIndex: 4, position: 3},
      ],
      لله: [
        {verseIndex: 1, position: 2},
        {verseIndex: 4, position: 4},
      ],
      الرحمن: [
        {verseIndex: 2, position: 1},
        {verseIndex: 1, position: 7},
      ],
    });
    const pasted: QuranQueryToken[] = [
      token('الحمد'),
      token('لله'),
      {...token('الرحمن'), ayahStart: true},
    ];
    const found = await searchQuranText(pasted, source);
    expect(found.kind).toBe('phrase');
    expect(found.hits.map(h => [h.verseIndex, h.matches])).toEqual([
      [1, [{position: 1, length: 2}]],
      [4, [{position: 3, length: 2}]],
    ]);
    // Without the ayah boundary: no phrase, the ayahs with all three words.
    const typed = await searchQuranText(
      [token('الحمد'), token('لله'), token('الرحمن')],
      source,
    );
    expect(typed.kind).toBe('allWords');
    expect(typed.hits.map(h => h.verseIndex)).toEqual([1]);
  });

  it('falls back to every word in one ayah, closest together first', async () => {
    const {source} = sourceOf({
      رب: [
        {verseIndex: 1, position: 1},
        {verseIndex: 2, position: 1},
        {verseIndex: 3, position: 1},
      ],
      العالمين: [
        {verseIndex: 1, position: 9},
        {verseIndex: 2, position: 4},
        {verseIndex: 4, position: 2},
      ],
    });
    // العالمين رب: never in this order
    const found = await searchQuranText(
      [token('العالمين'), token('رب')],
      source,
    );
    expect(found.kind).toBe('allWords');
    expect(found.hits.map(h => [h.verseIndex, matchedPositions(h)])).toEqual([
      [2, [1, 4]],
      [1, [1, 9]],
    ]);
    expect(found.occurrenceCount).toBe(4);
    // A single word never falls back.
    const none = await searchQuranText([token('غائب')], source);
    expect(none).toEqual({
      kind: 'phrase',
      hits: [],
      ayahCount: 0,
      occurrenceCount: 0,
    });
  });

  it('sorts equal scores in mushaf order and groups occurrences per ayah', async () => {
    const {source} = sourceOf({
      الله: [
        {verseIndex: 9, position: 2},
        {verseIndex: 9, position: 7},
        {verseIndex: 1, position: 2},
        {verseIndex: 5, position: 4},
      ],
    });
    const found = await searchQuranText([token('الله')], source);
    expect(found.hits.map(h => h.verseIndex)).toEqual([1, 5, 9]);
    expect(found.hits[2].matches).toEqual([
      {position: 2, length: 1},
      {position: 7, length: 1},
    ]);
    expect(found.ayahCount).toBe(3);
    expect(found.occurrenceCount).toBe(4);
  });

  it(`reads at most ${QURAN_MAX_TOKENS} tokens`, async () => {
    const {source, calls} = sourceOf({});
    const tokens = Array.from({length: 30}, (_, i) => token(`ك${i}`));
    await searchQuranText(tokens, source);
    const exact = calls.find(call => call.startsWith('exact:')) ?? '';
    expect(exact.split('|')).toHaveLength(QURAN_MAX_TOKENS);
  });

  it('asks the source for all exact keys in one call', async () => {
    const {source, calls} = sourceOf({});
    await searchQuranText(
      [token(['مسوولا', 'مسولا']), token('عن'), token('من')],
      source,
    );
    expect(calls.filter(call => call.startsWith('exact:'))).toEqual([
      'exact:مسوولا|مسولا|عن|من',
    ]);
  });
});

describe('joinPhrase', () => {
  it('scores a phrase by its weakest word and keeps the best per verse', () => {
    const slot = (verseIndex: number, position: number) =>
      verseIndex * 256 + position;
    const hits = joinPhrase([
      new Map([
        [slot(4, 1), 130],
        [slot(4, 10), 130],
      ]),
      new Map([
        [slot(4, 2), 90],
        [slot(4, 11), 120],
      ]),
    ]);
    expect(hits).toEqual([
      {
        verseIndex: 4,
        verseKey: '1:5',
        matches: [
          {position: 1, length: 2},
          {position: 10, length: 2},
        ],
        score: 120,
      },
    ]);
  });

  it('never starts a phrase before the first slot of a verse', () => {
    // Slot 512 is "position 0" of verse 2, which no word has.
    expect(joinPhrase([new Map([[512, 130]]), new Map([[513, 130]])])).toEqual(
      [],
    );
  });
});

describe('matchedPositions', () => {
  it('lists every matched slot once', () => {
    expect(
      matchedPositions({
        verseIndex: 0,
        verseKey: '1:1',
        matches: [
          {position: 3, length: 2},
          {position: 4, length: 2},
          {position: 9, length: 1},
        ],
        score: 1,
      }),
    ).toEqual([3, 4, 5, 9]);
  });
});
