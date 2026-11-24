// @ai-generated
// Bayaan Now: what fits this moment. The Home tab's top cards read these
// rules. The hours are the widget's (modules/bayaan-widgets contextRules,
// mirrored in Swift and Kotlin) and the Friday window and surah picks are
// CarPlay's "For right now" (services/car/snapshot/situational), so the
// Home screen, the Bayaan Now widget and the car agree on the moment.
// A backend occasion, when one is live, leads all of them, then the Hijri
// calendar's nights and days (Laylat al-Qadr, Arafah, Ashura), then the
// week's (the last hour of Friday, Al-Kahf), then the hour's.
import {
  ALL_BAYAAN_NOW_CARDS,
  bayaanNowMode,
  type BayaanNowCards,
} from '@/modules/bayaan-widgets/src/contextRules';
import type {NowContent, NowLook} from './look';
import {HIJRI_MONTH, toHijri} from './calendar';
import {sceneForHour, type SceneId} from './scenes';

export const KAHF = 18;
export const MULK = 67;
/** The night prayer's surah, for the last third of the night. */
export const MUZZAMMIL = 73;
export const QADR = 97;
/** Musa and the sea, for Ashura. */
export const SHUARA = 26;
export const BEDTIME_SLEEP_MINUTES = 30;

/** Adhkar lists by super category id (services/database/AdhkarDatabaseService). */
export const NOW_ADHKAR = {
  morning: 'morning-adhkar',
  evening: 'evening-adhkar',
  sleep: 'before-sleep',
  /** Duas from the Quran: the last hour of Friday, the Day of Arafah. */
  dua: 'quranic-duas',
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
  | 'occasion'
  /** 2 to 4 AM: the last third of the night. */
  | 'night'
  /** Friday from 3 PM to Maghrib. */
  | 'lastHour'
  /** The odd nights of Ramadan's last ten. */
  | 'qadr'
  | 'arafah'
  | 'ashura';

/**
 * A day that only changes how the first card looks and what its label
 * says, whatever it plays: Ramadan, the Eids, the white days…
 */
export type NowDay =
  | {kind: 'ramadan'; day: number}
  | {kind: 'eidFitr'}
  | {kind: 'dhulHijjah'}
  | {kind: 'eidAdha'}
  | {kind: 'newYear'; year: number}
  | {kind: 'whiteDays'}
  | {kind: 'fasting'};

interface NowBase {
  /** Stable across renders: what the card plays, not where it sits. */
  id: string;
  reason: NowReason;
  /** Its own scene or image, else sceneFor picks one. */
  look?: NowLook;
  /** Words that stand in for the ones the rules write. */
  content?: NowContent;
  /** The special day it is shown on, which sets its label and scene. */
  day?: NowDay;
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

/** What a backend slot plays. A surah without a reciter uses the listener's. */
export type NowAction =
  | {kind: 'surah'; surahId: number; reciterId?: string; rewayatId?: string}
  | {kind: 'adhkar'; superId: string}
  | {kind: 'playlist'; playlistId: string};

/**
 * One of the two places in Bayaan Now, as the backend sets it for a key
 * date. With an action it puts that in the place; without one it only
 * restyles whatever the rules put there.
 */
export interface NowSlot {
  action?: NowAction;
  look?: NowLook;
  content?: NowContent;
}

export interface NowInput {
  now: Date;
  /** The reciter of the last thing played, else the default reciter. */
  topReciter: NowReciter | null;
  lastPlayed: NowLastPlayed | null;
  /** System playlists that can play right now. */
  playlistIds: readonly string[];
  cards?: Readonly<BayaanNowCards>;
  /** Set by the backend for a key date: the first slot is the large card. */
  occasion?: readonly NowSlot[] | null;
  /** A reciter the backend names, with the surahs they have. */
  resolveReciter?: (reciterId: string, rewayatId?: string) => NowReciter | null;
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

function fromAction(action: NowAction, input: NowInput): NowMoment | null {
  switch (action.kind) {
    case 'surah': {
      const reciter = action.reciterId
        ? (input.resolveReciter?.(action.reciterId, action.rewayatId) ?? null)
        : input.topReciter;
      return surah(reciter, action.surahId, 'occasion');
    }
    case 'adhkar':
      return adhkar(action.superId, 'occasion');
    case 'playlist':
      return playlist(action.playlistId, 'occasion', input.playlistIds);
  }
}

function withSlot(moment: NowMoment, slot: NowSlot | undefined): NowMoment {
  if (!slot || (!slot.look && !slot.content)) return moment;
  return {
    ...moment,
    look: slot.look ?? moment.look,
    content: {...moment.content, ...slot.content},
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
  const slots = input.occasion ?? [];
  // A slot that plays something leads, styled as the backend set it.
  const candidates: (NowMoment | null | undefined)[] = slots.map(slot => {
    const moment = slot.action ? fromAction(slot.action, input) : null;
    return moment ? withSlot(moment, slot) : null;
  });

  const night = toHijri(now);
  const today = toHijri(now, true);
  const daylight = hour >= 4 && hour < 19;
  if (
    night.month === HIJRI_MONTH.ramadan &&
    night.day >= 21 &&
    night.day % 2 === 1 &&
    (hour >= 18 || hour < 5)
  ) {
    candidates.push(surah(topReciter, QADR, 'qadr'));
  }
  if (
    cards.adhkar &&
    daylight &&
    today.month === HIJRI_MONTH.dhulHijjah &&
    today.day === 9
  ) {
    candidates.push(adhkar(NOW_ADHKAR.dua, 'arafah'));
  }
  if (
    daylight &&
    today.month === HIJRI_MONTH.muharram &&
    (today.day === 9 || today.day === 10)
  ) {
    candidates.push(surah(topReciter, SHUARA, 'ashura'));
  }
  if (cards.adhkar && now.getDay() === 5 && hour >= 15 && hour < 19) {
    candidates.push(adhkar(NOW_ADHKAR.dua, 'lastHour'));
  }
  if (isFridayWindow(now)) {
    candidates.push(surah(topReciter, KAHF, 'friday'));
  }
  if (hour >= 2 && hour < 4) {
    candidates.push(surah(topReciter, MUZZAMMIL, 'night'));
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
  // The day restyles the first card, unless it is already that day's own
  // or the backend restyles it.
  const day = calendarDay(now);
  if (day && moments[0] && !OWN_SCENE.has(moments[0].reason)) {
    moments[0] = {...moments[0], day};
  }
  // A slot with no action restyles what the rules put in its place.
  return moments.map((moment, i) =>
    slots[i] && !slots[i].action ? withSlot(moment, slots[i]) : moment,
  );
}

/** Reasons that come with a scene of their own, which a day doesn't change. */
const OWN_SCENE: ReadonlySet<NowReason> = new Set<NowReason>([
  'occasion',
  'friday',
  'lastHour',
  'qadr',
  'arafah',
  'ashura',
  'night',
]);

/** The special day this is, if any, most particular first. */
export function calendarDay(now: Date): NowDay | null {
  const night = toHijri(now);
  const today = toHijri(now, true);
  const hour = now.getHours();
  if (today.month === HIJRI_MONTH.shawwal && today.day === 1) {
    return {kind: 'eidFitr'};
  }
  if (
    today.month === HIJRI_MONTH.dhulHijjah &&
    today.day >= 10 &&
    today.day <= 13
  ) {
    return {kind: 'eidAdha'};
  }
  if (night.month === HIJRI_MONTH.ramadan) {
    return {kind: 'ramadan', day: night.day};
  }
  if (today.month === HIJRI_MONTH.dhulHijjah && today.day <= 9) {
    return {kind: 'dhulHijjah'};
  }
  if (today.month === HIJRI_MONTH.muharram && today.day === 1) {
    return {kind: 'newYear', year: today.year};
  }
  if (night.day >= 13 && night.day <= 15) return {kind: 'whiteDays'};
  // The Sunnah fasts of Monday and Thursday, before evening adhkar.
  const weekday = now.getDay();
  if ((weekday === 1 || weekday === 4) && hour >= 11 && hour < 15) {
    return {kind: 'fasting'};
  }
  return null;
}

const DAY_SCENE: Record<NowDay['kind'], SceneId> = {
  ramadan: 'ramadan',
  eidFitr: 'eidfitr',
  dhulHijjah: 'dhulhijjah',
  eidAdha: 'eidadha',
  newYear: 'hijri',
  whiteDays: 'whitedays',
  fasting: 'fasting',
};

/** The scene behind a moment when the backend sets none. */
export function sceneFor(moment: NowMoment, now: Date): SceneId {
  const hour = now.getHours();
  switch (moment.reason) {
    case 'friday':
      return 'kahf';
    case 'lastHour':
      return 'lasthour';
    case 'qadr':
      return 'qadr';
    case 'arafah':
      return 'arafah';
    case 'ashura':
      return 'ashura';
    case 'night':
      return 'tahajjud';
    case 'bedtime':
      return 'bedtime';
  }
  if (moment.day) return DAY_SCENE[moment.day.kind];
  switch (moment.reason) {
    case 'morning':
      return hour < 7 && hour >= 4 ? 'fajr' : 'duha';
    case 'evening':
      return hour >= 15 && hour < 20 ? 'maghrib' : 'bedtime';
    case 'midday':
      return hour < 12 ? 'duha' : 'afternoon';
    default:
      return sceneForHour(now);
  }
}

/**
 * When the moment can next change: the next hour boundary the rules and
 * scenes use. Midnight is one, for the Hijri days kept in daylight.
 */
export function nextMomentChange(now: Date): Date {
  const BOUNDARIES = [0, 2, 4, 5, 7, 11, 12, 15, 17, 18, 19, 20, 21];
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
