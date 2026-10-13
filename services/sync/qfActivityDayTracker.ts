import * as Crypto from 'expo-crypto';
import {createMMKV} from 'react-native-mmkv';
import {bayaanAuthConfig} from '@/config/bayaanAuth';
import {getBayaanSession} from '@/services/auth/bayaanSessionStorage';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
import {
  BayaanSettingsApiClient,
  BayaanSettingsApiError,
} from '@/services/settings/bayaanSettingsApiClient';
import {useQfSyncStore} from '@/store/qfSyncStore';
import type {BayaanOpaqueSession} from '@/types/bayaan-auth';
import {
  addReading,
  isExpiredBatch,
  localDateOf,
  parseBatches,
  type QfActivityBatch,
} from './qfActivityDays';

/** A page counts as read once it has been on screen this long. */
export const MIN_PAGE_MS = 3_000;
/** Time on one page past this is idle, not reading. */
export const MAX_PAGE_MS = 10 * 60_000;
export const FLUSH_INTERVAL_MS = 30_000;
const MAX_BACKOFF_MS = 15 * 60_000;

export interface QfActivityStorage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export interface QfActivityDayTrackerDeps {
  storage: QfActivityStorage;
  api: {
    postActivityDay(
      sessionToken: string,
      input: {
        idempotencyKey: string;
        date?: string;
        timezone: string;
        seconds: number;
        ranges: string[];
      },
    ): Promise<void>;
  };
  getSession: () => Promise<BayaanOpaqueSession | null>;
  getActiveAccountId: () => string | null;
  getVerseKeysForPage: (page: number) => string[];
  getTimezone: () => string;
  newId: () => string;
  now: () => number;
}

export interface QfActivityDayTracker {
  /** The pages now on screen (two in facing-pages mode). */
  showPages(pages: readonly number[]): void;
  setAppActive(active: boolean): void;
  /** The reader closed: credit the open page and send what is queued. */
  stop(): void;
  flush(): Promise<void>;
  /** Sign-out: forget this account's unsent reading. */
  clearAccount(accountId: string): void;
}

interface OpenPage {
  accountId: string;
  pages: readonly number[];
  activeSince: number | null;
  activeMs: number;
  creditedMs: number;
}

function storageKey(accountId: string): string {
  return `batches:${accountId}`;
}

/** Statuses QF or the BFF will refuse again for the same batch. */
function isRejected(error: BayaanSettingsApiError): boolean {
  return [400, 404, 413, 422].includes(error.status);
}

function isUnavailable(error: BayaanSettingsApiError): boolean {
  return error.status === 403 || error.code === 'QF_SETTINGS_DISABLED';
}

/**
 * Credits mushaf reading to the signed-in user's QF activity days, which
 * drive Quran.com streaks. Time a page is on screen while the app is active
 * is queued per account as dated batches of seconds and verse ranges, then
 * sent every 30 seconds, when the app leaves the foreground and when the
 * reader closes. Batches survive restarts and are retried with their key.
 */
