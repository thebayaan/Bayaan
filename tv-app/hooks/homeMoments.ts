/**
 * What Home suggests at a given moment: the hero and the contextual rail,
 * and which rails Home shows in what order.
 *
 * Pure (the Date is injected) so the windows are unit-tested. Windows are
 * fixed clock hours, not prayer times, like the phone's adhkar windows
 * (services/adhkar/timeWindows.ts):
 *   04:00-09:59  after Fajr  -> Morning adhkar
 *   10:00-15:59  daytime     -> a surah of the day
 *   16:00-19:59  evening     -> Evening adhkar
 *   20:00-03:59  night       -> Al-Mulk, before sleep
 * Friday puts Al-Kahf in the hero instead, from the night before (Thursday
 * from 20:00, after maghrib all year) until Friday's evening window, when
 * the evening adhkar return. The time window still decides the rail under
 * it, and every window has a rail of its own.
 */
import {SURAHS} from '../../data/surahData';
import {
  estimateDhikrMinutes,
  groupLists,
  nowListId,
} from '../services/adhkarBrowse';

export type DayWindow = 'morning' | 'day' | 'evening' | 'night';

export const MORNING_START_HOUR = 4;
export const DAY_START_HOUR = 10;
export const EVENING_START_HOUR = 16;
export const NIGHT_START_HOUR = 20;

export const SURAH = {
  fatihah: 1,
  kahf: 18,
  maryam: 19,
  yusuf: 12,
  sajdah: 32,
  yasin: 36,
  qaf: 50,
  rahman: 55,
  waqiah: 56,
  mulk: 67,
  muzzammil: 73,
  insan: 76,
  duha: 93,
  ikhlas: 112,
} as const;

export type SurahHero = {
  kind: 'surah';
  kicker: string;
  surahNumber: number;
  /** Why this surah now; the reading facts are appended by the screen. */
  lead: string;
};

export type AdhkarHero = {
  kind: 'adhkar';
  kicker: string;
  listId: string;
  title: string;
  /** The surah offered by the secondary action ("Yasin instead"). */
  insteadSurah: number;
};

export type HomeHero = SurahHero | AdhkarHero;

export type MomentItem =
  | {kind: 'surah'; surahNumber: number}
  | {kind: 'adhkar'; listId: string};

export type HomeMoments = {title: string; items: MomentItem[]};

export type HomePlan = {
  window: DayWindow;
  /** The time for Al-Kahf (see isFridayTime). */
  isFriday: boolean;
  hero: HomeHero;
  /** The moment's rail; it never repeats what the hero offers. */
  moments: HomeMoments;
};

export function dayWindowAt(date: Date): DayWindow {
  const h = date.getHours();
  if (h >= MORNING_START_HOUR && h < DAY_START_HOUR) return 'morning';
  if (h >= DAY_START_HOUR && h < EVENING_START_HOUR) return 'day';
  if (h >= EVENING_START_HOUR && h < NIGHT_START_HOUR) return 'evening';
  return 'night';
}

/**
 * Whether it is the time for Al-Kahf: the eve of Friday (Thursday from the
 * night window) through Friday until its evening window.
 */
export function isFridayTime(date: Date): boolean {
  const h = date.getHours();
  switch (date.getDay()) {
    case 4:
      return h >= NIGHT_START_HOUR;
    case 5:
      return h < EVENING_START_HOUR;
    default:
      return false;
  }
}

/** The hour a plan belongs to; Home re-plans only when this changes. */
export function planHourOf(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
  ).getTime();
}

/** A daytime surah that changes with the weekday, stable within a day. */
const DAY_SURAHS = [
  SURAH.rahman, // Sunday
  SURAH.yasin,
  SURAH.maryam,
  SURAH.waqiah,
  SURAH.yusuf,
  SURAH.kahf, // Friday (the Friday hero wins anyway)
  SURAH.qaf,
] as const;

function surahOfTheDay(date: Date): number {
  return DAY_SURAHS[date.getDay()];
}

