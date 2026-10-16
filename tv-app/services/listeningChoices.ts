import type {Reciter, Rewayah} from '../types/reciter';
import type {QueueItem} from '../types/player';

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
 * as now when they have it, else Hafs, else whichever has the surah.
 */
export function rewayahForSurah(
  reciter: Reciter,
  surahNumber: number,
  preferName?: string,
): Rewayah | null {
  const withSurah = reciter.rewayat.filter(rw =>
    rw.surah_list.includes(surahNumber),
  );
  if (withSurah.length === 0) return null;
  const named = (name: string) =>
    withSurah.find(rw => rw.name.toLowerCase().includes(name.toLowerCase()));
  return (
    (preferName ? named(preferName) : undefined) ??
    named('hafs') ??
    withSurah[0]
  );
}

export type ReciterChoice = {reciter: Reciter; rewayah: Rewayah};

/**
 * Reciters who can recite this surah, for the player's Reciter panel: the
 * current one first, then `preferredIds` in order (favorites, the default,
 * recently played), then the popular voices, then everyone else by name.
 */
export function reciterChoicesForSurah(
  reciters: readonly Reciter[],
  surahNumber: number,
  options: {
    currentId: string | null;
    preferredIds: readonly string[];
    preferRewayahName?: string;
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
  return reciters
    .map(reciter => ({
      reciter,
      rewayah: rewayahForSurah(reciter, surahNumber, options.preferRewayahName),
    }))
    .filter((c): c is ReciterChoice => c.rewayah !== null)
    .sort(
      (a, b) =>
        rank(a.reciter) - rank(b.reciter) ||
        a.reciter.name.localeCompare(b.reciter.name),
    )
    .slice(0, options.limit);
}

/** What plays after the current item, with each one's place in the queue. */
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

function capitalize(value: string): string {
  return value.length === 0
    ? value
    : value.charAt(0).toUpperCase() + value.slice(1);
}

/** "Murattal · Hafs A'n Assem", the style and rewayah of a recitation. */
export function rewayahLabel(rewayah: Rewayah | null | undefined): string {
  if (!rewayah) return '';
  const style = rewayah.style.trim();
  if (style.length === 0) return rewayah.name;
  if (rewayah.name.length === 0) return capitalize(style);
  return `${capitalize(style)} · ${rewayah.name}`;
}
