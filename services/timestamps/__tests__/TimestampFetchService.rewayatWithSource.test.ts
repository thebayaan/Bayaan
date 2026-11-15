// @ai-generated
// `rewayatWithSource` is the one reciter by rewayat loop that the
// Follow-Along registry and the Mushaf player's reciter list both read.
// It must give every rewayah that `hasSource` accepts, with its reciter,
// in catalog order, and read RECITERS as it is when called (dataService
// fills that array in place after start-up).

jest.mock('../../../config/branding', () => {
  const branding: {timestampLocalSurahList?: (id: string) => number[]} = {};
  return {__esModule: true, default: branding};
});

jest.mock('../../../data/reciterData', () => ({
  RECITERS: [
    {
      id: 'reciter-a',
      rewayat: [
        {id: 'rw-a-off', has_timestamps: false},
        {id: 'rw-a-on', has_timestamps: true},
      ],
    },
    {id: 'reciter-b', rewayat: [{id: 'rw-b-local'}]},
    {id: 'reciter-c', rewayat: [{id: 'rw-c-on', has_timestamps: true}]},
  ],
}));

jest.mock('../TimestampDatabaseService', () => ({
  timestampDatabaseService: {},
}));

import branding from '../../../config/branding';
import {RECITERS, type Reciter} from '../../../data/reciterData';
import {timestampFetchService} from '../TimestampFetchService';

const mockBranding = branding as {
  timestampLocalSurahList?: (id: string) => number[];
};

function ids() {
  return timestampFetchService
    .rewayatWithSource()
    .map(({reciter, rewayat}) => [reciter.id, rewayat.id]);
}

function hasSourceIds() {
  return RECITERS.flatMap(reciter =>
    reciter.rewayat
      .filter(rewayat => timestampFetchService.hasSource(rewayat.id))
      .map(rewayat => [reciter.id, rewayat.id]),
  );
}

describe('timestampFetchService.rewayatWithSource', () => {
  beforeEach(() => {
    delete mockBranding.timestampLocalSurahList;
  });

  it('gives each rewayah with has_timestamps and its reciter, in catalog order', () => {
    expect(ids()).toEqual([
      ['reciter-a', 'rw-a-on'],
      ['reciter-c', 'rw-c-on'],
    ]);
  });

  it('returns the catalog objects themselves', () => {
    const [first] = timestampFetchService.rewayatWithSource();
    expect(first.reciter).toBe(RECITERS[0]);
    expect(first.rewayat).toBe(RECITERS[0].rewayat[1]);
  });

  it('counts fork-supplied local coverage on an unflagged rewayah', () => {
    mockBranding.timestampLocalSurahList = id =>
      id === 'rw-b-local' ? [112] : [];

    expect(ids()).toEqual([
      ['reciter-a', 'rw-a-on'],
      ['reciter-b', 'rw-b-local'],
      ['reciter-c', 'rw-c-on'],
    ]);
  });

  it('falls back to has_timestamps when the fork provider throws', () => {
    mockBranding.timestampLocalSurahList = () => {
      throw new Error('fork provider failed');
    };

    expect(ids()).toEqual([
      ['reciter-a', 'rw-a-on'],
      ['reciter-c', 'rw-c-on'],
    ]);
  });

  it('agrees with hasSource for every rewayah', () => {
    expect(ids()).toEqual(hasSourceIds());
    mockBranding.timestampLocalSurahList = id =>
      id === 'rw-b-local' || id === 'rw-a-off' ? [1] : [];
    expect(ids()).toEqual(hasSourceIds());
  });

  it('reads RECITERS when called, so a later fill is seen', () => {
    const added = {
      id: 'reciter-late',
      rewayat: [{id: 'rw-late', has_timestamps: true}],
    } as unknown as Reciter;
    RECITERS.push(added);
    try {
      expect(ids()).toContainEqual(['reciter-late', 'rw-late']);
    } finally {
      RECITERS.pop();
    }
    expect(ids()).not.toContainEqual(['reciter-late', 'rw-late']);
  });
});

describe('timestampFetchService.hasSource', () => {
  beforeEach(() => {
    delete mockBranding.timestampLocalSurahList;
  });

  it('reads has_timestamps from the catalog', () => {
    expect(timestampFetchService.hasSource('rw-a-on')).toBe(true);
    expect(timestampFetchService.hasSource('rw-a-off')).toBe(false);
    expect(timestampFetchService.hasSource('rw-b-local')).toBe(false);
  });

  it('counts local coverage, also for a rewayah outside the catalog', () => {
    expect(timestampFetchService.hasSource('rw-elsewhere')).toBe(false);
    mockBranding.timestampLocalSurahList = id =>
      id === 'rw-elsewhere' ? [1] : [];
    expect(timestampFetchService.hasSource('rw-elsewhere')).toBe(true);
  });
});
