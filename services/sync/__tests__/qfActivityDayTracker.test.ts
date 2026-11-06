jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: () => undefined,
    set: () => undefined,
    remove: () => undefined,
  }),
}));
jest.mock('expo-crypto', () => ({randomUUID: () => 'uuid'}));
jest.mock('@/services/auth/bayaanSessionStorage', () => ({
  getBayaanSession: async () => null,
}));
jest.mock('@/services/mushaf/MushafVerseMapService', () => ({
  mushafVerseMapService: {getOrderedVerseKeysForPage: () => []},
}));
jest.mock('@/store/qfSyncStore', () => ({
  useQfSyncStore: {getState: () => ({activeAccountId: null})},
}));

import {BayaanSettingsApiError} from '@/services/settings/bayaanSettingsApiClient';
import {parseBatches} from '../qfActivityDays';
import {
  createQfActivityDayTracker,
  FLUSH_INTERVAL_MS,
  MAX_SEND_ATTEMPTS,
  type QfActivityDayTrackerDeps,
} from '../qfActivityDayTracker';

const PAGE_VERSES: Record<number, string[]> = {
  1: ['1:1', '1:2', '1:3', '1:4', '1:5', '1:6', '1:7'],
  2: ['2:1', '2:2', '2:3', '2:4', '2:5'],
  3: ['2:6', '2:7', '2:8'],
};

