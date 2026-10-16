import type {Reciter} from '@/data/reciterData';
import type {Surah} from '@/data/surahData';
import type {RecentlyPlayedTrack} from '@/services/player/store/recentlyPlayedStore';
import type {CarItem} from '@/services/car/types';
import type {SituationalReciter} from './situational';

export interface SurahPlayCount {
  surahId: number;
  count: number;
  lastPlayed: number;
}

/** A surah the reciter can play, with the rewayah to play it in. */
export interface ReciterRewayahPick {
  reciterId: string;
  rewayatId: string;
  reciterName: string;
}

/** One day of on-device listening history (LocalAggregationStore). */
export interface DailySurahListening {
  /** Local date, YYYY-MM-DD. */
  date: string;
  /** Milliseconds listened per surah id. */
  surahs: Record<string, number>;
}

const ON_REPEAT_LIMIT = 8;
const ON_REPEAT_MIN_PLAYS = 2;
/** A surah counts as played on a day once it got this much listening. */
const MIN_DAY_LISTEN_MS = 60_000;

function localDayStart(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).getTime();
}

/**
 * Play counts from daily listening history: how many days each surah was
 * listened to for at least a minute, and the last such day.
 */
export function playCountsFromDailyListening(
  days: DailySurahListening[],
): SurahPlayCount[] {
  const counts = new Map<number, SurahPlayCount>();
  for (const day of days) {
    const dayStart = localDayStart(day.date);
    if (Number.isNaN(dayStart)) continue;
    for (const [id, ms] of Object.entries(day.surahs)) {
      const surahId = Number(id);
      if (!Number.isInteger(surahId) || ms < MIN_DAY_LISTEN_MS) continue;
      const entry = counts.get(surahId);
      if (!entry) {
        counts.set(surahId, {surahId, count: 1, lastPlayed: dayStart});
        continue;
      }
      entry.count += 1;
      entry.lastPlayed = Math.max(entry.lastPlayed, dayStart);
    }
  }
  return [...counts.values()];
}
const MORE_FROM_LIMIT = 8;
/** Recently played surahs left out of "More from", so the row feels new. */
const MORE_FROM_RECENT_WINDOW = 10;

/**
 * Widely listened surahs, in the order "More from" offers them: Al-Kahf,
 * Ya-Sin, Ar-Rahman, Al-Waqi'ah, Al-Mulk, Maryam, Yusuf, As-Sajdah,
 * Al-Muzzammil, Al-Insan, An-Naba, Al-Furqan, Al-Fatihah, Al-Ikhlas,
 * Al-Baqarah.
 */
export const POPULAR_SURAH_IDS = [
  18, 36, 55, 56, 67, 19, 12, 32, 73, 76, 78, 25, 1, 112, 2,
];

function surahItem(
  id: string,
  surah: Surah,
  pick: ReciterRewayahPick,
  subtitle: string,
): CarItem {
  return {
    id,
    title: surah.name,
    subtitle,
    artwork: {kind: 'surah', surahId: surah.id},
    action: {
      kind: 'play',
      request: {
        kind: 'surah',
        reciterId: pick.reciterId,
        rewayatId: pick.rewayatId,
        surahId: surah.id,
      },
    },
  };
}

/**
 * The reciter to play a most-played surah with: whoever the user last played
 * it with (if that rewayah still has it), else the top reciter.
 */
function reciterForSurah(
  surahId: number,
  recentTracks: RecentlyPlayedTrack[],
  top: SituationalReciter | null,
  findPick: (
    reciter: Reciter,
    rewayatId: string,
    surahId: number,
  ) => ReciterRewayahPick | null,
): ReciterRewayahPick | null {
  const recent = recentTracks.find(
    t => !t.isUserUpload && t.surah.id === surahId,
  );
  const fromRecent = recent
    ? findPick(recent.reciter, recent.rewayatId, surahId)
    : null;
  if (fromRecent) return fromRecent;
  if (top && top.surahIds.includes(surahId)) {
    return {
      reciterId: top.reciterId,
      rewayatId: top.rewayatId,
      reciterName: top.name,
    };
  }
  return null;
}

/** "On repeat": the surahs played most often (at least twice), most first. */
export function buildOnRepeat(
  playCounts: SurahPlayCount[],
  surahs: Surah[],
  recentTracks: RecentlyPlayedTrack[],
  top: SituationalReciter | null,
  findPick: (
    reciter: Reciter,
    rewayatId: string,
    surahId: number,
  ) => ReciterRewayahPick | null,
): CarItem[] {
  const items: CarItem[] = [];
  const sorted = [...playCounts]
    .filter(p => p.count >= ON_REPEAT_MIN_PLAYS)
    .sort((a, b) => b.count - a.count || b.lastPlayed - a.lastPlayed);
  for (const entry of sorted) {
    if (items.length >= ON_REPEAT_LIMIT) break;
    const surah = surahs.find(s => s.id === entry.surahId);
    if (!surah) continue;
    const pick = reciterForSurah(surah.id, recentTracks, top, findPick);
    if (!pick) continue;
    items.push(surahItem(`repeat:${surah.id}`, surah, pick, pick.reciterName));
  }
  return items;
}

/**
 * "More from <top reciter>": well-known surahs the top reciter recites that
 * the user has not played recently.
 */
export function buildMoreFrom(
  top: SituationalReciter | null,
  surahs: Surah[],
  recentTracks: RecentlyPlayedTrack[],
): {title: string; items: CarItem[]} {
  if (!top) return {title: '', items: []};
  const recent = new Set(
    recentTracks
      .filter(t => !t.isUserUpload)
      .slice(0, MORE_FROM_RECENT_WINDOW)
      .map(t => t.surah.id),
  );
  const pick: ReciterRewayahPick = {
    reciterId: top.reciterId,
    rewayatId: top.rewayatId,
    reciterName: top.name,
  };
  const items: CarItem[] = [];
  for (const surahId of POPULAR_SURAH_IDS) {
    if (items.length >= MORE_FROM_LIMIT) break;
    if (recent.has(surahId) || !top.surahIds.includes(surahId)) continue;
    const surah = surahs.find(s => s.id === surahId);
    if (!surah) continue;
    items.push(
      surahItem(
        `more:${top.reciterId}:${surahId}`,
        surah,
        pick,
        surah.translated_name_english,
      ),
    );
  }
  return {title: `More from ${top.name}`, items};
}
