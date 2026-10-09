// @ai-generated
/**
 * The track goes A -> B -> A before A's first timing load settles, so two
 * loads of A are in flight. Whichever settles last must not wipe timings the
 * other already loaded: a failed duplicate (null) keeps the held timings and
 * the store stays 'ready', so follow-along and Play from here keep working.
 */
const mockCalls: {key: string; settle: (value: unknown) => void}[] = [];

jest.mock('@/data/reciterData', () => ({
  RECITERS: jest
    .requireActual('@/services/timestamps/__fixtures__/timingFixtures')
    .fixtureCatalog(),
}));
jest.mock('@/services/timestamps/TimestampService', () => ({
  timestampService: {
    getTimestampsForSurah: jest.fn(
      (set: string, surah: number) =>
        new Promise(resolve => {
          mockCalls.push({key: `${set}-${surah}`, settle: resolve});
        }),
    ),
  },
}));
jest.mock('@/services/timestamps/TimestampFetchService', () => ({
  timestampFetchService: {hasSurah: () => true, hasSource: () => true},
}));

import {
  resolvePlayFromHere,
  selectVerseTrackingUnavailable,
  useTimestampStore,
} from '@/store/timestampStore';
import {loadTimings} from '@/services/timestamps/__fixtures__/timingFixtures';

const store = () => useTimestampStore.getState();

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

/** Starts A, moves to B (which loads), comes back to A: two A loads pending. */
async function twoLoadsOfA(): Promise<{
  first: Promise<void>;
  second: Promise<void>;
}> {
  const first = store().loadTimestampsForSurah('hafs-clean', 2);
  const b = store().loadTimestampsForSurah('hafs-clean', 112);
  mockCalls[1].settle(loadTimings('hafs-clean', 112));
  await b;
  const second = store().loadTimestampsForSurah('hafs-clean', 2);
  expect(mockCalls.map(c => c.key)).toEqual([
    'hafs-clean-2',
    'hafs-clean-112',
    'hafs-clean-2',
  ]);
  return {first, second};
}

function expectTimingsKept(): void {
  const state = store();
  expect(state.timestampLoadStatus).toBe('ready');
  expect(state.currentTimestampKey).toBe('hafs-clean-2');
  expect(state.currentSurahTimestamps?.length).toBeGreaterThan(0);
  expect(selectVerseTrackingUnavailable(state)).toBe(false);
  expect(resolvePlayFromHere('2:5').status).not.toBe('failed');
}

beforeEach(() => {
  mockCalls.length = 0;
  store().clearCurrentTimestamps();
  store().loadFollowAlongRegistry();
});

describe('two loads of the same track in flight', () => {
  it('keeps the timings when the first load succeeds and the second fails', async () => {
    const {first, second} = await twoLoadsOfA();
    mockCalls[0].settle(loadTimings('hafs-clean', 2));
    await first;
    mockCalls[2].settle(null);
    await second;
    await flush();
    expectTimingsKept();
  });

  it('keeps the timings when the second load succeeds and the first fails', async () => {
    const {first, second} = await twoLoadsOfA();
    mockCalls[2].settle(loadTimings('hafs-clean', 2));
    await second;
    mockCalls[0].settle(null);
    await first;
    await flush();
    expectTimingsKept();
  });
});
