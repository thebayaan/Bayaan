// @ai-generated
const mockRestore = jest.fn((_rewayah?: string) => Promise.resolve());
const mockState = {rewayah: 'hafs'};

jest.mock('../restoreSavedRewayah', () => ({
  restoreSavedRewayah: (rewayah?: string) => {
    mockState.rewayah = rewayah ?? mockState.rewayah;
    return mockRestore(rewayah);
  },
}));

// Pages differ per rewayah so the test sees which data the page came from.
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    getSurahStartPages: () => (mockState.rewayah === 'hafs' ? {2: 2} : {2: 3}),
    getPageForVerse: (key: string) =>
      key === '2:255' ? (mockState.rewayah === 'hafs' ? 42 : 43) : undefined,
  },
}));

import {savedVerseOpenParams} from '../openSavedVerse';

describe('savedVerseOpenParams', () => {
  beforeEach(() => {
    mockRestore.mockClear();
    mockState.rewayah = 'hafs';
  });

  it('opens a Hafs note on its page', async () => {
    const params = await savedVerseOpenParams({
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
      rewayahId: 'hafs',
    });
    expect(params).toEqual({surah: '2', ayah: '255', page: '42'});
    expect(mockRestore).toHaveBeenCalledWith('hafs');
  });

  it('restores the saved rewayah before looking up the page', async () => {
    const params = await savedVerseOpenParams({
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
      rewayahId: 'warsh',
    });
    expect(params.page).toBe('43');
    expect(params.anchor).toBe('2:255');
  });

  it('falls back to the surah start page when the verse is unknown', async () => {
    const params = await savedVerseOpenParams({
      verseKey: '2:999',
      surahNumber: 2,
      ayahNumber: 999,
    });
    expect(params.page).toBe('2');
    expect(mockRestore).toHaveBeenCalledWith(undefined);
  });
});
