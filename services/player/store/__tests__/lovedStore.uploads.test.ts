// @ai-generated
/**
 * An upload is saved in Loved without a rewayah, and an entry without a
 * rewayah used to stand for every rewayah of its reciter and surah (the
 * "old format"). So loving an upload made the catalogue recording of the
 * same reciter and surah show as loved, and unloving that removed the
 * upload. An upload is now matched by its own id.
 */
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {trackFavoriteToggled: jest.fn()},
}));

import {useLovedStore, type LovedTrack} from '../lovedStore';

const R = 'reciter-a';
const S = '36';
const RW = 'rewayah-hafs';

const store = () => useLovedStore.getState();
const saved = (): Array<Partial<LovedTrack>> =>
  store().tracks.map(({timestamp: _timestamp, ...rest}) => rest);

beforeEach(() => {
  useLovedStore.setState({tracks: []});
});

describe('an upload and the catalogue recording of the same surah', () => {
  it('loving the upload does not love the catalogue recording', () => {
    store().toggleLoved(R, S, '', 'upload-1');

    expect(store().isLovedWithRewayat(R, S, '', 'upload-1')).toBe(true);
    expect(store().isLovedWithRewayat(R, S, RW)).toBe(false);
  });

  it('loving the catalogue recording does not love the upload', () => {
    store().toggleLoved(R, S, RW);

    expect(store().isLovedWithRewayat(R, S, RW)).toBe(true);
    expect(store().isLovedWithRewayat(R, S, '', 'upload-1')).toBe(false);
  });

  it('both can be loved, and unloving one keeps the other', () => {
    store().toggleLoved(R, S, '', 'upload-1');
    // This used to find the upload's entry and remove it.
    store().toggleLoved(R, S, RW);
    expect(saved()).toEqual([
      {reciterId: R, surahId: S, rewayatId: RW, userRecitationId: undefined},
      {reciterId: R, surahId: S, rewayatId: '', userRecitationId: 'upload-1'},
    ]);

    store().toggleLoved(R, S, RW);
    expect(saved()).toEqual([
      {reciterId: R, surahId: S, rewayatId: '', userRecitationId: 'upload-1'},
    ]);

    store().toggleLoved(R, S, RW);
    store().toggleLoved(R, S, '', 'upload-1');
    expect(saved()).toEqual([
      {reciterId: R, surahId: S, rewayatId: RW, userRecitationId: undefined},
    ]);
  });

  it('two uploads of the same surah are loved separately', () => {
    store().toggleLoved(R, S, '', 'upload-1');
    store().toggleLoved(R, S, '', 'upload-2');
    expect(store().tracks).toHaveLength(2);

    store().toggleLoved(R, S, '', 'upload-1');
    expect(store().isLovedWithRewayat(R, S, '', 'upload-1')).toBe(false);
    expect(store().isLovedWithRewayat(R, S, '', 'upload-2')).toBe(true);
  });

  it('an upload stays loved, and can be unloved, after it is re-tagged', () => {
    store().toggleLoved(R, S, '', 'upload-1');

    // The same upload, now tagged with another reciter and surah.
    expect(store().isLovedWithRewayat('reciter-b', '2', '', 'upload-1')).toBe(
      true,
    );
    store().toggleLoved('reciter-b', '2', '', 'upload-1');
    expect(store().tracks).toEqual([]);
  });
});

describe('entries saved before uploads had their own identity', () => {
  it('an old entry without a rewayah still counts for every rewayah', () => {
    useLovedStore.setState({
      tracks: [{reciterId: R, surahId: S, rewayatId: '', timestamp: 1}],
    });

    expect(store().isLovedWithRewayat(R, S, RW)).toBe(true);
    store().toggleLoved(R, S, RW);
    expect(store().tracks).toEqual([]);
  });

  it('a row that knows neither its rewayah nor its upload id still finds the upload', () => {
    // The generic surah options on an upload row in Loved ask this way.
    store().toggleLoved(R, S, '', 'upload-1');

    expect(store().isLovedWithRewayat(R, S, '')).toBe(true);
    expect(store().isLoved(R, S)).toBe(true);
    store().toggleLoved(R, S, '');
    expect(store().tracks).toEqual([]);
  });
});

describe('removeUploads', () => {
  it('drops only the entries of the deleted uploads', () => {
    store().toggleLoved(R, S, RW);
    store().toggleLoved(R, S, '', 'upload-1');
    store().toggleLoved(R, '2', '', 'upload-2');
    store().toggleLoved(R, '3', '', 'upload-3');

    store().removeUploads(['upload-1', 'upload-3', 'never-loved']);

    expect(saved()).toEqual([
      {reciterId: R, surahId: '2', rewayatId: '', userRecitationId: 'upload-2'},
      {reciterId: R, surahId: S, rewayatId: RW, userRecitationId: undefined},
    ]);
  });

  it('leaves the list untouched when none of them is loved', () => {
    store().toggleLoved(R, S, RW);
    const before = store().tracks;

    store().removeUploads(['upload-9']);

    expect(store().tracks).toBe(before);
  });
});
