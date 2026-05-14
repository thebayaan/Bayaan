import {createOrchestrator} from '../orchestrator';
import {SURAHS} from '@/data/surahData';
import {REWAYAT_REGISTRY} from '@/data/rewayat';
import {loadAsma} from '../adapters/names';
import {loadAdhkarCategories} from '../adapters/adhkar';
import type {Reciter} from '@/data/reciterData';

const reciters: Reciter[] = [
  {
    id: 'r1',
    name: 'Mishary Alafasy',
    slug: 'mishary-rashid-alafasy',
    date: null,
    image_url: null,
    rewayat: [
      {
        id: 'rw-r1-1',
        reciter_id: 'r1',
        name: "Hafs A'n Assem",
        style: 'murattal',
        server: 'https://example.com/r1/',
        surah_total: 114,
        surah_list: Array.from({length: 114}, (_, i) => i + 1),
        source_type: 'mp3quran',
        created_at: '2024-01-01T00:00:00Z',
      },
    ],
  },
  {
    id: 'r2',
    name: 'AbdulRahman Sudais',
    slug: 'abdulrahman-al-sudais',
    date: null,
    image_url: null,
    rewayat: [
      {
        id: 'rw-r2-1',
        reciter_id: 'r2',
        name: "Hafs A'n Assem",
        style: 'murattal',
        server: 'https://example.com/r2/',
        surah_total: 114,
        surah_list: Array.from({length: 114}, (_, i) => i + 1),
        source_type: 'mp3quran',
        created_at: '2024-01-01T00:00:00Z',
      },
    ],
  },
  {
    id: 'r3',
    name: 'Yasser Ad-Dossari',
    slug: 'yasser-al-dossari',
    date: null,
    image_url: null,
    rewayat: [
      {
        id: 'rw-r3-1',
        reciter_id: 'r3',
        name: "Hafs A'n Assem",
        style: 'murattal',
        server: 'https://example.com/r3/',
        surah_total: 114,
        surah_list: Array.from({length: 114}, (_, i) => i + 1),
        source_type: 'mp3quran',
        created_at: '2024-01-01T00:00:00Z',
      },
    ],
  },
];

const personalCtx = {
  lovedReciterIds: new Set<string>(),
  lovedTrackIds: new Set<string>(),
  downloadedTrackIds: new Set<string>(),
  defaultReciterId: null,
  defaultRewayatId: null,
  recentResultIds: new Set<string>(),
};

const NEUTRAL_TIME = new Date(2026, 4, 11, 14, 0).getTime();

const orch = createOrchestrator({
  reciters,
  surahs: SURAHS,
  rewayat: [...REWAYAT_REGISTRY],
  adhkarCategories: loadAdhkarCategories(),
  names: loadAsma(),
  playlists: [],
  personalCtxProvider: () => personalCtx,
});

describe('orchestrator', () => {
  it('returns empty results for empty query', () => {
    const res = orch.search({query: '', now: NEUTRAL_TIME});
    expect(res.results).toEqual([]);
    expect(res.tabs).toEqual([]);
  });

  it('returns surah hit for "yasin"', () => {
    const res = orch.search({query: 'yasin', now: NEUTRAL_TIME});
    const top = res.results[0];
    expect(top.type).toBe('surah');
    expect(top.id).toBe('surah:36');
  });

  it('produces a numeric_ref result for "2:255"', () => {
    const res = orch.search({query: '2:255', now: NEUTRAL_TIME});
    expect(res.results.some(r => r.type === 'numeric_ref')).toBe(true);
  });

  it('orders results by finalScore descending', () => {
    const res = orch.search({query: 'al', now: NEUTRAL_TIME});
    for (let i = 1; i < res.results.length; i++) {
      expect(res.results[i - 1].features.finalScore).toBeGreaterThanOrEqual(
        res.results[i].features.finalScore,
      );
    }
  });

  it('builds dynamic tabs only for types present in results', () => {
    const res = orch.search({query: 'hafs', now: NEUTRAL_TIME});
    const tabTypes = res.tabs.map(t => t.type);
    expect(tabTypes[0]).toBe('all');
    expect(tabTypes).toContain('rewayat');
    expect(tabTypes).not.toContain('numeric_ref');
  });
});

describe('orchestrator snapshots', () => {
  for (const q of ['yas', 'fatiha', 'hafs', '2:255', 'page 100', 'amma']) {
    it(`stable ranking for "${q}"`, () => {
      const res = orch.search({query: q, now: NEUTRAL_TIME});
      const shape = res.results.slice(0, 5).map(r => ({
        id: r.id,
        type: r.type,
        title: r.title,
        tier: r.features.tier,
      }));
      expect(shape).toMatchSnapshot();
    });
  }
});