function heroFor(window: DayWindow, isFriday: boolean, date: Date): HomeHero {
  if (isFriday) {
    return date.getDay() === 5
      ? {
          kind: 'surah',
          kicker: 'FRIDAY',
          surahNumber: SURAH.kahf,
          lead: 'Reciting Al-Kahf on Friday is a sunnah.',
        }
      : {
          kind: 'surah',
          kicker: 'EVE OF FRIDAY',
          surahNumber: SURAH.kahf,
          lead: 'The time for Al-Kahf begins tonight.',
        };
  }
  switch (window) {
    case 'morning':
      return {
        kind: 'adhkar',
        kicker: 'AFTER FAJR',
        listId: 'morning-adhkar',
        title: 'Morning adhkar',
        insteadSurah: SURAH.yasin,
      };
    case 'evening':
      return {
        kind: 'adhkar',
        kicker: 'EVENING',
        listId: 'evening-adhkar',
        title: 'Evening adhkar',
        insteadSurah: SURAH.waqiah,
      };
    case 'night':
      return {
        kind: 'surah',
        kicker: 'BEFORE SLEEP',
        surahNumber: SURAH.mulk,
        lead: 'The Prophet, peace be upon him, would not sleep until he recited it.',
      };
    case 'day':
      return {
        kind: 'surah',
        kicker: 'TODAY',
        surahNumber: surahOfTheDay(date),
        lead: 'A surah for your day.',
      };
  }
}

const s = (surahNumber: number): MomentItem => ({kind: 'surah', surahNumber});
const a = (listId: string): MomentItem => ({kind: 'adhkar', listId});

function windowMoments(
  window: DayWindow,
  isFriday: boolean,
  date: Date,
): HomeMoments {
  switch (window) {
    case 'morning':
      return {
        title: 'This morning',
        items: [
          a('morning-adhkar'),
          s(SURAH.yasin),
          s(SURAH.duha),
          s(SURAH.rahman),
          s(SURAH.fatihah),
          s(SURAH.ikhlas),
        ],
      };
    case 'evening':
      return {
        title: 'This evening',
        items: [
          s(SURAH.waqiah),
          s(SURAH.mulk),
          s(SURAH.rahman),
          s(SURAH.insan),
          s(SURAH.ikhlas),
          a('evening-adhkar'),
        ],
      };
    case 'night':
      return {
        title: 'Tonight',
        items: [
          s(SURAH.mulk),
          s(SURAH.sajdah),
          s(SURAH.waqiah),
          s(SURAH.ikhlas),
          a('before-sleep'),
        ],
      };
    case 'day':
      // Friday daytime: send blessings on the Prophet, a Friday practice.
      return isFriday
        ? {
            title: 'On Friday',
            items: [
              a('salawat'),
              s(SURAH.yasin),
              s(SURAH.rahman),
              s(SURAH.waqiah),
            ],
          }
        : {
            title: 'Today',
            items: [
              s(surahOfTheDay(date)),
              s(SURAH.yasin),
              s(SURAH.rahman),
              s(SURAH.waqiah),
              s(SURAH.mulk),
              s(SURAH.yusuf),
              a('salawat'),
            ],
          };
  }
}

/**
 * The rail of moments under the hero. What the hero already offers (its
 * surah, or its adhkar list and "instead" surah) is left out.
 */
function momentsFor(
  window: DayWindow,
  isFriday: boolean,
  date: Date,
  hero: HomeHero,
): HomeMoments {
  const offered = (item: MomentItem): boolean => {
    if (hero.kind === 'surah') {
      return item.kind === 'surah' && item.surahNumber === hero.surahNumber;
    }
    return item.kind === 'adhkar'
      ? item.listId === hero.listId
      : item.surahNumber === hero.insteadSurah;
  };
  const moments = windowMoments(window, isFriday, date);
  return {...moments, items: moments.items.filter(i => !offered(i))};
}

export function homePlanAt(date: Date): HomePlan {
  const window = dayWindowAt(date);
  const isFriday = isFridayTime(date);
  const hero = heroFor(window, isFriday, date);
  return {
    window,
    isFriday,
    hero,
    moments: momentsFor(window, isFriday, date, hero),
  };
}

// ---- Reading-time estimates -------------------------------------------

/** Minutes per mushaf page at a calm murattal pace (Al-Kahf: 12 pages, ~41). */
const MINUTES_PER_PAGE = 3.4;

function pageCount(pages: string): number {
  const [from, to] = pages.split('-').map(p => parseInt(p, 10));
  if (!Number.isFinite(from)) return 1;
  return Math.max(1, (Number.isFinite(to) ? to : from) - from + 1);
}

/** About how many minutes a recitation of the surah takes. */
export function estimateSurahMinutes(surahNumber: number): number {
  const surah = SURAHS.find(x => x.id === surahNumber);
  if (!surah) return 5;
  const pages = pageCount(surah.pages);
  if (pages > 1) return Math.round(pages * MINUTES_PER_PAGE);
  // One-page surahs range from Al-Kawthar to a full page; go by verses.
  return Math.max(1, Math.min(4, Math.round(surah.verses_count * 0.15)));
}

