import {CarItem} from '@/services/car/types';

export interface SituationalReciter {
  reciterId: string;
  rewayatId: string;
  name: string;
  surahIds: number[];
}

export interface SituationalLastPlayed {
  reciterId: string;
  rewayatId: string;
  reciterName: string;
  surahId: number;
  completed: boolean;
  surahIds: number[];
}

export interface SituationalPlaylist {
  id: string;
  title: string;
  color: string;
  /** Surahs the playlist plays with the top reciter. */
  surahCount: number;
}

export interface SituationalContext {
  now: Date;
  topReciter: SituationalReciter | null;
  lastPlayed: SituationalLastPlayed | null;
  systemPlaylists: SituationalPlaylist[];
  surahName: (surahId: number) => string;
}

const MAX_PICKS = 4;
const KAHF = 18;
const MULK = 67;

function isFridayWindow(now: Date): boolean {
  const day = now.getDay();
  const hour = now.getHours();
  if (day === 4) return hour >= 18;
  if (day === 5) return hour < 19;
  return false;
}

function isMorning(now: Date): boolean {
  const hour = now.getHours();
  return hour >= 4 && hour < 11;
}

function isAfternoon(now: Date): boolean {
  const hour = now.getHours();
  return hour >= 11 && hour < 17;
}

function isEvening(now: Date): boolean {
  const hour = now.getHours();
  return hour >= 17 && hour < 21;
}

function isNight(now: Date): boolean {
  const hour = now.getHours();
  return hour >= 21 || hour < 4;
}

// Card titles say what plays (the surah or playlist). A surah's subtitle says
// why now; a time-of-day playlist already names its moment, so its subtitle
// gives its size. Subtitles stay under ten characters, the width a card shows
// before truncating. The reciter shows on Now Playing once the pick plays.
function surahPick(
  id: string,
  reciter: SituationalReciter,
  surahId: number,
  reason: string,
  ctx: SituationalContext,
): CarItem | null {
  if (!reciter.surahIds.includes(surahId)) return null;
  return {
    id,
    title: ctx.surahName(surahId),
    subtitle: reason,
    artwork: {kind: 'surah', surahId},
    action: {
      kind: 'play',
      request: {
        kind: 'surah',
        reciterId: reciter.reciterId,
        rewayatId: reciter.rewayatId,
        surahId,
      },
    },
  };
}

/** "1 surah", "3 playlists", or "None yet" for an empty collection. */
export function countOf(count: number, singular: string): string {
  if (count === 0) return 'None yet';
  return count === 1 ? `1 ${singular}` : `${count} ${singular}s`;
}

export function surahCount(count: number): string {
  return countOf(count, 'surah');
}

function playlistPick(
  id: string,
  playlists: SituationalPlaylist[],
  playlistId: string,
): CarItem | null {
  const playlist = playlists.find(p => p.id === playlistId);
  if (!playlist) return null;
  return {
    id,
    title: playlist.title,
    subtitle: surahCount(playlist.surahCount),
    artwork: {kind: 'icon', name: 'playlist', hex: playlist.color},
    action: {
      kind: 'play',
      request: {kind: 'playlist', playlistId, system: true},
    },
  };
}

function upNextPick(ctx: SituationalContext): CarItem | null {
  const last = ctx.lastPlayed;
  if (!last || !last.completed) return null;
  const sorted = [...last.surahIds].sort((a, b) => a - b);
  const next = sorted.find(id => id > last.surahId);
  if (next === undefined) return null;
  return {
    id: 'now:upnext',
    title: ctx.surahName(next),
    subtitle: 'Up next',
    artwork: {kind: 'surah', surahId: next},
    action: {
      kind: 'play',
      request: {
        kind: 'surah',
        reciterId: last.reciterId,
        rewayatId: last.rewayatId,
        surahId: next,
      },
    },
  };
}

export function buildSituationalPicks(ctx: SituationalContext): CarItem[] {
  const candidates: (CarItem | null)[] = [];
  const reciter = ctx.topReciter;

  if (isFridayWindow(ctx.now) && reciter) {
    candidates.push(surahPick('now:kahf', reciter, KAHF, 'Friday', ctx));
  }
  if (isMorning(ctx.now)) {
    candidates.push(
      playlistPick('now:morning', ctx.systemPlaylists, 'morning-reflections'),
    );
  }
  if (isAfternoon(ctx.now)) {
    candidates.push(
      playlistPick('now:afternoon', ctx.systemPlaylists, 'quick-listen'),
    );
  }
  if (isEvening(ctx.now)) {
    candidates.push(
      playlistPick('now:evening', ctx.systemPlaylists, 'evening-serenity'),
    );
  }
  if (isNight(ctx.now)) {
    if (reciter) {
      candidates.push(surahPick('now:mulk', reciter, MULK, 'Bedtime', ctx));
    }
    candidates.push(
      playlistPick('now:evening', ctx.systemPlaylists, 'evening-serenity'),
    );
  }
  candidates.push(upNextPick(ctx));

  const seen = new Set<string>();
  const picks: CarItem[] = [];
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    picks.push(candidate);
    if (picks.length === MAX_PICKS) break;
  }
  return picks;
}
