// @ai-generated
import {MAX_QUERY_LENGTH, TIER, createSearchIndex} from '../createSearchIndex';
import * as fuzzy from '../fuzzy';

interface Thing {
  id: number;
  name: string;
  tags: string[];
}

const things: Thing[] = [
  {id: 1, name: 'Mishary Alafasi', tags: ['Hafs']},
  {id: 2, name: 'Mahmoud Khalil Al-Hussary', tags: ['Warsh', 'Hafs']},
  {id: 3, name: 'Abdullah Al-Mishal', tags: []},
  {id: 4, name: 'Saud Al-Shuraim', tags: []},
  {id: 5, name: 'Khalid Al-Shoraimy', tags: []},
  {id: 6, name: 'Maher Al Meaqli', tags: []},
];

const index = createSearchIndex(things, {
  fields: [
    {get: t => t.name, weight: 1},
    {get: t => t.tags, weight: 0.6},
  ],
});

function ids(query: string, limit?: number): number[] {
  return index.search(query, limit).map(hit => hit.item.id);
}

describe('createSearchIndex', () => {
  it('returns [] for empty and whitespace queries', () => {
    expect(index.search('')).toEqual([]);
    expect(index.search('   ')).toEqual([]);
  });

  it('scores an exact name highest', () => {
    expect(index.search('mishary alafasi')[0]).toEqual({
      item: things[0],
      score: TIER.exact,
    });
  });

  it('ranks prefix above typo matches', () => {
    expect(ids('mish')).toEqual([1, 3]);
  });

  it('tolerates transliteration variants', () => {
    expect(ids('husary')[0]).toBe(2);
    expect(ids('afasy')[0]).toBe(1);
  });

  it('prefers the closer spelling among skeleton matches', () => {
    expect(ids('shuraym').slice(0, 2)).toEqual([4, 5]);
  });

  it('tolerates a transposition typo', () => {
    expect(ids('mishray')[0]).toBe(1);
  });

  it('matches words across fields', () => {
    expect(ids('husary warsh')).toEqual([2]);
  });

  it('short queries only use prefix tiers', () => {
    // Names starting with "m" (90) beat a later word starting with "m" (80);
    // "Shuraim" contains an "m" but not at a word start, so it is excluded.
    expect(ids('m')).toEqual([1, 2, 6, 3]);
    expect(ids('ai')).toEqual([]);
  });

  it('punctuation is ignored, never treated as syntax', () => {
    expect(ids("'mishary")[0]).toBe(1);
    expect(ids('!mishary')[0]).toBe(1);
    expect(ids('mishary (alafasi)')[0]).toBe(1);
  });

  it('caps very long queries', () => {
    const long = 'mishary '.repeat(500);
    expect(() => index.search(long)).not.toThrow();
    expect(MAX_QUERY_LENGTH).toBe(100);
  });

  it('respects limit and keeps input order on ties', () => {
    expect(ids('hafs')).toEqual([1, 2]);
    expect(ids('hafs', 1)).toEqual([1]);
  });

  it('applies boost as a tie-breaker', () => {
    const boosted = createSearchIndex(things, {
      fields: [{get: t => t.tags, weight: 1}],
      boost: t => (t.id === 2 ? 1 : 0),
    });
    expect(boosted.search('hafs').map(hit => hit.item.id)).toEqual([2, 1]);
  });

  // @ai-start
  it('scores a query again without filler words, slightly lower', () => {
    const titled = createSearchIndex(
      [...things, {id: 7, name: 'Shaik Saud', tags: []}],
      {
        fields: [{get: t => t.name, weight: 1}],
        fillerWords: new Set(['sheikh', 'shaik']),
      },
    );
    const hits = titled.search('shaik saud');
    // The name that carries the title outranks the one that does not.
    expect(hits.map(hit => hit.item.id).slice(0, 2)).toEqual([7, 4]);
    expect(titled.search('sheikh shuraim')[0]?.item.id).toBe(4);
    // A filler alone is searched as typed.
    expect(titled.search('sheikh').map(hit => hit.item.id)).toEqual([]);
  });
  // @ai-end

  // Regression review of the article and filler-word changes.
  it('ranks a name that spells the article as typed above another spelling', () => {
    const named = createSearchIndex(
      [
        {id: 1, name: 'Ahmad Al-Sayed', tags: []},
        {id: 2, name: 'Tawfeeq As-Sayegh', tags: []},
      ],
      {
        fields: [{get: t => t.name, weight: 1}],
        boost: t => (t.id === 1 ? 1 : 0),
      },
    );
    expect(named.search('as sa').map(hit => hit.item.id)).toEqual([2, 1]);
    // Another spelling still matches: "al nur" is An-Nur.
    expect(named.search('al sa').map(hit => hit.item.id)).toEqual([1, 2]);
  });

  it('reads a typed article only as the article of the next word', () => {
    const named = createSearchIndex(
      [
        {id: 1, name: 'Mohammad Al-Airawy', tags: ['Men Tariq Alazraq']},
        {id: 2, name: 'Saud Al-Shuraim', tags: []},
        {id: 3, name: 'Mohammed Siddiq Al-Minshawi', tags: []},
        {id: 4, name: 'Tareq Abdulgani', tags: []},
      ],
      {
        fields: [
          {get: t => t.name, weight: 1},
          {get: t => t.tags, weight: 0.6},
        ],
      },
    );
    // "Al" belongs to "Airawy", not to the "Tariq" of another field.
    expect(named.search('at tariq').map(hit => hit.item.id)).toEqual([4, 1]);
    // "Al" belongs to "Minshawi", not to "Siddiq".
    expect(named.search('ash s').map(hit => hit.item.id)).toEqual([2]);
  });

  it('matches an article split off a glued name only as an article', () => {
    const glued = createSearchIndex(
      [
        {id: 1, name: 'Abdulmajeed Al-Arkani', tags: []},
        {id: 2, name: 'Hani Arrifai', tags: []},
      ],
      {fields: [{get: t => t.name, weight: 1}]},
    );
    // Typed "ar" is the start of both names, not an exact word of Arrifai.
    expect(glued.search('ar').map(hit => hit.item.id)).toEqual([1, 2]);
    expect(glued.search('hani al rifai')[0]?.item.id).toBe(2);
  });

  it('does not read article-like words as articles in a field that opts out', () => {
    const rewayat = createSearchIndex(
      [
        {id: 1, name: 'Sami Abdulrahman', tags: ["Hafs A'n Assem"]},
        {id: 2, name: 'Abdulrahman Al-Sudais', tags: ["Hafs A'n Assem"]},
      ],
      {
        fields: [
          {get: t => t.name, weight: 1},
          {get: t => t.tags, weight: 0.6, articleSpellings: false},
        ],
      },
    );
    // "A'n" ("from") is keyed "an"; a typed "al" must not match it, even
    // before a word that starts the teacher's name ("Assem").
    expect(rewayat.search('abdulrahman al s').map(hit => hit.item.id)).toEqual([
      2,
    ]);
    expect(rewayat.search('abdulrahman al a').map(hit => hit.item.id)).toEqual([
      2,
    ]);
    // Typed as it is spelled, it still matches.
    expect(rewayat.search('hafs an assem').map(hit => hit.item.id)).toEqual([
      1, 2,
    ]);
  });

  it('scores each word once when it also searches without filler words', () => {
    const titled: Thing[] = [
      {id: 1, name: 'Shaik Saud Shuraim', tags: []},
      {id: 2, name: 'Shaik Mishary Alafasi', tags: []},
      {id: 3, name: 'Shaik Abu Bakr Shatri', tags: []},
    ];
    const fields = [{get: (t: Thing) => t.name, weight: 1}];
    const plain = createSearchIndex(titled, {fields});
    const withFillers = createSearchIndex(titled, {
      fields,
      fillerWords: new Set(['shaik']),
    });
    // maxEditsFor runs once per scored word.
    const scored = jest.spyOn(fuzzy, 'maxEditsFor');
    try {
      plain.search('shaik mishary alafasi');
      const once = scored.mock.calls.length;
      scored.mockClear();
      expect(withFillers.search('shaik mishary alafasi')[0]?.item.id).toBe(2);
      // The pass without "shaik" scores no word a second time.
      expect(scored.mock.calls.length).toBe(once);
    } finally {
      scored.mockRestore();
    }
  });
});
