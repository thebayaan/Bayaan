import {createOrchestrator} from '../orchestrator';
import {SURAHS} from '@/data/surahData';
import {REWAYAT_REGISTRY} from '@/data/rewayat';
import {loadAdhkarCategories} from '../adapters/adhkar';
import {loadAsma} from '../adapters/names';
import type {Reciter} from '@/data/reciterData';
import type {PersonalContext} from '../personalSignals';

// Mirror the fixture pattern from orchestrator.test.ts exactly.
// r3 (Yasser Ad-Dossari) is the "loved" reciter in the personal-boost test.
// All three names contain 'a', so query 'a' matches all three equally on text,
// letting the personal boost flip the ordering.
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

function make(ctxOverride: Partial<PersonalContext> = {}) {
  const base: PersonalContext = {
    lovedReciterIds: new Set<string>(),
    lovedTrackIds: new Set<string>(),
    downloadedTrackIds: new Set<string>(),
    defaultReciterId: null,
    defaultRewayatId: null,
    recentResultIds: new Set<string>(),
  };
  return createOrchestrator({
    reciters: [...reciters],
    surahs: SURAHS,
    rewayat: [...REWAYAT_REGISTRY],
    adhkarCategories: loadAdhkarCategories(),
    names: loadAsma(),
    playlists: [],
    personalCtxProvider: () => ({...base, ...ctxOverride}),
  });
}

// Mon 11 May 2026 14:00 local — neutral weekday, no contextual boost.
const T = new Date(2026, 4, 11, 14, 0).getTime();

describe('integration: personal signal flips ordering', () => {
  it('puts loved reciter above an equally-textual cold match', () => {
    // Query 'a' hits all three reciter names (Alafasy, AbdulRahman, Ad-Dossari)
    // so text scores are comparable; the loved boost on r3 should lift it to first.
    const cold = make();
    const warm = make({lovedReciterIds: new Set(['r3'])});

    const qCold = cold.search({query: 'a', now: T});
    const qWarm = warm.search({query: 'a', now: T});

    const coldOrder = qCold.results
      .filter(r => r.type === 'reciter')
      .map(r => r.id);
    const warmOrder = qWarm.results
      .filter(r => r.type === 'reciter')
      .map(r => r.id);

    // Orders must differ and the loved reciter must be first.
    expect(coldOrder).not.toEqual(warmOrder);
    expect(warmOrder[0]).toBe('reciter:r3');
  });
});

describe('integration: contextual signal nudges Friday', () => {
  it('puts Al-Kahf no lower on Friday than on a weekday for a query matching multiple surahs', () => {
    // Fri 15 May 2026 14:00 — Friday contextual boost for surah 18 (Al-Kahf).
    const friday = new Date(2026, 4, 15, 14, 0).getTime();
    const orch = make();

    // 'al' matches many surahs including Al-Kahf (18), Al-Fatiha (1), Al-Baqara (2), etc.
    const idxWeekday = orch
      .search({query: 'al', now: T})
      .results.findIndex(r => r.id === 'surah:18');
    const idxFriday = orch
      .search({query: 'al', now: friday})
      .results.findIndex(r => r.id === 'surah:18');

    // On Friday, Al-Kahf should rank at least as high (lower index = higher rank).
    expect(idxFriday).toBeLessThanOrEqual(idxWeekday);
  });
});
