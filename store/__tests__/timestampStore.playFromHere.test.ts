// @ai-generated
/**
 * Main-player "Play from here" against the timestamp store's load state
 * (the real store/timestampStore.ts; the timing source is faked).
 *
 * It used to read "Preparing verse timing / Try again in a moment." forever
 * once a surah's timings had failed to load or did not exist (offline, CDN
 * error, a surah the reciter has no timing for), because a settled load left
 * the same `null` as a load in flight. Now:
 *  - 'pending' only while the timings are on their way, and it resolves once
 *    the load settles;
 *  - a load that settled without timings says why, and a failed one is
 *    retried by the next request, so "try again" holds;
 *  - the previous surah's timings are never used while the next one loads,
 *    and a superseded load never overwrites the current one.
 */

const mockSource = {online: true, covered: true};
const mockFetches: string[] = [];
const mockGates = new Map<string, Promise<void>>();

jest.mock('@/data/reciterData', () => ({
  RECITERS: jest
    .requireActual('@/services/timestamps/__fixtures__/timingFixtures')
    .fixtureCatalog(),
}));

jest.mock('@/services/timestamps/TimestampService', () => ({
  timestampService: {
    getTimestampsForSurah: jest.fn(async (set: string, surah: number) => {
      const key = `${set}-${surah}`;
      mockFetches.push(key);
      const held = mockGates.get(key);
      if (held) await held;
      if (!mockSource.covered || !mockSource.online) return null;
      return jest
        .requireActual('@/services/timestamps/__fixtures__/timingFixtures')
        .loadTimings(set, surah);
    }),
  },
}));

jest.mock('@/services/timestamps/TimestampFetchService', () => ({
  timestampFetchService: {
    hasSurah: () => mockSource.covered,
    hasSource: () => true,
  },
}));

import {resolvePlayFromHere, useTimestampStore} from '../timestampStore';
import {
  getPlayFromHereTarget,
  PLAY_FROM_HERE_LOAD_FAILED,
  PLAY_FROM_HERE_NO_TIMING,
  PLAY_FROM_HERE_PENDING,
} from '@/utils/timestampUtils';
import {loadTimings} from '@/services/timestamps/__fixtures__/timingFixtures';

const store = () => useTimestampStore.getState();

async function flush() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

function gate(key: string): () => void {
  let release: () => void = () => undefined;
  mockGates.set(
    key,
    new Promise<void>(resolve => {
      release = resolve;
    }),
  );
  return () => {
    mockGates.delete(key);
    release();
  };
}

beforeEach(() => {
  mockSource.online = true;
  mockSource.covered = true;
  mockFetches.length = 0;
  mockGates.clear();
  store().clearCurrentTimestamps();
});

describe('Play from here after a load that settled without timings', () => {
  it('a surah the reciter has no timing for: says so, and does not refetch', async () => {
    mockSource.covered = false;
    await store().loadTimestampsForSurah('hafs-clean', 2);
    expect(store().timestampLoadStatus).toBe('not-covered');
    for (let tap = 0; tap < 3; tap++) {
      expect(resolvePlayFromHere('2:5')).toEqual({
        status: 'unavailable',
        ...PLAY_FROM_HERE_NO_TIMING,
      });
      await flush();
    }
    expect(mockFetches).toEqual(['hafs-clean-2']);
  });

  it('offline: says it could not be loaded, and the next request retries', async () => {
    mockSource.online = false;
    await store().loadTimestampsForSurah('hafs-clean', 2);
    expect(store().timestampLoadStatus).toBe('failed');
    expect(store().currentSurahTimestamps).toBeNull();

    mockSource.online = true; // the connection is back
    expect(resolvePlayFromHere('2:5')).toEqual({
      status: 'unavailable',
      ...PLAY_FROM_HERE_LOAD_FAILED,
    });
    await flush();
    expect(mockFetches).toEqual(['hafs-clean-2', 'hafs-clean-2']);
    expect(store().timestampLoadStatus).toBe('ready');

    const target = resolvePlayFromHere('2:5');
    expect(target.status).toBe('ready');
    if (target.status !== 'ready') return;
    expect(target.entry).toBe(store().currentSurahTimestamps![4]);
    expect(target.tracking).toMatchObject({
      verseKey: '2:5',
      verseKeys: ['2:5'],
    });
  });

  it('the same failure on the main player track is never "pending" for good', async () => {
    mockSource.online = false;
    await store().loadTimestampsForSurah('warsh-14', 2);
    for (let tap = 0; tap < 3; tap++) {
      expect(resolvePlayFromHere('2:5').status).toBe('unavailable');
      await flush();
    }
  });
});

