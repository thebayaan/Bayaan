// @ai-generated
/**
 * Who has follow-along (the main player) and the reciters the Mushaf play
 * options offer were worked out once, from the catalogue as it was at
 * launch, before its background refresh. A reciter whose timings were added
 * in the refresh showed neither until the next launch. Both are now worked
 * out again when dataService refills the catalogue (it then calls the
 * reciter store's catalogLoaded()).
 */
interface MockRewayat {
  id: string;
  name: string;
  style: string;
  has_timestamps: boolean;
}
interface MockReciter {
  id: string;
  name: string;
  image_url: null;
  rewayat: MockRewayat[];
}

const mockReciters: MockReciter[] = [];

jest.mock('@/data/reciterData', () => ({
  // Read on use: the imports below run before the const above is set.
  get RECITERS() {
    return mockReciters;
  },
}));
jest.mock('@/services/timestamps/TimestampFetchService', () => ({
  timestampFetchService: {
    hasSurah: () => true,
    hasSource: (id: string) =>
      mockReciters.some(r =>
        r.rewayat.some(rw => rw.id === id && rw.has_timestamps),
      ),
    // What hasSource accepts, with each rewayah's reciter, from the
    // catalogue as it is at the call.
    rewayatWithSource: () =>
      mockReciters.flatMap(reciter =>
        reciter.rewayat
          .filter(rw => rw.has_timestamps)
          .map(rewayat => ({reciter, rewayat})),
      ),
  },
}));
jest.mock('@/services/timestamps/TimestampService', () => ({
  timestampService: {getTimestampsForSurah: jest.fn()},
}));
jest.mock('expo-audio', () => ({createAudioPlayer: jest.fn()}));
jest.mock('@/services/audio/AudioCoordinator', () => ({
  audioCoordinator: {mushafWillPlay: jest.fn(), sourceDidStop: jest.fn()},
}));
jest.mock('@/store/mushafSettingsStore', () => ({
  useMushafSettingsStore: {getState: () => ({rewayah: 'hafs'})},
}));
jest.mock('@/utils/playbackVerseUnits', () => ({
  readyVerseUnits: () => null,
  canShowRewayahVerses: () => true,
  subscribeVerseUnitsChanges: () => () => undefined,
}));

import {useReciterStore} from '@/store/reciterStore';
import {useTimestampStore} from '@/store/timestampStore';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';

const reciter = (id: string, timed: boolean): MockReciter => ({
  id,
  name: `Reciter ${id}`,
  image_url: null,
  rewayat: [
    {
      id: `${id}-hafs`,
      name: "Hafs A'n Assem",
      style: 'murattal',
      has_timestamps: timed,
    },
  ],
});

/** What dataService does when the catalogue refresh arrives. */
function refreshCatalogue(reciters: MockReciter[]): void {
  mockReciters.splice(0, mockReciters.length, ...reciters);
  useReciterStore.getState().catalogLoaded();
}

const offered = () =>
  useMushafPlayerStore.getState().availableReciters.map(r => r.rewayatId);

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  mockReciters.splice(0, mockReciters.length, reciter('a', true));
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('after the catalogue refresh', () => {
  it('a reciter given timings has follow-along', () => {
    useTimestampStore.getState().loadFollowAlongRegistry();
    expect([...useTimestampStore.getState().supportedReciterIds]).toEqual([
      'a',
    ]);

    refreshCatalogue([reciter('a', true), reciter('b', true)]);

    const {supportedReciterIds, supportedRewayatIds} =
      useTimestampStore.getState();
    expect([...supportedReciterIds].sort()).toEqual(['a', 'b']);
    expect(supportedRewayatIds.has('b-hafs')).toBe(true);
  });

  it('the Mushaf play options offer a reciter given timings', async () => {
    await useMushafPlayerStore.getState().computeAvailableReciters();
    expect(offered()).toEqual(['a-hafs']);

    refreshCatalogue([reciter('a', true), reciter('b', true)]);
    await Promise.resolve();

    expect(offered()).toEqual(['a-hafs', 'b-hafs']);
  });

  it('and no longer offer one whose timings were withdrawn', async () => {
    await useMushafPlayerStore.getState().computeAvailableReciters();

    refreshCatalogue([reciter('a', false)]);
    await Promise.resolve();

    expect(offered()).toEqual([]);
  });
});
