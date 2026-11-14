// @ai-generated
/**
 * updateProgress() is the ticker that keeps the Home "Continue listening"
 * cards (and the track restored on launch) in step with what is playing.
 * It used to assume that a reciter with a card below the head was reporting
 * a late tick, and wrote the progress onto that card without its surah.
 * In a queue that mixes reciters that is the normal case, not a late tick.
 */

jest.mock('@react-native-async-storage/async-storage', () => {
  const mem = new Map<string, string>();
  return {
    getItem: jest.fn((k: string) => Promise.resolve(mem.get(k) ?? null)),
    setItem: jest.fn((k: string, v: string) => {
      mem.set(k, v);
      return Promise.resolve();
    }),
    removeItem: jest.fn((k: string) => {
      mem.delete(k);
      return Promise.resolve();
    }),
  };
});

const mockPlayer = {
  queue: {tracks: [] as unknown[], currentIndex: 0},
};

jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {getState: () => mockPlayer},
}));

import {RECITERS, type Reciter} from '@/data/reciterData';
import {SURAHS, type Surah} from '@/data/surahData';
import {useRecentlyPlayedStore} from '../recentlyPlayedStore';

function reciter(id: string, rewayat: string[] = [`${id}-hafs`]): Reciter {
  return {
    id,
    name: `Reciter ${id}`,
    rewayat: rewayat.map(r => ({id: r})),
  } as unknown as Reciter;
}

const A = reciter('A');
const B = reciter('B', ['B-hafs', 'B-warsh']);
const surah = (id: number): Surah => SURAHS.find(s => s.id === id) as Surah;

/** Makes `track` the player's current track, as the ticker would see it. */
function nowPlaying(
  reciterId: string,
  surahId: number,
  rewayatId: string,
): void {
  mockPlayer.queue = {
    tracks: [{reciterId, surahId: String(surahId), rewayatId}],
    currentIndex: 0,
  };
}

const cards = () =>
  useRecentlyPlayedStore.getState().recentTracks.map(t => ({
    reciter: t.reciter.id,
    surah: t.surah.id,
    rewayah: t.rewayatId,
    progress: t.progress,
  }));

describe('recentlyPlayedStore.updateProgress()', () => {
  let now = 1_000_000;

  beforeEach(() => {
    RECITERS.splice(0, RECITERS.length, A, B);
    useRecentlyPlayedStore.getState().reset();
    now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('a mixed queue that moves on to another reciter makes that track the head', () => {
    const store = useRecentlyPlayedStore.getState();
    // B was heard earlier (Al-Mulk); then A started a chain (Al-Baqarah).
    store.startNewChain(B, surah(67), 0.4, 600, 'B-hafs');
    store.startNewChain(A, surah(2), 0, 7000, 'A-hafs');
    now += 60_000;

    // The queue (Loved, a playlist) moves on to B / Ya-Sin.
    nowPlaying('B', 36, 'B-hafs');
    useRecentlyPlayedStore.getState().updateProgress('B', 36, 0.5, 1000);

    expect(cards()).toEqual([
      {reciter: 'B', surah: 36, rewayah: 'B-hafs', progress: 0.5},
      {reciter: 'A', surah: 2, rewayah: 'A-hafs', progress: 0},
    ]);
  });

  it('a last tick of the previous track only updates its own card', () => {
    const store = useRecentlyPlayedStore.getState();
    store.startNewChain(B, surah(67), 0.4, 600, 'B-hafs');
    now += 60_000;
    // The user taps a surah by A: the chain starts before the queue changes,
    // and B / Al-Mulk reports once more while it is still the current track.
    store.startNewChain(A, surah(2), 0, 0, 'A-hafs');
    now += 200;
    nowPlaying('B', 67, 'B-hafs');
    useRecentlyPlayedStore.getState().updateProgress('B', 67, 0.45, 600);

    expect(cards()).toEqual([
      {reciter: 'A', surah: 2, rewayah: 'A-hafs', progress: 0},
      {reciter: 'B', surah: 67, rewayah: 'B-hafs', progress: 0.45},
    ]);
  });

  it('the same surah of a lower card, long after the head was made, is what is playing', () => {
    const store = useRecentlyPlayedStore.getState();
    store.startNewChain(B, surah(67), 0.4, 600, 'B-hafs');
    store.startNewChain(A, surah(2), 0, 7000, 'A-hafs');
    now += 10 * 60_000;

    nowPlaying('B', 67, 'B-hafs');
    useRecentlyPlayedStore.getState().updateProgress('B', 67, 0.1, 600);

    expect(cards().map(c => c.reciter)).toEqual(['B', 'A']);
  });

  it('the head follows the rewayah of the track, not only its surah', () => {
    const store = useRecentlyPlayedStore.getState();
    store.startNewChain(B, surah(1), 0, 60, 'B-hafs');

    nowPlaying('B', 2, 'B-warsh');
    useRecentlyPlayedStore.getState().updateProgress('B', 2, 0.2, 7000);

    expect(cards()).toEqual([
      {reciter: 'B', surah: 2, rewayah: 'B-warsh', progress: 0.2},
    ]);
  });

  it('creates the first card when playback began without a chain', () => {
    nowPlaying('A', 18, 'A-hafs');
    useRecentlyPlayedStore.getState().updateProgress('A', 18, 0.3, 1500);

    expect(cards()).toEqual([
      {reciter: 'A', surah: 18, rewayah: 'A-hafs', progress: 0.3},
    ]);
  });

  it("does not rewrite an upload's card that is tagged with the same reciter", () => {
    const store = useRecentlyPlayedStore.getState();
    store.startUploadChain(A, surah(2), 0.5, 300, '', {
      userRecitationId: 'upload-1',
      uploadTitle: 'My recording',
      uploadArtist: 'Me',
    });

    nowPlaying('B', 36, 'B-hafs');
    useRecentlyPlayedStore.getState().updateProgress('B', 36, 0.2, 1000);
    const [head, upload] = useRecentlyPlayedStore.getState().recentTracks;

    expect(head.reciter.id).toBe('B');
    expect(upload.userRecitationId).toBe('upload-1');
    expect(upload.surah.id).toBe(2);
    expect(upload.progress).toBe(0.5);
  });
});