function setup(
  options: {
    post?: QfActivityDayTrackerDeps['api']['postActivityDay'];
    accountId?: string | null;
    start?: number;
  } = {},
) {
  const stored = new Map<string, string>();
  let clock = options.start ?? Date.parse('2026-10-12T16:00:00Z');
  let id = 0;
  let accountId = options.accountId === undefined ? 'acct' : options.accountId;
  const posted: Parameters<
    QfActivityDayTrackerDeps['api']['postActivityDay']
  >[1][] = [];
  const post = jest.fn<
    ReturnType<QfActivityDayTrackerDeps['api']['postActivityDay']>,
    Parameters<QfActivityDayTrackerDeps['api']['postActivityDay']>
  >(
    options.post ??
      (async (_token, input) => {
        posted.push(input);
      }),
  );
  const tracker = createQfActivityDayTracker({
    storage: {
      getString: key => stored.get(key),
      set: (key, value) => stored.set(key, value),
      remove: key => {
        stored.delete(key);
      },
    },
    api: {postActivityDay: post},
    getSession: async () =>
      accountId
        ? {
            token: 'session-token',
            expiresAt: clock + 3_600_000,
            profile: {accountId},
          }
        : null,
    getActiveAccountId: () => accountId,
    getVerseKeysForPage: page => PAGE_VERSES[page] ?? [],
    getTimezone: () => 'America/Los_Angeles',
    newId: () => `batch-${++id}`,
    now: () => clock,
  });
  return {
    tracker,
    post,
    posted,
    queued: (account = 'acct') =>
      parseBatches(stored.get(`batches:${account}`)),
    advance(ms: number) {
      clock += ms;
      jest.advanceTimersByTime(ms);
    },
    setAccount(next: string | null) {
      accountId = next;
    },
  };
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('qfActivityDayTracker', () => {
  it('credits a page read for long enough with its verses and seconds', async () => {
    const {tracker, posted, advance} = setup();
    tracker.showPages([1]);
    advance(12_400);
    tracker.showPages([2]);
    advance(1_000);
    tracker.stop();
    await tracker.flush();
    expect(posted).toEqual([
      {
        idempotencyKey: 'batch-1',
        timezone: 'America/Los_Angeles',
        seconds: 12,
        ranges: ['1:1-1:7'],
      },
    ]);
  });

  it('dates only reading first sent on a later day', async () => {
    let fail = true;
    const sent: {id: string; date?: string; seconds: number}[] = [];
    const {tracker, advance} = setup({
      post: async (_token, input) => {
        sent.push({
          id: input.idempotencyKey,
          date: input.date,
          seconds: input.seconds,
        });
        if (fail) throw new BayaanSettingsApiError(503, 'unavailable');
      },
    });
    tracker.showPages([1]);
    advance(10_000);
    tracker.stop();
    await tracker.flush();
    // Today's reading goes undated, so QF counts it as tracked reading.
    expect(sent).toEqual([{id: 'batch-1', date: undefined, seconds: 10}]);

    // More reading today, held back while the failed send backs off.
    tracker.showPages([2]);
    advance(5_000);
    tracker.stop();
    await tracker.flush();
    expect(sent).toHaveLength(1);

    fail = false;
    advance(24 * 60 * 60_000);
    await tracker.flush();
    // The retry resends its first body; the batch first sent the next day
    // keeps the day it was read.
    expect(sent.slice(1)).toEqual([
      {id: 'batch-1', date: undefined, seconds: 10},
      {id: 'batch-2', date: '2026-10-12', seconds: 5},
    ]);
  });

  it('merges several pages into one batch', async () => {
    const {tracker, posted, advance} = setup();
    tracker.showPages([2]);
    advance(5_000);
    tracker.showPages([3]);
    advance(6_000);
    tracker.stop();
    await tracker.flush();
    expect(posted).toEqual([
      expect.objectContaining({seconds: 11, ranges: ['2:1-2:8']}),
    ]);
  });

  it('credits both pages of a facing-pages spread', async () => {
    const {tracker, posted, advance} = setup();
    tracker.showPages([2, 3]);
    advance(4_000);
    tracker.stop();
    await tracker.flush();
    expect(posted[0].ranges).toEqual(['2:1-2:8']);
  });

  it('does not count time in the background', async () => {
    const {tracker, posted, advance} = setup();
    tracker.showPages([1]);
    advance(5_000);
    tracker.setAppActive(false);
    advance(600_000);
    tracker.setAppActive(true);
    advance(5_000);
    tracker.stop();
    await tracker.flush();
    expect(posted.reduce((sum, sent) => sum + sent.seconds, 0)).toBe(10);
  });

  it('stops counting a page left open past ten minutes', async () => {
    const {tracker, posted, advance} = setup();
    tracker.showPages([1]);
    advance(30 * 60_000);
    tracker.stop();
    await tracker.flush();
    expect(posted.reduce((sum, sent) => sum + sent.seconds, 0)).toBe(600);
  });

  it('sends every 30 seconds while a page stays open', async () => {
    const {tracker, post, advance} = setup();
    tracker.showPages([1]);
    advance(FLUSH_INTERVAL_MS);
    await Promise.resolve();
    await tracker.flush();
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][1].seconds).toBe(30);
  });

  it('records nothing when signed out', async () => {
    const {tracker, post, advance} = setup({accountId: null});
    tracker.showPages([1]);
    advance(20_000);
    tracker.stop();
    await tracker.flush();
    expect(post).not.toHaveBeenCalled();
  });

  it('keeps a batch and its key after a server error, then retries it', async () => {
    let fail = true;
    const sent: string[] = [];
    const {tracker, queued, advance} = setup({
      post: async (_token, input) => {
        sent.push(input.idempotencyKey);
        if (fail) throw new BayaanSettingsApiError(503, 'unavailable');
      },
    });
    tracker.showPages([1]);
    advance(10_000);
    tracker.stop();
    await tracker.flush();
    expect(queued()).toEqual([
      expect.objectContaining({id: 'batch-1', sealed: {}, attempts: 1}),
    ]);

    // Reading after a failed send goes to a new batch, not the retried one.
    tracker.showPages([2]);
    advance(10_000);
    tracker.stop();
    expect(queued().map(batch => batch.id)).toEqual(['batch-1', 'batch-2']);

    fail = false;
    advance(5 * 60_000);
    await tracker.flush();
    expect(sent).toEqual(['batch-1', 'batch-1', 'batch-2']);
    expect(queued()).toEqual([]);
  });

  it('drops a batch the server rejects', async () => {
    const {tracker, queued, advance} = setup({
      post: async () => {
        throw new BayaanSettingsApiError(400, 'QF_SETTINGS_REJECTED');
      },
    });
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    tracker.showPages([1]);
    advance(10_000);
    tracker.stop();
    await tracker.flush();
    expect(queued()).toEqual([]);
    warn.mockRestore();
  });

  it('stops sending, but keeps reading, when activity days are not enabled', async () => {
    const {tracker, post, queued, advance} = setup({
      post: async () => {
        throw new BayaanSettingsApiError(403, 'QF_SETTINGS_FORBIDDEN');
      },
    });
    tracker.showPages([1]);
    advance(10_000);
    tracker.stop();
    await tracker.flush();
    tracker.showPages([2]);
    advance(10_000);
    tracker.stop();
    await tracker.flush();
    expect(post).toHaveBeenCalledTimes(1);
    expect(queued()).toHaveLength(2);
  });

  it('forgets an account on sign-out', async () => {
    const {tracker, post, queued, advance, setAccount} = setup({
      post: async () => {
        throw new BayaanSettingsApiError(503, 'unavailable');
      },
    });
    tracker.showPages([1]);
    advance(10_000);
    tracker.stop();
    await tracker.flush();
    tracker.clearAccount('acct');
    setAccount(null);
    expect(queued()).toEqual([]);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('retries a batch with the same body after midnight', async () => {
    let fail = true;
    const sent: Parameters<
      QfActivityDayTrackerDeps['api']['postActivityDay']
    >[1][] = [];
    const {tracker, advance} = setup({
      // 23:58 in Los Angeles.
      start: Date.parse('2026-10-13T06:58:00Z'),
      post: async (_token, input) => {
        sent.push(input);
        if (fail) throw new BayaanSettingsApiError(503, 'unavailable');
      },
    });
    tracker.showPages([1]);
    advance(10_000);
    tracker.stop();
    await tracker.flush();

    fail = false;
    advance(10 * 60_000);
    await tracker.flush();
    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual(sent[0]);
    expect(sent[0].date).toBeUndefined();
  });

  it('drops a batch QF answers with a conflict', async () => {
    const {tracker, queued, advance} = setup({
      post: async () => {
        throw new BayaanSettingsApiError(409, 'QF_SETTINGS_CONFLICT');
      },
    });
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    tracker.showPages([1]);
    advance(10_000);
    tracker.stop();
    await tracker.flush();
    expect(queued()).toEqual([]);
    warn.mockRestore();
  });

  it('gives up on a batch that keeps failing so later batches can go', async () => {
    const {tracker, post, queued, advance} = setup({
      post: async () => {
        throw new BayaanSettingsApiError(503, 'unavailable');
      },
    });
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    tracker.showPages([1]);
    advance(10_000);
    tracker.stop();
    for (let attempt = 0; attempt < MAX_SEND_ATTEMPTS; attempt++) {
      await tracker.flush();
      advance(20 * 60_000);
    }
    expect(post).toHaveBeenCalledTimes(MAX_SEND_ATTEMPTS);
    expect(queued()).toEqual([]);
    warn.mockRestore();
  });

  it('does not count time while another screen covers the reader', async () => {
    const {tracker, posted, advance} = setup();
    tracker.showPages([1]);
    advance(5_000);
    tracker.setReaderFocused(false);
    advance(300_000);
    tracker.setReaderFocused(true);
    advance(5_000);
    tracker.stop();
    await tracker.flush();
    expect(posted.reduce((sum, sent) => sum + sent.seconds, 0)).toBe(10);
  });

  it('keeps timing when the same pages are reported again', async () => {
    const {tracker, posted, advance} = setup();
    tracker.showPages([1]);
    advance(2_000);
    tracker.showPages([1]);
    advance(2_000);
    tracker.stop();
    await tracker.flush();
    expect(posted).toEqual([expect.objectContaining({seconds: 4})]);
  });

  it('keeps time read while page data was still loading', async () => {
    let loaded = false;
    const {tracker, posted, advance} = setup();
    const verses = PAGE_VERSES[1];
    PAGE_VERSES[1] = [];
    try {
      tracker.showPages([1]);
      advance(FLUSH_INTERVAL_MS);
      PAGE_VERSES[1] = verses;
      loaded = true;
      advance(5_000);
      tracker.stop();
      await tracker.flush();
    } finally {
      if (!loaded) PAGE_VERSES[1] = verses;
    }
    expect(posted.reduce((sum, sent) => sum + sent.seconds, 0)).toBe(35);
  });

  it('does not carry a retry delay over to the next account', async () => {
    let fail = true;
    const {tracker, post, advance, setAccount} = setup({
      post: async () => {
        if (fail) throw new BayaanSettingsApiError(503, 'unavailable');
      },
    });
    tracker.showPages([1]);
    advance(10_000);
    tracker.stop();
    await tracker.flush();
    tracker.clearAccount('acct');

    fail = false;
    setAccount('other');
    tracker.showPages([1]);
    advance(10_000);
    tracker.stop();
    await tracker.flush();
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('keeps reading queued however long the device is offline', async () => {
    const {tracker, post, queued, advance} = setup({
      post: async () => {
        throw new BayaanSettingsApiError(0, 'network_error');
      },
    });
    tracker.showPages([1]);
    advance(10_000);
    tracker.stop();
    for (let attempt = 0; attempt < MAX_SEND_ATTEMPTS + 4; attempt++) {
      await tracker.flush();
      advance(20 * 60_000);
    }
    expect(post).toHaveBeenCalledTimes(MAX_SEND_ATTEMPTS + 4);
    expect(queued()).toEqual([
      expect.objectContaining({id: 'batch-1', attempts: 0}),
    ]);
  });
});
