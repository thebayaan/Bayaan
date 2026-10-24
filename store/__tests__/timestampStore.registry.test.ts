// @ai-generated
// Follow-Along registry — `loadFollowAlongRegistry` must derive support from
// `timestampFetchService.hasSource`, so RFC-019 fork-supplied bundled timings
// (`branding.timestampLocalSurahList`) count as a source, exactly like
// `mushafPlayerStore.computeAvailableReciters` already does.
//
// Covers:
//   - branding unset → registry is exactly the `has_timestamps` set (Bayaan default)
//   - local coverage on an unflagged rewayat → reciter + rewayat registered
//   - a throwing fork provider → falls back to the `has_timestamps` set

jest.mock('../../config/branding', () => {
  const branding: {timestampLocalSurahList?: (id: string) => number[]} = {};
  return {__esModule: true, default: branding};
});

jest.mock('../../data/reciterData', () => ({
  RECITERS: [
    {id: 'reciter-r2', rewayat: [{id: 'rw-r2', has_timestamps: true}]},
    {id: 'reciter-local', rewayat: [{id: 'rw-local', has_timestamps: false}]},
    {id: 'reciter-none', rewayat: [{id: 'rw-none'}]},
  ],
}));

jest.mock('../../services/timestamps/TimestampDatabaseService', () => ({
  timestampDatabaseService: {},
}));

import branding from '../../config/branding';
import {useTimestampStore} from '../timestampStore';

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
      rewayat: ['rw-r2'],
      reciters: ['reciter-r2'],
      registryLoaded: true,
    });
  });

  it('registers a rewayat with fork-supplied local coverage', () => {
    mockBranding.timestampLocalSurahList = id =>
      id === 'rw-local' ? [1, 2] : [];

    expect(loadRegistry()).toEqual({
      rewayat: ['rw-local', 'rw-r2'],
      reciters: ['reciter-local', 'reciter-r2'],
      registryLoaded: true,
    });
  });

  it('falls back to has_timestamps when the fork provider throws', () => {
    mockBranding.timestampLocalSurahList = () => {
      throw new Error('fork provider failed');
    };

    expect(loadRegistry()).toEqual({
      rewayat: ['rw-r2'],
      reciters: ['reciter-r2'],
      registryLoaded: true,
    });
  });
});
