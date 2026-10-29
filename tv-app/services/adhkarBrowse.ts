// What the Adhkar screen shows: the phone's lists grouped under the TV's
// chips, the list that fits the time of day, and each card's subtitle.
import {adhkarWindowAt} from '../../services/adhkar/timeWindows';
import {parseAdhkarArabic} from '../../utils/adhkarText';
import {
  ADHKAR_LISTS,
  adhkarForList,
  adhkarList,
  type AdhkarList,
} from './adhkarData';

export type AdhkarGroupId =
  | 'daily'
  | 'prayer'
  | 'home'
  | 'travel'
  | 'hardship'
  | 'all';

export type AdhkarGroup = {
  id: AdhkarGroupId;
  label: string;
  /** List ids in the order the screen shows them; the first few are big. */
  listIds: readonly string[];
};

/** How many lists of a group get a big card. */
export const FEATURED_COUNT = 4;

/** The four everyday lists, big at the top of Daily and All. */
const EVERYDAY = [
  'morning-adhkar',
  'evening-adhkar',
  'before-sleep',
  'after-salah',
] as const;

// The phone groups lists only into Main and Other; these chips sort them by
// when you reach for them, following the categories' broad tags in
// data/adhkar.json (daily, prayer, home, travel, health / protection). A list
// can sit under more than one chip.
const GROUPS: readonly Omit<AdhkarGroup, 'label'>[] = [
  {
    id: 'daily',
    listIds: [
      ...EVERYDAY,
      'waking-up',
      'salawat',
      'praises-of-allah',
      'istighfar',
      'clothes',
      'food-drink',
      'lavatory-wudu',
      'nightmares',
    ],
  },
  {
    id: 'prayer',
    listIds: [
      'salah',
      'after-salah',
      'adhan-masjid',
      'quranic-duas',
      'lavatory-wudu',
      'istikharah',
      'salawat',
      'names-of-allah',
      'istighfar',
      'hajj-umrah',
    ],
  },
  {
    id: 'home',
    listIds: [
      'home',
      'food-drink',
      'before-sleep',
      'waking-up',
      'clothes',
      'marriage-children',
      'gatherings',
      'social-interactions',
      'lavatory-wudu',
    ],
  },
  {
    id: 'travel',
    listIds: ['travel', 'hajj-umrah', 'nature', 'money-shopping'],
  },
  {
    id: 'hardship',
    listIds: [
      'difficulties-happiness',
      'ruqyah-illness',
      'protection-of-iman',
      'istighfar',
      'nightmares',
      'death',
    ],
  },
];

const LABELS: Record<AdhkarGroupId, string> = {
  daily: 'Daily',
  prayer: 'Prayer',
  home: 'Home',
  travel: 'Travel',
  hardship: 'Hardship',
  all: 'All',
};

function allListIds(): string[] {
  const rest = ADHKAR_LISTS.map(l => l.id).filter(
    id => !(EVERYDAY as readonly string[]).includes(id),
  );
  return [...EVERYDAY, ...rest];
}

/** The chips, in order, each with the lists it holds (known lists only). */
export function adhkarGroups(): AdhkarGroup[] {
  const known = new Set(ADHKAR_LISTS.map(l => l.id));
  const groups = [...GROUPS, {id: 'all' as const, listIds: allListIds()}];
  return groups.map(group => ({
    ...group,
    label: LABELS[group.id],
    listIds: group.listIds.filter(id => known.has(id)),
  }));
}

/** A group's lists split into big cards and the smaller ones after them. */
export function groupLists(groupId: AdhkarGroupId): {
  featured: AdhkarList[];
  rest: AdhkarList[];
} {
  const group = adhkarGroups().find(g => g.id === groupId);
  const lists = (group?.listIds ?? []).flatMap(id => {
    const list = adhkarList(id);
    return list ? [list] : [];
  });
  return {
    featured: lists.slice(0, FEATURED_COUNT),
    rest: lists.slice(FEATURED_COUNT),
  };
}

/** From this hour until the morning window, before-sleep adhkar fit best. */
const BEFORE_SLEEP_HOUR = 21;

/**
 * The list that fits the time: morning and evening by the phone's windows
 * (morning 04:00 to 14:59, evening 15:00 to 03:59), with before sleep taking
 * over the night from 21:00.
 */
export function nowListId(date: Date): string {
  if (adhkarWindowAt(date.getTime()) === 'morning') return 'morning-adhkar';
  const hour = date.getHours();
  return hour >= BEFORE_SLEEP_HOUR || hour < 4
    ? 'before-sleep'
    : 'evening-adhkar';
}

/** A short line for the time of day, under the clock. */
export function periodLabel(date: Date): string {
  const hour = date.getHours();
  if (hour < 4) return 'Night';
  if (hour < 12) return 'Morning';
  if (hour < 15) return 'Afternoon';
  return hour < BEFORE_SLEEP_HOUR ? 'Evening' : 'Night';
}

// Reading pace for the estimate: base letters per second, plus a breath
// after each repetition.
const LETTERS_PER_SECOND = 14;
const BREATH_SECONDS = 0.6;
const DIACRITICS = /[ً-ٰٟۖ-ۭـ\s]/g;

/** Arabic letters without diacritics or spaces (how long it is to say). */
export function arabicLength(text: string): number {
  return text.replace(DIACRITICS, '').length;
}

const minutesCache = new Map<string, number>();

/**
 * Roughly how long a list takes to recite, in whole minutes (at least 1):
 * the words to say (narration left out), each as many times as it is said.
 */
export function estimateMinutes(listId: string): number {
  const cached = minutesCache.get(listId);
  if (cached !== undefined) return cached;
  let seconds = 0;
  for (const dhikr of adhkarForList(listId)) {
    const said = parseAdhkarArabic(dhikr.arabic)
      .filter(s => s.kind !== 'narration')
      .reduce((n, s) => n + arabicLength(s.text), 0);
    seconds += (said / LETTERS_PER_SECOND + BREATH_SECONDS) * dhikr.repeatCount;
  }
  const minutes = Math.max(1, Math.round(seconds / 60));
  minutesCache.set(listId, minutes);
  return minutes;
}

/** "24 adhkar", "1 dhikr". */
export function countLabel(count: number): string {
  return count === 1 ? '1 dhikr' : `${count} adhkar`;
}

/** "24 adhkar · 14 min". */
export function listSubtitle(listId: string, withMinutes: boolean): string {
  const count = adhkarForList(listId).length;
  if (!withMinutes) return countLabel(count);
  return `${countLabel(count)} · ${estimateMinutes(listId)} min`;
}

function parseHex(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map(c => c + c)
          .join('')
      : value;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** `a` mixed toward `b` by `amount` (0 keeps a, 1 gives b), as #rrggbb. */
export function mixHex(a: string, b: string, amount: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  const t = Math.max(0, Math.min(1, amount));
  const mix = (x: number, y: number): string =>
    Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, '0');
  return `#${mix(ar, br)}${mix(ag, bg)}${mix(ab, bb)}`;
}

const INK = '#06151c';

/** The list's card gradient: its colour into a deeper shade of it. */
export function listGradient(color: string): [string, string] {
  return [mixHex(color, INK, 0.1), mixHex(color, INK, 0.55)];
}
