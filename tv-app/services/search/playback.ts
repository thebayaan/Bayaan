/**
 * What the search screen's buttons play: which reciter and recitation a surah
 * plays in, and where a verse starts in it. Pure choices plus thin wrappers
 * over the verse-timing service the listening room already uses.
 */
import {fetchTimings} from '../verseData';
import {buildTimeline, verseSpan, type VerseSpan} from '../verseTimeline';
import type {Reciter, Rewayah} from '../../types/reciter';

function isHafs(r: Rewayah): boolean {
  return /hafs/i.test(r.name);
}

function isMurattal(r: Rewayah): boolean {
  return /murattal/i.test(r.style);
}

function hasSurah(r: Rewayah, surah: number | undefined): boolean {
  return surah === undefined || r.surah_list.includes(surah);
}

/**
 * The recitation to play: Hafs murattal first (what verse timings and most
 * listeners expect), then any Hafs, then the first; only ones that include
 * `surah` when one is given. Null when none does.
 */
export function pickRewayah(
  rewayat: readonly Rewayah[],
  surah?: number,
): Rewayah | null {
  const playable = rewayat.filter(r => hasSurah(r, surah));
  return (
    playable.find(r => isHafs(r) && isMurattal(r)) ??
    playable.find(isHafs) ??
    playable[0] ??
    null
  );
}

/**
 * Who recites a surah played from search: the default reciter when they have
 * it, else a favourite, else a featured reciter, else anyone who has it.
 */
export function pickReciterForSurah(
  reciters: readonly Reciter[],
  surah: number,
  defaultReciterId: string | null,
  favoriteIds: readonly string[] = [],
): {reciter: Reciter; rewayah: Rewayah} | null {
  const byId = new Map(reciters.map(r => [r.id, r]));
  const order: Reciter[] = [];
  const add = (r: Reciter | undefined): void => {
    if (r && !order.includes(r)) order.push(r);
  };
  if (defaultReciterId) add(byId.get(defaultReciterId));
  favoriteIds.forEach(id => add(byId.get(id)));
  reciters.filter(r => r.is_featured).forEach(add);
  reciters.forEach(add);
  for (const reciter of order) {
    const rewayah = pickRewayah(reciter.rewayat, surah);
    if (rewayah) return {reciter, rewayah};
  }
  return null;
}

/**
 * Reciters to offer under "Choose reciter" for a surah: favourites and the
 * default first, then featured, then everyone else by name; only those who
 * recite it.
 */
export function recitersForSurah(
  reciters: readonly Reciter[],
  surah: number,
  defaultReciterId: string | null,
  favoriteIds: readonly string[] = [],
): Reciter[] {
  const favorites = new Set(favoriteIds);
  const rank = (r: Reciter): number => {
    if (r.id === defaultReciterId) return 0;
    if (favorites.has(r.id)) return 1;
    if (r.is_featured) return 2;
    return 3;
  };
  return reciters
    .filter(r => pickRewayah(r.rewayat, surah) !== null)
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

/**
 * Where a verse sits in a recitation, or null when the recitation has no
 * verse timings the player can trust (not timed, not Hafs, or offline).
 */
export async function findVerseSpan(
  rewayah: Rewayah,
  surah: number,
  hafsVerseCount: number,
  ayah: number,
): Promise<VerseSpan | null> {
  const entries = await fetchTimings(rewayah.id, surah).catch(() => null);
  if (!entries) return null;
  const timeline = buildTimeline(entries, {
    surahNumber: surah,
    hafsVerseCount,
    rewayahName: rewayah.name,
  });
  return timeline ? verseSpan(timeline, ayah) : null;
}

/**
 * What the toast over the player says when a verse can't be found in the
 * recitation that plays, so the surah starting from verse 1 isn't a mystery.
 */
export function verseFallbackNote(
  reciterName: string,
  surahName: string,
): string {
  return `${reciterName} has no verse timings for ${surahName}, so it plays from the start.`;
}

/**
 * For "Play verse": whether playback has reached the end of the verse and
 * should pause. `gone` means the listener moved elsewhere (another surah, or
 * seeked well outside the verse), so the watch should stop without pausing.
 */
export function verseEndCheck(
  span: VerseSpan,
  positionMs: number,
  sameTrack: boolean,
): 'playing' | 'end' | 'gone' {
  if (!sameTrack) return 'gone';
  if (positionMs < span.fromMs - 3000) return 'gone';
  if (positionMs > span.toMs + 5000) return 'gone';
  return positionMs >= span.toMs ? 'end' : 'playing';
}
