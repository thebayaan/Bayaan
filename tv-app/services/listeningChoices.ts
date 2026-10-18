import type {Reciter, Rewayah} from '../types/reciter';
import type {QueueItem} from '../types/player';
import {
  recitationStyle,
  rewayahDisplayName,
  styleLabel,
} from './browseCatalog';

/**
 * The best-known voices, in the order onboarding shows them (the approved
 * screen leads with Al-Minshawi, Al-Afasy, Abdul Basit, As-Sudais, Al-Dosari
 * and Al-Ghamdi), then the rest of the phone's featured list
 * (data/featuredReciters.ts). Matched against the catalog by name.
 */
export const POPULAR_RECITER_NAMES: readonly string[] = [
  'Mohammed Siddiq Al-Minshawi',
  'Mishary Alafasi',
  'Abdulbasit Abdulsamad',
  'Abdulrahman Alsudaes',
  'Yasser Al-Dosari',
  'Saad Al-Ghamdi',
  'Mahmoud Khalil Al-Hussary',
  'Maher Al Meaqli',
  'Saud Al-Shuraim',
  'Albaraa Basfar',
  'Mohammed Ayyub',
  'Mohammed Jibreel',
  'Ahmad Al-Ajmy',
  'Mahmoud Ali Albanna',
  'Nasser Alqatami',
];

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Up to `count` popular reciters from the catalog, in POPULAR_RECITER_NAMES
 * order, topped up with catalog reciters that have portraits (featured first)
 * when fewer match.
 */
export function popularReciters(
  reciters: readonly Reciter[],
  count: number,
  hasPortrait: (r: Reciter) => boolean = () => true,
): Reciter[] {
  const byName = new Map(reciters.map(r => [normalizeName(r.name), r]));
  const picked: Reciter[] = [];
  for (const name of POPULAR_RECITER_NAMES) {
    const match = byName.get(normalizeName(name));
    if (match && !picked.includes(match)) picked.push(match);
    if (picked.length >= count) return picked;
  }
  const rest = reciters
    .filter(r => !picked.includes(r) && hasPortrait(r))
    .sort((a, b) => Number(b.is_featured) - Number(a.is_featured));
  return [...picked, ...rest].slice(0, count);
}

/**
 * The reciter's recitation of `surahNumber` to switch to: the same rewayah
 * in the same style as now when they have it (Murattal stays Murattal), then
 * the same rewayah in any style, then Hafs (in that style first), then
 * whichever has the surah.
 */
export function rewayahForSurah(
  reciter: Reciter,
  surahNumber: number,
  preferName?: string,
  preferStyle?: string,
): Rewayah | null {
  const withSurah = reciter.rewayat.filter(rw =>
    rw.surah_list.includes(surahNumber),
  );
  if (withSurah.length === 0) return null;
  const style = preferStyle ? recitationStyle(preferStyle) : null;
  const named = (name: string, sameStyle: boolean) =>
    withSurah.find(
      rw =>
        rw.name.toLowerCase().includes(name.toLowerCase()) &&
        (!sameStyle || style === null || recitationStyle(rw.style) === style),
    );
  return (
    (preferName ? named(preferName, true) : undefined) ??
    (preferName ? named(preferName, false) : undefined) ??
    named('hafs', true) ??
    named('hafs', false) ??
    withSurah[0]
  );
}

export type ReciterChoice = {reciter: Reciter; rewayah: Rewayah};

/** Identifies one row of the Reciter panel: a reciter in one recitation. */
export function choiceKey(reciterId: string, rewayahId?: string): string {
  return `${reciterId}:${rewayahId ?? ''}`;
}

/**
 * Reciters who can recite this surah, for the player's Reciter panel: the
 * current one first, then `preferredIds` in order (favorites, the default,
 * recently played), then the popular voices, then everyone else by name.
 * The current reciter is listed in the recitation playing now
 * (`currentRewayahId`), followed by their other styles of the surah
 * (Mujawwad, Teaching), so the style can be switched too.
 */
