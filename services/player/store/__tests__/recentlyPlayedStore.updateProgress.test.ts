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

/**
 * The store as the next launch has it: a new instance that hydrates from
 * what this one saved, with the catalogue loaded again.
 */
async function relaunch(): Promise<typeof useRecentlyPlayedStore> {
  let store!: typeof useRecentlyPlayedStore;
  jest.isolateModules(() => {
    const catalogue: typeof RECITERS = require('@/data/reciterData').RECITERS;
    catalogue.splice(0, catalogue.length, A, B);
    store = require('../recentlyPlayedStore').useRecentlyPlayedStore;
  });
  if (!store.persist.hasHydrated()) {
    await new Promise<void>(resolve => {
      store.persist.onFinishHydration(() => resolve());
    });
  }
  return store;
}

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

  describe("an upload's card when the reciter it is tagged with plays", () => {
    const uploadMeta = {
      userRecitationId: 'upload-1',
      uploadTitle: 'My recording',
      uploadArtist: 'Me',
    };
    const uploadCard = () =>
      useRecentlyPlayedStore
        .getState()
        .recentTracks.find(t => t.userRecitationId === 'upload-1');

    it('stays when a queue moves on to a catalogue surah of that reciter', () => {
      const store = useRecentlyPlayedStore.getState();
      store.startUploadChain(A, surah(2), 0.5, 300, '', uploadMeta);
      now += 1_000;
      // Loved starts a chain for its first row (B) ...
      store.startNewChain(B, surah(67), 0, 600, 'B-hafs');
      now += 60_000;

      // ... and moves on to A's own recording of Ya-Sin.
      nowPlaying('A', 36, 'A-hafs');
      useRecentlyPlayedStore.getState().updateProgress('A', 36, 0.2, 1000);

      expect(cards()).toEqual([
        {reciter: 'A', surah: 36, rewayah: 'A-hafs', progress: 0.2},
        {reciter: 'B', surah: 67, rewayah: 'B-hafs', progress: 0},
        {reciter: 'A', surah: 2, rewayah: '', progress: 0.5},
      ]);
      expect(uploadCard()?.duration).toBe(300);
    });

    it('stays below the new head when it was at the front', () => {
      useRecentlyPlayedStore
        .getState()
        .startUploadChain(A, surah(2), 0.5, 300, '', uploadMeta);
      now += 60_000;

      // A playlist (no chain) plays A's own recording of Ya-Sin.
      nowPlaying('A', 36, 'A-hafs');
      useRecentlyPlayedStore.getState().updateProgress('A', 36, 0.2, 1000);

      expect(cards()).toEqual([
        {reciter: 'A', surah: 36, rewayah: 'A-hafs', progress: 0.2},
        {reciter: 'A', surah: 2, rewayah: '', progress: 0.5},
      ]);
      expect(uploadCard()?.duration).toBe(300);
    });
  });

  describe('a card dismissed while its track is in the player', () => {
    const keys = () => cards().map(c => `${c.reciter}:${c.surah}`);

    /** A / Ya-Sin is in the player, and its card is the head. */
    function yaSinInThePlayer(): void {
      useRecentlyPlayedStore
        .getState()
        .startNewChain(A, surah(36), 0, 600, 'A-hafs');
      nowPlaying('A', 36, 'A-hafs');
      now += 10_000;
      useRecentlyPlayedStore.getState().updateProgress('A', 36, 0.1, 600);
    }

    /**
     * Its next report: a tick while it plays, or the save made whenever the
     * app is left, even while it is paused.
     */
    function yaSinReports(store = useRecentlyPlayedStore): void {
      now += 10_000;
      store.getState().updateProgress('A', 36, 0.12, 600);
    }

    it('stays cleared after "Clear"', () => {
      yaSinInThePlayer();

      useRecentlyPlayedStore.getState().clearRecentTracks();
      yaSinReports();

      expect(keys()).toEqual([]);
    });

    it('stays removed when it was the only card', () => {
      yaSinInThePlayer();

      useRecentlyPlayedStore.getState().removeTrack(0);
      yaSinReports();

      expect(keys()).toEqual([]);
    });

    it('stays removed when other cards remain', () => {
      useRecentlyPlayedStore
        .getState()
        .startNewChain(B, surah(67), 0.4, 600, 'B-hafs');
      yaSinInThePlayer();

      useRecentlyPlayedStore.getState().removeTrack(0);
      yaSinReports();

      expect(keys()).toEqual(['B:67']);
    });

    it('stays cleared after a relaunch, which restores the same track', async () => {
      yaSinInThePlayer();
      useRecentlyPlayedStore.getState().clearRecentTracks();

      const relaunched = await relaunch();
      yaSinReports(relaunched);

      expect(relaunched.getState().recentTracks).toEqual([]);
    });

    it('does not hold back a track whose card was not the one removed', () => {
      useRecentlyPlayedStore
        .getState()
        .startNewChain(B, surah(67), 0.4, 600, 'B-hafs');
      // A playlist (no chain) has just started Ya-Sin; it has not reported.
      nowPlaying('A', 36, 'A-hafs');

      useRecentlyPlayedStore.getState().removeTrack(0);
      yaSinReports();

      expect(keys()).toEqual(['A:36']);
    });

    it('gets a card again once another track has played', () => {
      yaSinInThePlayer();
      useRecentlyPlayedStore.getState().clearRecentTracks();

      // A playlist moves on to B, then comes back to Ya-Sin.
      nowPlaying('B', 2, 'B-hafs');
      useRecentlyPlayedStore.getState().updateProgress('B', 2, 0.01, 7000);
      nowPlaying('A', 36, 'A-hafs');
      yaSinReports();

      expect(keys()).toEqual(['A:36', 'B:2']);
    });

    it('gets a card again once an upload has played', () => {
      yaSinInThePlayer();
      useRecentlyPlayedStore.getState().clearRecentTracks();

      useRecentlyPlayedStore
        .getState()
        .updateUploadProgress('upload-1', 0.5, 300);
      yaSinReports();

      expect(keys()).toEqual(['A:36']);
    });
  });
});