export function createQfActivityDayTracker(
  deps: QfActivityDayTrackerDeps,
): QfActivityDayTracker {
  let open: OpenPage | null = null;
  let appActive = true;
  let timer: ReturnType<typeof setInterval> | null = null;
  let inFlight: Promise<void> | null = null;
  let flushAgain = false;
  let failures = 0;
  let nextAttemptAt = 0;
  const unavailable = new Set<string>();

  function readBatches(accountId: string): QfActivityBatch[] {
    return parseBatches(deps.storage.getString(storageKey(accountId)));
  }

  function writeBatches(accountId: string, batches: QfActivityBatch[]): void {
    if (batches.length === 0) deps.storage.remove(storageKey(accountId));
    else deps.storage.set(storageKey(accountId), JSON.stringify(batches));
  }

  function verseKeysFor(pages: readonly number[]): string[] {
    const keys: string[] = [];
    for (const page of pages) {
      try {
        keys.push(...deps.getVerseKeysForPage(page));
      } catch {
        // Mushaf data that is still loading leaves this page uncredited.
      }
    }
    return keys;
  }

  function accrue(now: number): void {
    if (!open || open.activeSince === null) return;
    open.activeMs = Math.min(
      MAX_PAGE_MS,
      open.activeMs + Math.max(0, now - open.activeSince),
    );
    open.activeSince = appActive ? now : null;
  }

  /** Moves the open page's uncredited reading into its account's queue. */
  function checkpoint(): void {
    if (!open) return;
    const now = deps.now();
    accrue(now);
    if (open.activeMs < MIN_PAGE_MS) return;
    const seconds =
      Math.floor(open.activeMs / 1000) - Math.floor(open.creditedMs / 1000);
    open.creditedMs = open.activeMs;
    if (seconds < 1) return;
    const verseKeys = verseKeysFor(open.pages);
    if (verseKeys.length === 0) return;
    writeBatches(
      open.accountId,
      addReading(readBatches(open.accountId), {
        date: localDateOf(now),
        timezone: deps.getTimezone(),
        seconds,
        verseKeys,
        newId: deps.newId,
      }),
    );
  }

  function stopTimer(): void {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
  }

  function startTimer(): void {
    if (timer !== null) return;
    timer = setInterval(() => {
      checkpoint();
      flush().catch(() => undefined);
    }, FLUSH_INTERVAL_MS);
  }

  async function sendQueued(accountId: string): Promise<void> {
    const now = deps.now();
    if (unavailable.has(accountId) || now < nextAttemptAt) return;
    // Seal before the first await: reading recorded while this send is in
    // flight must start a new batch, never change one that is being sent.
    const live = readBatches(accountId)
      .filter(batch => !isExpiredBatch(batch, now))
      .map(batch => ({...batch, sealed: true}));
    writeBatches(accountId, live);
    if (live.length === 0) return;
    const session = await deps.getSession();
    if (!session || session.profile.accountId !== accountId) return;

    for (const batch of live) {
      try {
        await deps.api.postActivityDay(session.token, {
          idempotencyKey: batch.id,
          // QF counts dated seconds as manually added time, so today's
          // reading goes undated and QF dates it by the timezone; only a
          // batch left from an earlier day keeps its date.
          ...(batch.date === localDateOf(deps.now()) ? {} : {date: batch.date}),
          timezone: batch.timezone,
          seconds: batch.seconds,
          ranges: batch.ranges,
        });
      } catch (error) {
        if (!(error instanceof BayaanSettingsApiError)) throw error;
        if (isUnavailable(error)) {
          // The client or this grant lacks activity days; try again after
          // the next sign-in or launch. Expiry bounds what stays queued.
          unavailable.add(accountId);
          return;
        }
        if (!isRejected(error)) {
          failures += 1;
          nextAttemptAt =
            deps.now() +
            Math.max(
              error.retryAfterMs ?? 0,
              Math.min(MAX_BACKOFF_MS, FLUSH_INTERVAL_MS * 2 ** failures),
            );
          return;
        }
        console.warn('[QfActivityDays] A reading batch was rejected');
      }
      failures = 0;
      nextAttemptAt = 0;
      writeBatches(
        accountId,
        readBatches(accountId).filter(queued => queued.id !== batch.id),
      );
    }
  }

  function flush(): Promise<void> {
    if (inFlight) {
      // Reading queued during a send goes out right after it.
      flushAgain = true;
      return inFlight;
    }
    inFlight = (async () => {
      do {
        flushAgain = false;
        const accountId = deps.getActiveAccountId();
        if (!accountId) return;
        try {
          await sendQueued(accountId);
        } catch (error) {
          console.warn('[QfActivityDays] Sending reading failed:', error);
          return;
        }
      } while (flushAgain);
    })().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  return {
    showPages(pages) {
      checkpoint();
      const accountId = deps.getActiveAccountId();
      if (!accountId || pages.length === 0) {
        open = null;
        stopTimer();
        return;
      }
      open = {
        accountId,
        pages: [...pages],
        activeSince: appActive ? deps.now() : null,
        activeMs: 0,
        creditedMs: 0,
      };
      if (appActive) startTimer();
    },

    setAppActive(active) {
      if (active === appActive) return;
      if (!active) {
        checkpoint();
        appActive = false;
        if (open) open.activeSince = null;
        stopTimer();
        flush().catch(() => undefined);
        return;
      }
      appActive = true;
      if (!open) return;
      open.activeSince = deps.now();
      startTimer();
    },

    stop() {
      checkpoint();
      open = null;
      stopTimer();
      flush().catch(() => undefined);
    },

    flush,

    clearAccount(accountId) {
      if (open?.accountId === accountId) {
        open = null;
        stopTimer();
      }
      unavailable.delete(accountId);
      deps.storage.remove(storageKey(accountId));
    },
  };
}

function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

const mmkv = createMMKV({id: 'qf-activity-days'});
const api = new BayaanSettingsApiClient(bayaanAuthConfig.apiUrl);

export const qfActivityDayTracker = createQfActivityDayTracker({
  storage: {
    getString: key => mmkv.getString(key),
    set: (key, value) => mmkv.set(key, value),
    remove: key => {
      mmkv.remove(key);
    },
  },
  api,
  getSession: getBayaanSession,
  getActiveAccountId: () =>
    bayaanAuthConfig.qfSyncEnabled
      ? useQfSyncStore.getState().activeAccountId
      : null,
  getVerseKeysForPage: page =>
    mushafVerseMapService.getOrderedVerseKeysForPage(page),
  getTimezone: deviceTimezone,
  newId: () => Crypto.randomUUID(),
  now: Date.now,
});
