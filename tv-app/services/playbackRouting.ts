/**
 * The one way to start a surah. Every "play" in the app (Home, Surahs,
 * Reciters, a reciter's page, Search, the Library, menus, the sidebar tile)
 * goes through playOrOpen, so a press behaves the same everywhere:
 *
 * - The track already playing (or loading) is never reloaded; the press just
 *   opens the player.
 * - Otherwise the player opens at once in its loading state, and the
 *   recitation is looked up and loaded behind it. A newer press supersedes an
 *   older one that is still loading, so stale loads never win.
 * - There is only ever one player in the stack (see navStore.push).
 * - When nothing can be played, the player says why (with Try again).
 */

import {SURAHS} from '../../data/surahData';
import fallbackReciters from '../../data/reciters-fallback.json';
import {useNavStore} from '../store/navStore';
import {useTVPlayerStore} from '../store/tvPlayerStore';
import type {QueueItem} from '../types/player';
import type {Reciter, Rewayah} from '../types/reciter';
import {pickPlayableRewayah} from './browseCatalog';
import {normalizeReciters} from './normalizeReciter';
import {removeContinue} from './continueListeningStore';
import {recordVisit} from './recentlyPlayedStore';
import {
  buildAudioUrl,
  fetchRewayat,
  getCachedReciters,
  getCachedRewayat,
} from './tvDataService';

export type PlayItemInput = {
  reciterId: string;
  rewayahId?: string;
  surahNumber: number;
};

export type PlayRequest = PlayItemInput & {
  /** Where to start, for resuming (Continue listening). */
  startSeconds?: number;
  /**
   * The queue to play, which must include the requested item (a playlist,
   * loved surahs). Without it the queue is the rewayah's surahs, starting at
   * the requested one.
   */
  queue?: PlayItemInput[];
  /** Next/previous pick at random; the requested surah plays first. */
  shuffle?: boolean;
  /** Where the press came from, for debugging. */
  source?: string;
};

export const OFFLINE_MESSAGE =
  "Couldn't reach the recitation. Check your connection and try again.";

const surahNames = new Map<number, string>(SURAHS.map(s => [s.id, s.name]));

export function surahTitle(surahNumber: number): string {
  return surahNames.get(surahNumber) ?? `Surah ${surahNumber}`;
}

let fallbackCatalog: Reciter[] | null = null;

/** A reciter from the catalog or the bundled list, or null when gone. */
export function findReciter(reciterId: string): Reciter | null {
  const cached = getCachedReciters()?.find(r => r.id === reciterId);
  if (cached) return cached;
  fallbackCatalog ??= normalizeReciters(fallbackReciters);
  return fallbackCatalog.find(r => r.id === reciterId) ?? null;
}

async function rewayatOf(reciterId: string): Promise<Rewayah[]> {
  const cached = getCachedRewayat(reciterId);
  if (cached && cached.length > 0) return cached;
  return fetchRewayat(reciterId).catch(() => []);
}

/** The rewayah to play a surah in: the asked-for one when it has it. */
export function chooseRewayah(
  rewayat: readonly Rewayah[],
  surahNumber: number,
  rewayahId?: string,
): Rewayah | null {
  const asked = rewayahId
    ? rewayat.find(
        r => r.id === rewayahId && r.surah_list.includes(surahNumber),
      )
    : undefined;
  if (asked) return asked;
  const picked = pickPlayableRewayah(rewayat, surahNumber);
  return picked && picked.surah_list.includes(surahNumber) ? picked : null;
}

export function queueItem(
  reciter: Pick<Reciter, 'id' | 'name'>,
  rewayah: Rewayah,
  surahNumber: number,
): QueueItem {
  return {
    reciterId: reciter.id,
    rewayahId: rewayah.id,
    surahNumber,
    audioUrl: buildAudioUrl(rewayah.server, surahNumber),
    title: surahTitle(surahNumber),
    subtitle: reciter.name,
  };
}

/** Every surah of a rewayah, in order. */
export function rewayahQueue(
  reciter: Pick<Reciter, 'id' | 'name'>,
  rewayah: Rewayah,
): QueueItem[] {
  return rewayah.surah_list
    .filter(n => Number.isFinite(n) && n > 0)
    .map(n => queueItem(reciter, rewayah, n));
}

/** A shuffled copy with `first` (when given) moved to the front. */
export function shuffled<T>(items: readonly T[], first?: number): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  if (first !== undefined && first >= 0 && first < items.length) {
    const at = copy.indexOf(items[first]);
    if (at > 0) copy.unshift(...copy.splice(at, 1));
  }
  return copy;
}

/** A random surah of a list, for "Shuffle play" (the first one it plays). */
export function randomSurah(surahList: readonly number[]): number | undefined {
  const playable = surahList.filter(n => n > 0);
  if (playable.length === 0) return undefined;
  return playable[Math.floor(Math.random() * playable.length)];
}

/**
 * Who plays a surah picked without a reciter (Surahs grid, Library first
 * run): the first candidate whose known recitations include it, chosen
 * without waiting on the network so the player can open at once. The first
 * candidate is used when nothing about it is known yet (playOrOpen fetches
 * and reports a failure). Null when nobody has the surah.
 */