describe('Play from here while the timings load', () => {
  it('is pending while the load is in flight, then resolves', async () => {
    const release = gate('hafs-clean-2');
    const loading = store().loadTimestampsForSurah('hafs-clean', 2);
    expect(store().timestampLoadStatus).toBe('loading');
    expect(resolvePlayFromHere('2:5')).toEqual({
      status: 'pending',
      ...PLAY_FROM_HERE_PENDING,
    });
    release();
    await loading;
    expect(resolvePlayFromHere('2:5').status).toBe('ready');
  });

  it("never uses the previous surah's timings while the next surah loads", async () => {
    await store().loadTimestampsForSurah('hafs-clean', 2);
    const release = gate('hafs-clean-112');
    const loading = store().loadTimestampsForSurah('hafs-clean', 112);
    // al-Baqarah's timings are still in the store meanwhile
    expect(store().currentSurahTimestamps).toHaveLength(286);
    expect(resolvePlayFromHere('112:2').status).toBe('pending');
    release();
    await loading;
    const target = resolvePlayFromHere('112:2');
    expect(target.status === 'ready' && target.entry).toBe(
      store().currentSurahTimestamps![1],
    );
    expect(target.status === 'ready' && target.tracking.verseKey).toBe('112:2');
  });

  it('a superseded load never overwrites the current track', async () => {
    const release = gate('hafs-clean-2');
    const first = store().loadTimestampsForSurah('hafs-clean', 2);
    await store().loadTimestampsForSurah('hafs-clean', 112);
    expect(store().currentTimestampKey).toBe('hafs-clean-112');
    release();
    await first;
    expect(store().currentTimestampKey).toBe('hafs-clean-112');
    expect(store().currentSurahTimestamps).toHaveLength(
      loadTimings('hafs-clean', 112)!.length,
    );
    expect(store().timestampLoadStatus).toBe('ready');
  });

  it('a load cleared mid-flight (no track) stays cleared', async () => {
    const release = gate('hafs-clean-2');
    const loading = store().loadTimestampsForSurah('hafs-clean', 2);
    store().clearCurrentTimestamps();
    release();
    await loading;
    expect(store().currentSurahTimestamps).toBeNull();
    expect(store().currentTimestampKey).toBeNull();
    expect(store().timestampLoadStatus).toBe('idle');
  });
});

describe('Hafs', () => {
  it('a loaded surah resolves exactly as the timestamps array always did', async () => {
    await store().loadTimestampsForSurah('hafs-clean', 2);
    const t = store().currentSurahTimestamps!;
    for (const ayah of [1, 5, 255, 286]) {
      expect(resolvePlayFromHere(`2:${ayah}`)).toEqual(
        getPlayFromHereTarget(t, `2:${ayah}`),
      );
    }
    expect(mockFetches).toEqual(['hafs-clean-2']);
  });

  it('loading the surah already loaded does not fetch again', async () => {
    await store().loadTimestampsForSurah('hafs-clean', 2);
    await store().loadTimestampsForSurah('hafs-clean', 2);
    expect(mockFetches).toEqual(['hafs-clean-2']);
  });
});