export function reciterChoicesForSurah(
  reciters: readonly Reciter[],
  surahNumber: number,
  options: {
    currentId: string | null;
    currentRewayahId?: string;
    preferredIds: readonly string[];
    preferRewayahName?: string;
    preferStyle?: string;
    limit: number;
  },
): ReciterChoice[] {
  const popular = POPULAR_RECITER_NAMES.map(normalizeName);
  const rank = (r: Reciter): number => {
    if (r.id === options.currentId) return -1;
    const preferred = options.preferredIds.indexOf(r.id);
    if (preferred >= 0) return preferred;
    const pop = popular.indexOf(normalizeName(r.name));
    if (pop >= 0) return 1000 + pop;
    return 10000;
  };
  const playingNow = (reciter: Reciter): Rewayah | undefined =>
    reciter.id === options.currentId
      ? reciter.rewayat.find(
          rw =>
            rw.id === options.currentRewayahId &&
            rw.surah_list.includes(surahNumber),
        )
      : undefined;
  const choices = reciters
    .map(reciter => ({
      reciter,
      rewayah:
        playingNow(reciter) ??
        rewayahForSurah(
          reciter,
          surahNumber,
          options.preferRewayahName,
          options.preferStyle,
        ),
    }))
    .filter((c): c is ReciterChoice => c.rewayah !== null)
    .sort(
      (a, b) =>
        rank(a.reciter) - rank(b.reciter) ||
        a.reciter.name.localeCompare(b.reciter.name),
    )
    .slice(0, options.limit);
  const current = choices.find(c => c.reciter.id === options.currentId);
  if (!current) return choices;
  const otherStyles = current.reciter.rewayat
    .filter(
      rw => rw.id !== current.rewayah.id && rw.surah_list.includes(surahNumber),
    )
    .map(rewayah => ({reciter: current.reciter, rewayah}));
  const at = choices.indexOf(current) + 1;
  return [...choices.slice(0, at), ...otherStyles, ...choices.slice(at)];
}

/**
 * The queue after switching the current surah to another voice
 * (`swap` gives an item in the new recitation, or null when it has no
 * recording of that surah). A queue that is the old voice's whole
 * recitation (`fullLength` surahs, all by that reciter in that rewayah,
 * in any order, shuffled too) carries on in the new voice, leaving out the
 * surahs it doesn't have. Any other queue (a playlist, loved surahs, a
 * filtered list) keeps its other items as they were: only the surah playing
 * changes, as the panel says.
 */
export function queueInVoice(
  queue: readonly QueueItem[],
  currentIndex: number,
  fullLength: number | null,
  swap: (item: QueueItem) => QueueItem | null,
): {queue: QueueItem[]; index: number} {
  const current = queue[currentIndex];
  const replaced = current ? swap(current) : null;
  if (!current || !replaced) return {queue: queue.slice(), index: currentIndex};
  const wholeRecitation =
    fullLength !== null &&
    queue.length === fullLength &&
    queue.every(
      q =>
        q.reciterId === current.reciterId && q.rewayahId === current.rewayahId,
    );
  if (!wholeRecitation) {
    const next = queue.slice();
    next[currentIndex] = replaced;
    return {queue: next, index: currentIndex};
  }
  const next: QueueItem[] = [];
  let index = 0;
  queue.forEach((item, i) => {
    const swapped = i === currentIndex ? replaced : swap(item);
    if (!swapped) return;
    if (i === currentIndex) index = next.length;
    next.push(swapped);
  });
  return {queue: next, index};
}

/** What plays after the current item, with each one's place in the queue. */
/**
 * The Queue panel's window onto the queue: up to `before` surahs already
 * played, the one playing, then up to `after` coming next, with indexes.
 */
export function queueWindow(
  queue: readonly QueueItem[],
  currentIndex: number,
  before: number,
  after: number,
): {item: QueueItem; index: number}[] {
  const from = Math.max(0, currentIndex - before);
  const to = Math.min(queue.length, currentIndex + 1 + after);
  return queue.slice(from, to).map((item, i) => ({item, index: from + i}));
}

export function upcoming(
  queue: readonly QueueItem[],
  currentIndex: number,
  limit: number,
): {item: QueueItem; index: number}[] {
  return queue
    .slice(currentIndex + 1, currentIndex + 1 + limit)
    .map((item, i) => ({item, index: currentIndex + 1 + i}));
}

/**
 * A reciter's name short enough for the tray, the way the approved screens
 * write it: "Mohammed Siddiq Al-Minshawi" becomes "Al-Minshawi"; names that
 * already fit stay whole.
 */
export function shortReciterName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= 22) return trimmed;
  const words = trimmed.split(' ');
  for (let i = words.length - 1; i > 0; i--) {
    if (/^al(-|$)/i.test(words[i])) {
      return words.slice(i).join(' ');
    }
  }
  return words[words.length - 1];
}

/**
 * "Murattal · Hafs 'an 'Asim": the style and rewayah of a recitation, in the
 * display names the reciter pages use (browseCatalog's styleLabel and
 * rewayahDisplayName), never the API's raw "molim" or "Hafs A'n Assem". The
 * one label for a recitation wherever the app names one.
 */
export function rewayahLabel(rewayah: Rewayah | null | undefined): string {
  if (!rewayah) return '';
  const style = rewayah.style.trim();
  const name = rewayah.name.trim();
  if (style.length === 0) return rewayahDisplayName(name);
  if (name.length === 0) return styleLabel(style);
  return `${styleLabel(style)} · ${rewayahDisplayName(name)}`;
}