/**
 * About how many minutes reading a list of adhkar takes, repeats included:
 * the Adhkar screen's estimate, so both screens give a list the same time.
 */
export function estimateAdhkarMinutes(
  adhkar: readonly {arabic: string; repeatCount: number}[],
): number {
  return estimateDhikrMinutes(adhkar);
}

/** "110 verses, about 41 minutes with Al-Minshawi." */
export function surahFacts(
  surahNumber: number,
  reciterName: string | null,
): string {
  const surah = SURAHS.find(x => x.id === surahNumber);
  const verses = surah ? `${surah.verses_count} verses, ` : '';
  const minutes = estimateSurahMinutes(surahNumber);
  const time = minutes === 1 ? 'about a minute' : `about ${minutes} minutes`;
  return `${verses}${time}${reciterName ? ` with ${reciterName}` : ''}.`;
}

/** "23 adhkar from Hisn al-Muslim, about 14 minutes, ..." */
export function adhkarFacts(count: number, minutes: number): string {
  const time = minutes === 1 ? 'about a minute' : `about ${minutes} minutes`;
  return `${count} adhkar from Hisn al-Muslim, ${time}, read along with the words on screen.`;
}

/** "13 adhkar · 6 min" for adhkar tiles. */
export function adhkarTileMeta(count: number, minutes: number): string {
  return `${count} adhkar · ${minutes} min`;
}

/** "110 verses · 41 min", under a surah tile (its artwork already names it). */
export function surahCaption(surahNumber: number): string {
  const surah = SURAHS.find(x => x.id === surahNumber);
  const minutes = estimateSurahMinutes(surahNumber);
  return surah
    ? `${surah.verses_count} verses · ${minutes} min`
    : `${minutes} min`;
}

/** "6 surahs · 40 min" for a collection or a playlist. */
export function surahListMeta(surahNumbers: readonly number[]): string {
  const count = surahNumbers.length;
  if (count === 0) return 'No surahs yet';
  const minutes = surahNumbers.reduce(
    (sum, n) => sum + estimateSurahMinutes(n),
    0,
  );
  const time =
    minutes >= 60
      ? `${Math.floor(minutes / 60)} h ${minutes % 60} min`
      : `${minutes} min`;
  return `${count === 1 ? '1 surah' : `${count} surahs`} · ${time}`;
}

// ---- Which rails Home shows ---------------------------------------------

export type HomeRow =
  | 'continue'
  | 'moments'
  | 'recent'
  | 'favorites'
  | 'playlists'
  | 'loved'
  | 'adhkar'
  | 'collections'
  | 'featured'
  | 'juzAmma';

/**
 * Home's rails under the hero, in order: what you were listening to, the
 * moment, your own things, then what Bayaan suggests. There is no row of
 * every reciter; the reciter rows are personal or curated, and capped.
 */
export const HOME_ROW_ORDER: readonly HomeRow[] = [
  'continue',
  'moments',
  'recent',
  'favorites',
  'playlists',
  'loved',
  'adhkar',
  'collections',
  'featured',
  'juzAmma',
];

/** The rails that have something to show, in order; empty ones are left out. */
export function homeRows(sizes: Partial<Record<HomeRow, number>>): HomeRow[] {
  return HOME_ROW_ORDER.filter(row => (sizes[row] ?? 0) > 0);
}

/** How many lists Home's Adhkar rail shows before its "All adhkar" tile. */
export const ADHKAR_ROW_LIMIT = 6;

/**
 * The Adhkar rail: the list for this time of day first, then the everyday
 * lists, leaving out the ones the hero and the moment's rail already show.
 */
export function adhkarRowIds(
  date: Date,
  exclude: readonly string[],
  limit = ADHKAR_ROW_LIMIT,
): string[] {
  const daily = groupLists('daily');
  const ids = [
    nowListId(date),
    ...[...daily.featured, ...daily.rest].map(l => l.id),
  ];
  return [...new Set(ids)].filter(id => !exclude.includes(id)).slice(0, limit);
}

/** The adhkar lists a plan's hero and moment rail already offer. */
export function planListIds(plan: HomePlan): string[] {
  const ids = plan.moments.items.flatMap(i =>
    i.kind === 'adhkar' ? [i.listId] : [],
  );
  return plan.hero.kind === 'adhkar' ? [plan.hero.listId, ...ids] : ids;
}
