// @ai-generated
/**
 * The search engine on a small synthetic index: what makes a phrase, how
 * hits rank, the prefix and hamza rules and the all-words fallback.
 */
import {
  joinPhrase,
  matchedPositions,
  QURAN_MAX_TOKENS,
  searchQuranText,
  type QuranPostingSource,
} from '../quranSearch';
import {packPosting, type QuranPosting} from '../quranIndexFormat';
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
