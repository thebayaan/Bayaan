// @ai-generated
// Bayaan Now: what fits this moment. The Home tab's top cards read these
// rules. The hours are the widget's (modules/bayaan-widgets contextRules,
// mirrored in Swift and Kotlin) and the Friday window and surah picks are
// CarPlay's "For right now" (services/car/snapshot/situational), so the
// Home screen, the Bayaan Now widget and the car agree on the moment.
// A backend occasion, when one is live, leads all of them.
import {
  ALL_BAYAAN_NOW_CARDS,
  bayaanNowMode,
  type BayaanNowCards,
} from '@/modules/bayaan-widgets/src/contextRules';

export const KAHF = 18;
export const MULK = 67;
export const BEDTIME_SLEEP_MINUTES = 30;

/** Adhkar lists by super category id (services/database/AdhkarDatabaseService). */
export const NOW_ADHKAR = {
  morning: 'morning-adhkar',
  evening: 'evening-adhkar',
  sleep: 'before-sleep',
} as const;

/** System playlists by time of day (data/systemPlaylists). */
export const NOW_PLAYLISTS = {
  morning: 'morning-reflections',
  midday: 'quick-listen',
  evening: 'evening-serenity',
} as const;

/** Why a card is showing now; each has a short label on the card. */
export type NowReason =
  | 'friday'
  | 'morning'
  | 'midday'
  | 'evening'
  | 'bedtime'
  | 'upNext'
  | 'occasion';

interface NowBase {
  /** Stable across renders: what the card plays, not where it sits. */
  id: string;
  reason: NowReason;
}

export type NowMoment =
  | (NowBase & {
      kind: 'surah';
      surahId: number;
      reciterId: string;
      rewayatId: string;
    })
  | (NowBase & {
      kind: 'bedtime';
      surahId: number;
      reciterId: string;
      rewayatId: string;
      sleepMinutes: number;
    })
  | (NowBase & {kind: 'adhkar'; superId: string})
  | (NowBase & {kind: 'playlist'; playlistId: string});

export interface NowReciter {
  reciterId: string;
  rewayatId: string;
  /** Surahs this reciter has in that rewayah. */
  surahIds: number[];
}

export interface NowLastPlayed extends NowReciter {
  surahId: number;
  /** Listened to the end (95% or more). */
  completed: boolean;
}

export interface NowInput {
  now: Date;
  /** The reciter of the last thing played, else the default reciter. */
  topReciter: NowReciter | null;
  lastPlayed: NowLastPlayed | null;
  /** System playlists that can play right now. */
  playlistIds: readonly string[];
  cards?: Readonly<BayaanNowCards>;
  /** Set by the backend for a key date; leads every other card. */
  occasion?: NowMoment | null;
}

/** Thursday 6 PM to Friday 7 PM, as in CarPlay. */
export function isFridayWindow(now: Date): boolean {
  const day = now.getDay();
  const hour = now.getHours();
  if (day === 4) return hour >= 18;
  if (day === 5) return hour < 19;
  return false;
}

function surah(
  reciter: NowReciter | null,
  surahId: number,
  reason: NowReason,
): NowMoment | null {
  if (!reciter || !reciter.surahIds.includes(surahId)) return null;
  return {
    id: `surah:${surahId}`,
    kind: 'surah',
    surahId,
    reciterId: reciter.reciterId,
    rewayatId: reciter.rewayatId,
    reason,
  };
}

function bedtime(reciter: NowReciter | null): NowMoment | null {
  if (!reciter || !reciter.surahIds.includes(MULK)) return null;
  return {
    id: `bedtime:${MULK}`,
    kind: 'bedtime',
    surahId: MULK,
    reciterId: reciter.reciterId,
    rewayatId: reciter.rewayatId,
    sleepMinutes: BEDTIME_SLEEP_MINUTES,
    reason: 'bedtime',
  };
}

function adhkar(superId: string, reason: NowReason): NowMoment {
  return {id: `adhkar:${superId}`, kind: 'adhkar', superId, reason};
}

function playlist(
  playlistId: string,
  reason: NowReason,
  available: readonly string[],
): NowMoment | null {
  if (!available.includes(playlistId)) return null;
  return {id: `playlist:${playlistId}`, kind: 'playlist', playlistId, reason};
}

/** The surah after a finished one, in the same reciter's rewayah. */
function upNext(last: NowLastPlayed | null): NowMoment | null {
  if (!last || !last.completed) return null;
  const next = [...last.surahIds]
    .sort((a, b) => a - b)
    .find(id => id > last.surahId);
  if (next === undefined) return null;
  return {
    id: `surah:${next}`,
    kind: 'surah',
    surahId: next,
    reciterId: last.reciterId,
    rewayatId: last.rewayatId,
    reason: 'upNext',
  };
}

/**
 * The cards for this moment, most fitting first: the first is the large
 * card, the second the smaller one under it. Never more than two.
 */
export function bayaanNowMoments(input: NowInput): NowMoment[] {
  const {now, topReciter, lastPlayed, playlistIds} = input;
  const cards = input.cards ?? ALL_BAYAAN_NOW_CARDS;
  const hour = now.getHours();
  const candidates: (NowMoment | null | undefined)[] = [input.occasion];

  if (isFridayWindow(now)) {
    candidates.push(surah(topReciter, KAHF, 'friday'));
  }

  // The widget's modes. Home never switches to "now playing": the mini
  // player already shows it.
  switch (bayaanNowMode(hour, false, cards)) {
    case 'morningAdhkar':
      candidates.push(
        adhkar(NOW_ADHKAR.morning, 'morning'),
        playlist(NOW_PLAYLISTS.morning, 'morning', playlistIds),
      );
      break;
    case 'eveningAdhkar':
      candidates.push(
        adhkar(NOW_ADHKAR.evening, 'evening'),
        playlist(NOW_PLAYLISTS.evening, 'evening', playlistIds),
      );
      break;
    case 'bedtime':
      candidates.push(
        bedtime(topReciter),
        cards.adhkar ? adhkar(NOW_ADHKAR.sleep, 'bedtime') : null,
      );
      break;
    case 'listening': {
      const reason: NowReason = hour < 15 && hour >= 4 ? 'midday' : 'evening';
      candidates.push(
        upNext(lastPlayed),
        playlist(
          reason === 'midday' ? NOW_PLAYLISTS.midday : NOW_PLAYLISTS.evening,
          reason,
          playlistIds,
        ),
      );
      break;
    }
  }
  // Whatever the hour, something to play: the hour's playlist, then the
  // midday one.
  candidates.push(playlist(NOW_PLAYLISTS.midday, 'midday', playlistIds));

  const seen = new Set<string>();
  const moments: NowMoment[] = [];
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    moments.push(candidate);
    if (moments.length === 2) break;
  }
  return moments;
}

/** When the moment can next change: the next hour boundary the rules use. */
export function nextMomentChange(now: Date): Date {
  const BOUNDARIES = [4, 11, 15, 18, 19, 20, 21];
  const hour = now.getHours();
  const next = BOUNDARIES.find(h => h > hour);
  const at = new Date(now);
  at.setMinutes(0, 0, 0);
  if (next === undefined) {
    at.setDate(at.getDate() + 1);
    at.setHours(BOUNDARIES[0]);
  } else {
    at.setHours(next);
  }
  return at;
}
