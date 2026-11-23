// @ai-generated
// Follow-Along registry — `loadFollowAlongRegistry` must derive support from
// `timestampFetchService.hasSource`, so RFC-019 fork-supplied bundled timings
// (`branding.timestampLocalSurahList`) count as a source. The Mushaf
// player's reciter list (`mushafPlayerStore.computeAvailableReciters`) must
// name the same rewayat, in catalog order.
//
// Covers, for both lists:
//   - branding unset → exactly the `has_timestamps` set (Bayaan default)
//   - local coverage on an unflagged rewayat → reciter + rewayat listed
//   - a throwing fork provider → falls back to the `has_timestamps` set

jest.mock('../../config/branding', () => {
  const branding: {timestampLocalSurahList?: (id: string) => number[]} = {};
  return {__esModule: true, default: branding};
});

jest.mock('../../data/reciterData', () => {
  const rw = (id: string, has_timestamps?: boolean) => ({
    id,
    name: `Rewayah ${id}`,
    style: `style-${id}`,
    has_timestamps,
  });
  return {
    RECITERS: [
      {
        id: 'reciter-r2',
        name: 'Reciter R2',
        image_url: 'https://img.example/r2.jpg',
        rewayat: [rw('rw-r2', true)],
      },
      {
        id: 'reciter-local',
        name: 'Reciter Local',
        image_url: null,
        rewayat: [rw('rw-local', false)],
      },
      {
        id: 'reciter-none',
        name: 'Reciter None',
        image_url: null,
        rewayat: [rw('rw-none')],
      },
      {
        id: 'reciter-two',
        name: 'Reciter Two',
        image_url: null,
        rewayat: [rw('rw-two-off'), rw('rw-two-on', true)],
      },
    ],
  };
});

jest.mock('../../services/timestamps/TimestampDatabaseService', () => ({
  timestampDatabaseService: {},
}));

jest.mock('../../services/audio/MushafAudioService', () => ({
  mushafAudioService: {},
}));

import branding from '../../config/branding';
import {useTimestampStore} from '../timestampStore';
import {useMushafPlayerStore} from '../mushafPlayerStore';

const mockBranding = branding as {
  timestampLocalSurahList?: (id: string) => number[];
};

function loadRegistry() {
  useTimestampStore.getState().loadFollowAlongRegistry();
  const {supportedRewayatIds, supportedReciterIds, registryLoaded} =
    useTimestampStore.getState();
  return {
    rewayat: [...supportedRewayatIds].sort(),
    reciters: [...supportedReciterIds].sort(),
    registryLoaded,
  };
}

async function loadPlayerReciters() {
  await useMushafPlayerStore.getState().computeAvailableReciters();
  return useMushafPlayerStore.getState().availableReciters;
}

const R2 = {
  rewayatId: 'rw-r2',
  reciterId: 'reciter-r2',
  reciterName: 'Reciter R2',
  imageUrl: 'https://img.example/r2.jpg',
  rewayahName: 'Rewayah rw-r2',
  style: 'style-rw-r2',
};
const LOCAL = {
  rewayatId: 'rw-local',
  reciterId: 'reciter-local',
  reciterName: 'Reciter Local',
  imageUrl: null,
  rewayahName: 'Rewayah rw-local',
  style: 'style-rw-local',
};
const TWO_ON = {
  rewayatId: 'rw-two-on',
  reciterId: 'reciter-two',
  reciterName: 'Reciter Two',
  imageUrl: null,
  rewayahName: 'Rewayah rw-two-on',
  style: 'style-rw-two-on',
};

describe('timestampStore.loadFollowAlongRegistry', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    delete mockBranding.timestampLocalSurahList;
    logSpy = jest.spyOn(console, 'log').mockImplementation(jest.fn());
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('registers only has_timestamps rewayat when the seam is unset', () => {
    expect(loadRegistry()).toEqual({
      rewayat: ['rw-r2', 'rw-two-on'],
      reciters: ['reciter-r2', 'reciter-two'],
      registryLoaded: true,
    });
  });

  it('registers a rewayat with fork-supplied local coverage', () => {
    mockBranding.timestampLocalSurahList = id =>
      id === 'rw-local' ? [1, 2] : [];

    expect(loadRegistry()).toEqual({
      rewayat: ['rw-local', 'rw-r2', 'rw-two-on'],
      reciters: ['reciter-local', 'reciter-r2', 'reciter-two'],
      registryLoaded: true,
    });
  });

  it('falls back to has_timestamps when the fork provider throws', () => {
    mockBranding.timestampLocalSurahList = () => {
      throw new Error('fork provider failed');
    };

    expect(loadRegistry()).toEqual({
      rewayat: ['rw-r2', 'rw-two-on'],
      reciters: ['reciter-r2', 'reciter-two'],
      registryLoaded: true,
    });
  });
});

describe('mushafPlayerStore.computeAvailableReciters', () => {
  beforeEach(() => {
    delete mockBranding.timestampLocalSurahList;
  });

  it('lists only has_timestamps rewayat when the seam is unset', async () => {
    expect(await loadPlayerReciters()).toEqual([R2, TWO_ON]);
  });

  it('lists a rewayat with fork-supplied local coverage', async () => {
    mockBranding.timestampLocalSurahList = id =>
      id === 'rw-local' ? [1, 2] : [];

    expect(await loadPlayerReciters()).toEqual([R2, LOCAL, TWO_ON]);
  });

  it('falls back to has_timestamps when the fork provider throws', async () => {
    mockBranding.timestampLocalSurahList = () => {
      throw new Error('fork provider failed');
    };

    expect(await loadPlayerReciters()).toEqual([R2, TWO_ON]);
  });
});
