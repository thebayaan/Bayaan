/**
 * Adhkar lock screen artwork: which bundled image a list shows, and the
 * once-per-list resolution to a file URL.
 */

const mockDownloadAsync = jest.fn<Promise<void>, []>();
const mockFromModule = jest.fn();
jest.mock('expo-asset', () => ({
  Asset: {fromModule: (id: number) => mockFromModule(id)},
}));

// Metro hands require() of an image back as an asset id; jest-expo does not.
jest.mock('@/constants/adhkarImages', () => ({
  ADHKAR_CATEGORY_IMAGES: {
    'evening-adhkar': {dark: 21, light: 22},
    travel: {dark: 31, light: 32},
  },
}));
jest.mock('@/assets/images/icon.png', () => 99);

import {
  adhkarArtworkAsset,
  cachedAdhkarArtworkUri,
  loadAdhkarArtworkUri,
} from '../adhkarArtwork';

describe('adhkarArtworkAsset', () => {
  const images = {
    'morning-adhkar': {dark: 11, light: 12},
    broken: {dark: {uri: 'x'}, light: 13},
  };

  it("picks the list's dark illustration", () => {
    expect(adhkarArtworkAsset('morning-adhkar', images, 99)).toBe(11);
  });

  it('falls back to the app icon for Saved and unknown lists', () => {
    expect(adhkarArtworkAsset('saved', images, 99)).toBe(99);
    expect(adhkarArtworkAsset('broken', images, 99)).toBe(99);
  });

  it('is null when there is no usable image at all', () => {
    expect(adhkarArtworkAsset('saved', images, null)).toBeNull();
  });

  it('defaults to the shipped image map and the app icon', () => {
    expect(adhkarArtworkAsset('evening-adhkar')).toBe(21);
    expect(adhkarArtworkAsset('saved')).toBe(99);
  });
});

describe('loadAdhkarArtworkUri', () => {
  beforeEach(() => {
    mockDownloadAsync.mockReset().mockResolvedValue(undefined);
    mockFromModule.mockReset();
  });

  it('downloads once per list and caches the local file URL', async () => {
    mockFromModule.mockReturnValue({
      downloadAsync: mockDownloadAsync,
      localUri: 'file:///cache/evening.png',
      uri: 'http://localhost/evening.png',
    });
    expect(cachedAdhkarArtworkUri('evening-adhkar')).toBeUndefined();
    await expect(loadAdhkarArtworkUri('evening-adhkar')).resolves.toBe(
      'file:///cache/evening.png',
    );
    await expect(loadAdhkarArtworkUri('evening-adhkar')).resolves.toBe(
      'file:///cache/evening.png',
    );
    expect(mockFromModule).toHaveBeenCalledWith(21);
    expect(mockDownloadAsync).toHaveBeenCalledTimes(1);
    expect(cachedAdhkarArtworkUri('evening-adhkar')).toBe(
      'file:///cache/evening.png',
    );
  });

  it('uses the asset URL when there is no local file', async () => {
    mockFromModule.mockReturnValue({
      downloadAsync: mockDownloadAsync,
      localUri: null,
      uri: 'http://localhost/travel.png',
    });
    await expect(loadAdhkarArtworkUri('travel')).resolves.toBe(
      'http://localhost/travel.png',
    );
  });
});