export function voiceForSurah(
  candidates: readonly Reciter[],
  surahNumber: number,
): PlayItemInput | null {
  for (const [i, candidate] of candidates.entries()) {
    const known = getCachedRewayat(candidate.id) ?? candidate.rewayat ?? [];
    if (known.length === 0) {
      if (i === 0) return {reciterId: candidate.id, surahNumber};
      continue;
    }
    const rewayah = chooseRewayah(known, surahNumber);
    if (rewayah) {
      return {reciterId: candidate.id, rewayahId: rewayah.id, surahNumber};
    }
  }
  return null;
}

function matches(item: PlayItemInput, other: PlayItemInput): boolean {
  return (
    item.reciterId === other.reciterId &&
    item.surahNumber === other.surahNumber &&
    (!other.rewayahId || !item.rewayahId || item.rewayahId === other.rewayahId)
  );
}

/** Whether the player's current track is this one (playing, paused or loading). */
export function isCurrentTrack(req: PlayItemInput): boolean {
  const {queue, currentIndex} = useTVPlayerStore.getState();
  const current = queue[currentIndex];
  return current !== undefined && matches(current, req);
}

/** Opens the player: pushed, or popped back to if it is already in the stack. */
export function openPlayer(): void {
  useNavStore.getState().push({screen: 'nowPlaying'});
}

let latestRequest = 0;

/**
 * Plays a surah, or just opens the player when it is the current track.
 * Resolves true once the track is playing (or already was), false when the
 * request failed or a newer one replaced it.
 */
export async function playOrOpen(req: PlayRequest): Promise<boolean> {
  const player = useTVPlayerStore.getState();
  if (isCurrentTrack(req)) {
    openPlayer();
    // A finished or failed track starts again; anything else is left as is.
    if (player.finished || player.status === 'error') player.toggle();
    return true;
  }
  return start(req);
}

async function start(req: PlayRequest): Promise<boolean> {
  const player = useTVPlayerStore.getState();
  const request = ++latestRequest;
  const reciter = findReciter(req.reciterId);
  // The player opens right away with the track's name while it loads.
  const placeholder: QueueItem = {
    reciterId: req.reciterId,
    rewayahId: req.rewayahId,
    surahNumber: req.surahNumber,
    audioUrl: '',
    title: surahTitle(req.surahNumber),
    subtitle: reciter?.name ?? '',
  };
  const token = player.beginPending(placeholder, () => {
    void start(req);
  });
  openPlayer();

  const fail = (message: string): false => {
    if (request === latestRequest) {
      useTVPlayerStore.getState().failPending(token, message);
    }
    return false;
  };

  if (!reciter) {
    // Its Continue entry can never resume again.
    removeContinue(req.reciterId, req.surahNumber);
    return fail('This reciter is no longer available.');
  }
  const built = await buildQueue(req, reciter);
  if (request !== latestRequest) return false;
  if (!built) {
    const rewayat = getCachedRewayat(reciter.id);
    return fail(
      rewayat && rewayat.length > 0
        ? `${reciter.name} has no recording of ${surahTitle(req.surahNumber)}.`
        : OFFLINE_MESSAGE,
    );
  }

  recordVisit(reciter.id);
  const {queue, startIndex} = built;
  // A saved position belongs to its recitation: another one starts afresh.
  const startSeconds =
    req.rewayahId && queue[startIndex].rewayahId !== req.rewayahId
      ? undefined
      : req.startSeconds;
  const order = req.shuffle ? shuffled(queue, startIndex) : queue;
  await useTVPlayerStore
    .getState()
    .loadQueue(order, req.shuffle ? 0 : startIndex, {
      shuffle: req.shuffle ?? false,
      startSeconds,
    });
  if (request !== latestRequest) return false;
  return useTVPlayerStore.getState().status !== 'error';
}

async function buildQueue(
  req: PlayRequest,
  reciter: Reciter,
): Promise<{queue: QueueItem[]; startIndex: number} | null> {
  if (!req.queue || req.queue.length === 0) {
    const rewayah = chooseRewayah(
      await rewayatOf(reciter.id),
      req.surahNumber,
      req.rewayahId,
    );
    if (!rewayah) return null;
    const queue = rewayahQueue(reciter, rewayah);
    const startIndex = queue.findIndex(q => q.surahNumber === req.surahNumber);
    return startIndex >= 0 ? {queue, startIndex} : null;
  }

  // A mixed queue (a playlist): each item in its own reciter's recitation.
  // Items that can't be found are left out; the requested one must play.
  const rewayatByReciter = new Map<string, Promise<Rewayah[]>>();
  const lookup = (id: string): Promise<Rewayah[]> => {
    let pending = rewayatByReciter.get(id);
    if (!pending) {
      pending = rewayatOf(id);
      rewayatByReciter.set(id, pending);
    }
    return pending;
  };
  const resolved = await Promise.all(
    req.queue.map(async (input): Promise<QueueItem | null> => {
      const who =
        input.reciterId === reciter.id ? reciter : findReciter(input.reciterId);
      if (!who) return null;
      const rewayah = chooseRewayah(
        await lookup(who.id),
        input.surahNumber,
        input.rewayahId,
      );
      return rewayah ? queueItem(who, rewayah, input.surahNumber) : null;
    }),
  );
  const queue = resolved.filter((q): q is QueueItem => q !== null);
  const exact = queue.findIndex(q => matches(q, req));
  const startIndex =
    exact >= 0
      ? exact
      : queue.findIndex(
          q =>
            q.reciterId === req.reciterId && q.surahNumber === req.surahNumber,
        );
  return startIndex >= 0 ? {queue, startIndex} : null;
}
