// @ai-generated
import {MAX_QUERY_LENGTH, TIER, createSearchIndex} from '../createSearchIndex';

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
});
