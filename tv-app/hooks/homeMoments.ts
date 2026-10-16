/**
 * What Home suggests at a given moment: the hero and the contextual rail.
 *
 * Pure (the Date is injected) so the windows are unit-tested and Home can
 * re-evaluate them every minute. Windows are fixed clock hours, not prayer
 * times, like the phone's adhkar windows (services/adhkar/timeWindows.ts):
 *   04:00-09:59  after Fajr  -> Morning adhkar
 *   10:00-15:59  daytime     -> a surah of the day
 *   16:00-19:59  evening     -> Evening adhkar
 *   20:00-03:59  night       -> Al-Mulk, before sleep
 * Friday (the whole calendar day) puts Al-Kahf in the hero instead, and the
 * time window still decides the rail under it.
 */
import {SURAHS} from '../../data/surahData';

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
  isFriday: boolean;
  hero: HomeHero;
  /** Null when this moment has no rail of its own (Home shows reciters). */
  moments: HomeMoments | null;
};

export function dayWindowAt(date: Date): DayWindow {
  const h = date.getHours();
  if (h >= MORNING_START_HOUR && h < DAY_START_HOUR) return 'morning';
  if (h >= DAY_START_HOUR && h < EVENING_START_HOUR) return 'day';
  if (h >= EVENING_START_HOUR && h < NIGHT_START_HOUR) return 'evening';
  return 'night';
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
    return {
      kind: 'surah',
      kicker: 'FRIDAY',
      surahNumber: SURAH.kahf,
      lead: 'Reciting Al-Kahf on Friday is a sunnah.',
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

/**
 * The rail of moments under a surah hero. An adhkar hero has none: its
 * moment is the list itself, so Home shows the user's reciters instead.
 */
function momentsFor(window: DayWindow, hero: HomeHero): HomeMoments | null {
  if (hero.kind !== 'surah') return null;
  const without = (items: MomentItem[]): MomentItem[] =>
    items.filter(i => i.kind !== 'surah' || i.surahNumber !== hero.surahNumber);
  switch (window) {
    case 'morning':
      return {
        title: 'This morning',
        items: without([
          a('morning-adhkar'),
          s(SURAH.yasin),
          s(SURAH.rahman),
          s(SURAH.fatihah),
          s(SURAH.ikhlas),
        ]),
      };
    case 'evening':
      return {
        title: 'This evening',
        items: without([
          s(SURAH.waqiah),
          s(SURAH.mulk),
          s(SURAH.rahman),
          s(SURAH.ikhlas),
          a('evening-adhkar'),
        ]),
      };
    case 'night':
      return {
        title: 'Tonight',
        items: without([
          s(SURAH.mulk),
          s(SURAH.sajdah),
          s(SURAH.waqiah),
          s(SURAH.ikhlas),
          a('before-sleep'),
        ]),
      };
    case 'day':
      // Friday daytime: send blessings on the Prophet, a Friday practice.
      return hero.surahNumber === SURAH.kahf
        ? {
            title: 'On Friday',
            items: without([
              a('salawat'),
              s(SURAH.yasin),
              s(SURAH.rahman),
              s(SURAH.waqiah),
            ]),
          }
        : null;
  }
}

export function homePlanAt(date: Date): HomePlan {
  const window = dayWindowAt(date);
  const isFriday = date.getDay() === 5;
  const hero = heroFor(window, isFriday, date);
  return {window, isFriday, hero, moments: momentsFor(window, hero)};
}

/** Surahs for the first-launch "Quick picks" rail (the hero's is left out). */
export const QUICK_PICK_SURAHS: readonly number[] = [
  SURAH.fatihah,
  SURAH.kahf,
  SURAH.yasin,
  SURAH.rahman,
  SURAH.waqiah,
  SURAH.mulk,
  SURAH.ikhlas,
];

export function quickPicks(heroSurah: number | null): number[] {
  return QUICK_PICK_SURAHS.filter(n => n !== heroSurah);
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

/** Arabic characters read per second, repeats included (morning: ~14 min). */
const ADHKAR_CHARS_PER_SECOND = 45;

/** About how many minutes reading a list of adhkar takes, repeats included. */
export function estimateAdhkarMinutes(
  adhkar: readonly {arabic: string; repeatCount: number}[],
): number {
  const chars = adhkar.reduce(
    (sum, d) => sum + d.arabic.length * Math.max(1, d.repeatCount),
    0,
  );
  return Math.max(1, Math.round(chars / ADHKAR_CHARS_PER_SECOND / 60));
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

// ---- Which rails Home shows ---------------------------------------------

export type HomeSection = 'continue' | 'moments' | 'quickPicks' | 'reciters';

/**
 * The two rails under the hero (three sections at most). A first launch
 * gets Quick picks and reciters; after that, Continue listening leads and
 * the moment's rail (or the user's reciters) follows.
 */
export function homeSections({
  hasContinue,
  hasHistory,
  hasMoments,
}: {
  hasContinue: boolean;
  hasHistory: boolean;
  hasMoments: boolean;
}): HomeSection[] {
  if (!hasContinue && !hasHistory) return ['quickPicks', 'reciters'];
  if (hasContinue) return ['continue', hasMoments ? 'moments' : 'reciters'];
  return [hasMoments ? 'moments' : 'quickPicks', 'reciters'];
}
