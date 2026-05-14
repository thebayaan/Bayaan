import {buildReciterIndex, reciterToResult} from '../reciter';
import type {Reciter} from '@/data/reciterData';

const fixtures: Reciter[] = [
  {
    id: '1',
    name: 'Mishary Rashid Alafasy',
    slug: 'mishary-rashid-alafasy',
    date: null,
    image_url: null,
    rewayat: [
      {
        id: 'r1',
        reciter_id: '1',
        name: "Hafs A'n Assem",
        style: 'murattal',
        server: '',
        surah_total: 114,
        surah_list: [],
        source_type: 'mp3',
        created_at: '',
      },
    ],
  },
  {
    id: '2',
    name: 'AbdulRahman Sudais',
    slug: 'abdulrahman-sudais',
    date: null,
    image_url: null,
    rewayat: [],
  },
];

describe('reciter adapter', () => {
  const idx = buildReciterIndex(fixtures);

  it('matches by name prefix', () => {
    const hits = idx.search('Mish');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].id).toBe('reciter:1');
  });

  it('matches by slug token', () => {
    const hits = idx.search('sudais');
    expect(hits[0].id).toBe('reciter:2');
  });

  it('reciterToResult produces a RankedResult shape', () => {
    const r = reciterToResult(fixtures[0], {
      textualScore: 0.8,
      personalBoost: 0,
      contextualBoost: 0,
      finalScore: 0.8,
      tier: 'prefix',
      matchedField: 'name',
      matchedRange: [0, 4],
      signal: null,
    });
    expect(r.id).toBe('reciter:1');
    expect(r.type).toBe('reciter');
    expect(r.title).toBe('Mishary Rashid Alafasy');
  });
});
