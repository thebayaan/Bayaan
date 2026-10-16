/**
 * Pure helpers behind the browse screens (Surahs, Reciters, Reciter page):
 * surah filters and juz grouping, rewayah and style classification, and the
 * short labels the TV shows for them. No React, no storage: unit tested.
 */
import SURAH_DATA from '../../data/surahData.json';
import type {Reciter, Rewayah, Surah} from '../types/reciter';

export const SURAHS: readonly Surah[] = SURAH_DATA as Surah[];

// ---------------------------------------------------------------------------
// Surahs

export type SurahFilter = 'all' | 'juz' | 'short' | 'makki' | 'madani';

/** First page of each juz in the 604-page Madani mushaf (juz 1 at index 0). */
export const JUZ_START_PAGES: readonly number[] = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322,
  342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
];

/** A surah is "short" when it fits on at most this many mushaf pages. */
export const SHORT_MAX_PAGES = 2;

export function surahPageRange(surah: Surah): [number, number] {
  const [from, to] = surah.pages.split('-').map(n => parseInt(n, 10));
  const start = Number.isFinite(from) ? from : 1;
  const end = Number.isFinite(to) ? to : start;
  return [start, end];
}

/** The juz (1-30) a mushaf page belongs to. */
export function juzForPage(page: number): number {
  let juz = 1;
  for (let i = 0; i < JUZ_START_PAGES.length; i++) {
    if (page >= JUZ_START_PAGES[i]) juz = i + 1;
  }
  return juz;
}

/** Every juz a surah's pages fall in, in order (Al-Baqarah: 1, 2, 3). */
export function juzOfSurah(surah: Surah): number[] {
  const [start, end] = surahPageRange(surah);
  const first = juzForPage(start);
  const last = juzForPage(end);
  const out: number[] = [];
  for (let j = first; j <= last; j++) out.push(j);
  return out;
}

/** The surahs that have verses in a juz, in mushaf order. */
export function surahsInJuz(
  juz: number,
  surahs: readonly Surah[] = SURAHS,
): Surah[] {
  return surahs.filter(s => juzOfSurah(s).includes(juz));
}

export function isShortSurah(surah: Surah): boolean {
  const [start, end] = surahPageRange(surah);
  return end - start + 1 <= SHORT_MAX_PAGES;
}

export function filterSurahs(
  filter: SurahFilter,
  juz: number,
  surahs: readonly Surah[] = SURAHS,
): Surah[] {
  switch (filter) {
    case 'juz':
      return surahsInJuz(juz, surahs);
    case 'short':
      return surahs.filter(isShortSurah);
    case 'makki':
      return surahs.filter(s => s.revelation_place === 'Makkah');
    case 'madani':
      return surahs.filter(s => s.revelation_place === 'Madinah');
    default:
      return surahs.slice();
  }
}

// ---------------------------------------------------------------------------
// Rewayat and styles

export type RewayahFamily = 'hafs' | 'warsh' | 'qalun' | 'duri' | 'more';
export type RecitationStyle = 'murattal' | 'mujawwad' | 'teaching' | 'other';

export function rewayahFamily(name: string): RewayahFamily {
  if (/^hafs/i.test(name)) return 'hafs';
  if (/warsh/i.test(name)) return 'warsh';
  if (/qalon|qalun/i.test(name)) return 'qalun';
  if (/dori|dorai|duri/i.test(name)) return 'duri';
  return 'more';
}

export function recitationStyle(style: string): RecitationStyle {
  if (/murattal|murattl|morattal/i.test(style)) return 'murattal';
  if (/mojawwad|mujawwad|mujawad/i.test(style)) return 'mujawwad';
  if (/molim|mo'?allim|muallim|mu'?allim|teach/i.test(style)) {
    return 'teaching';
  }
  return 'other';
}

/** "Murattal", "Mujawwad", "Teaching"; numbered variants keep their number. */
export function styleLabel(style: string): string {
  const kind = recitationStyle(style);
  const suffix = style.match(/\d+/)?.[0];
  const base =
    kind === 'murattal'
      ? 'Murattal'
      : kind === 'mujawwad'
        ? 'Mujawwad'
        : kind === 'teaching'
          ? 'Teaching'
          : style.trim()
            ? style.trim().charAt(0).toUpperCase() + style.trim().slice(1)
            : 'Recitation';
  return suffix && kind !== 'other' ? `${base} ${suffix}` : base;
}

type RewayahName = {short: string; full: string};

/**
 * Display names for the strings the API stores in rewayat.name (see the
 * phone's data/rewayat.ts registry), most specific first.
 */
const REWAYAH_NAMES: ReadonlyArray<[RegExp, RewayahName]> = [
  [/warsh.*azraq/i, {short: 'Warsh', full: "Warsh 'an Nafi' (al-Azraq)"}],
  [/warsh.*asbahani/i, {short: 'Warsh', full: "Warsh 'an Nafi' (al-Asbahani)"}],
  [/qalon.*nasheet/i, {short: 'Qalun', full: "Qalun 'an Nafi' (Abu Nashit)"}],
  [/^hafs/i, {short: 'Hafs', full: "Hafs 'an 'Asim"}],
  [/warsh/i, {short: 'Warsh', full: "Warsh 'an Nafi'"}],
  [/qalon|qalun/i, {short: 'Qalun', full: "Qalun 'an Nafi'"}],
  [/dorai.*kisa/i, {short: 'Ad-Duri', full: "Ad-Duri 'an al-Kisa'i"}],
  [/dori|duri/i, {short: 'Ad-Duri', full: "Ad-Duri 'an Abi 'Amr"}],
  [/shu.?bah/i, {short: "Shu'bah", full: "Shu'bah 'an 'Asim"}],
  [/sosi|susi/i, {short: 'As-Susi', full: "As-Susi 'an Abi 'Amr"}],
  [/khalaf/i, {short: 'Khalaf', full: "Khalaf 'an Hamzah"}],
  [
    /thakwan|dhakwan/i,
    {short: 'Ibn Dhakwan', full: "Ibn Dhakwan 'an Ibn 'Amir"},
  ],
  [/hesham|hisham/i, {short: 'Hisham', full: "Hisham 'an Ibn 'Amir"}],
  [
    /bizi and qunbol/i,
    {short: 'Al-Bazzi & Qunbul', full: "Al-Bazzi & Qunbul 'an Ibn Kathir"},
  ],
  [/bizi/i, {short: 'Al-Bazzi', full: "Al-Bazzi 'an Ibn Kathir"}],
  [/qunbol|qunbul/i, {short: 'Qunbul', full: "Qunbul 'an Ibn Kathir"}],
  [/rowis|ruways/i, {short: 'Ruways & Rawh', full: "Ruways & Rawh 'an Ya'qub"}],
  [/jammaz/i, {short: 'Ibn Jammaz', full: "Ibn Jammaz 'an Abi Ja'far"}],
];

function lookupRewayahName(name: string): RewayahName | null {
  for (const [pattern, value] of REWAYAH_NAMES) {
    if (pattern.test(name)) return value;
  }
  return null;
}

/** "Hafs 'an 'Asim" for "Hafs A'n Assem"; unknown names pass through. */
export function rewayahDisplayName(name: string): string {
  return lookupRewayahName(name)?.full ?? name;
}

/** "Hafs", "Warsh", "Ad-Duri"...; unknown names keep their first word. */
export function rewayahShortName(name: string): string {
  return lookupRewayahName(name)?.short ?? name.split(/\s+/)[0] ?? name;
}

/** One rewayah as the reciter page tabs show it, with its style variants. */
export type RewayahGroup = {
  key: string;
  label: string;
  items: Rewayah[];
};

/**
 * Groups a reciter's rewayat by rewayah name (the API lists one entry per
 * rewayah and style), keeping the API's order; inside a group murattal comes
 * first, then mujawwad, teaching and the rest.
 */
export function groupRewayat(rewayat: readonly Rewayah[]): RewayahGroup[] {
  const order: RecitationStyle[] = [
    'murattal',
    'mujawwad',
    'teaching',
    'other',
  ];
  const groups = new Map<string, RewayahGroup>();
  for (const r of rewayat) {
    const key = rewayahDisplayName(r.name);
    const group = groups.get(key);
    if (group) group.items.push(r);
    else groups.set(key, {key, label: rewayahShortName(r.name), items: [r]});
  }
  const out = Array.from(groups.values());
  for (const g of out) {
    g.items = g.items
      .map((r, i) => ({r, i}))
      .sort(
        (a, b) =>
          order.indexOf(recitationStyle(a.r.style)) -
            order.indexOf(recitationStyle(b.r.style)) || a.i - b.i,
      )
      .map(x => x.r);
  }
  // Two groups with the same short name (e.g. Warsh and Warsh al-Azraq)
  // would read the same as tabs: fall back to their full names.
  const shortCounts = new Map<string, number>();
  out.forEach(g =>
    shortCounts.set(g.label, (shortCounts.get(g.label) ?? 0) + 1),
  );
  out.forEach(g => {
    if ((shortCounts.get(g.label) ?? 0) > 1) g.label = g.key;
  });
  return out;
}

/** "Hafs", "Hafs, Warsh", "Hafs · 3 styles", "Hafs · Mujawwad". */
export function reciterSubtitle(reciter: Reciter): string {
  const rewayat = reciter.rewayat ?? [];
  if (rewayat.length === 0) return '';
  const names: string[] = [];
  for (const r of rewayat) {
    const short = rewayahShortName(r.name);
    if (!names.includes(short)) names.push(short);
  }
  if (names.length > 1) {
    const shown = names.slice(0, 2).join(', ');
    return names.length > 2 ? `${shown} +${names.length - 2}` : shown;
  }
  const styles = new Set(rewayat.map(r => styleLabel(r.style)));
  if (styles.size > 1) return `${names[0]} · ${styles.size} styles`;
  const only = recitationStyle(rewayat[0].style);
  if (only !== 'murattal')
    return `${names[0]} · ${styleLabel(rewayat[0].style)}`;
  return names[0];
}

// ---------------------------------------------------------------------------
// Reciters grid

export type RewayahChip = 'all' | RewayahFamily;
export type StyleChip = Exclude<RecitationStyle, 'other'>;

export const REWAYAH_CHIPS: ReadonlyArray<{key: RewayahChip; label: string}> = [
  {key: 'all', label: 'All'},
  {key: 'hafs', label: 'Hafs'},
  {key: 'warsh', label: 'Warsh'},
  {key: 'qalun', label: 'Qalun'},
  {key: 'duri', label: 'Ad-Duri'},
  {key: 'more', label: 'More rewayat'},
];

export const STYLE_CHIPS: ReadonlyArray<{key: StyleChip; label: string}> = [
  {key: 'murattal', label: 'Murattal'},
  {key: 'mujawwad', label: 'Mujawwad'},
  {key: 'teaching', label: 'Teaching'},
];

/**
 * Whether a reciter has a recording matching both chips. The style is
 * checked on the same rewayah entries the rewayah chip matched, so "Warsh +
 * Mujawwad" means a Warsh recording in the mujawwad style.
 */
export function matchesChips(
  reciter: Reciter,
  rewayah: RewayahChip,
  style: StyleChip | null,
): boolean {
  // No filter: everyone, even a reciter whose rewayat haven't loaded.
  if (rewayah === 'all' && style === null) return true;
  return (reciter.rewayat ?? []).some(
    r =>
      (rewayah === 'all' || rewayahFamily(r.name) === rewayah) &&
      (style === null || recitationStyle(r.style) === style),
  );
}

/** The chips that would leave at least one reciter in the grid. */
export function availableChips(reciters: readonly Reciter[]): {
  rewayah: Set<RewayahChip>;
  style: Set<StyleChip>;
} {
  const rewayah = new Set<RewayahChip>(['all']);
  const style = new Set<StyleChip>();
  for (const reciter of reciters) {
    for (const r of reciter.rewayat ?? []) {
      rewayah.add(rewayahFamily(r.name));
      const s = recitationStyle(r.style);
      if (s !== 'other') style.add(s);
    }
  }
  return {rewayah, style};
}

/**
 * The phone's featured reciters (data/featuredReciters.ts), in its order.
 * Copied rather than imported: that module pulls in the phone's reciter store.
 */
export const FEATURED_RECITER_NAMES: readonly string[] = [
  'Albaraa Basfar',
  'Mishary Alafasi',
  'Abdulbasit Abdulsamad',
  'Mahmoud Khalil Al-Hussary',
  'Mohammed Siddiq Al-Minshawi',
  'Abdulrahman Alsudaes',
  'Saud Al-Shuraim',
  'Mohammed Ayyub',
  'Mohammed Jibreel',
  'Maher Al Meaqly',
  'Hazem Hassan',
  'Ahmad Deban',
  'Mohammed Hamed',
  'Ahmad Talib bin Humaid',
  'Idrees Abkr',
  'Abdullah Al-Johany',
  'Ahmad Al-Ajmy',
  'Saad Al-Ghamdi',
  'Mahmoud Ali Albanna',
  'Yasser Al-Dosari',
  'Ayyub Asif',
  'Haitham Aldukhain',
];

function nameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const FEATURED_RANK = new Map<string, number>(
  FEATURED_RECITER_NAMES.map((n, i) => [nameKey(n), i]),
);

/**
 * Featured reciters first (the phone's list order, then any other the API
 * flags as featured), then everyone else in their original order.
 */
export function featuredFirst(reciters: readonly Reciter[]): Reciter[] {
  const rank = (r: Reciter): number =>
    FEATURED_RANK.get(nameKey(r.name)) ??
    (r.is_featured ? FEATURED_RECITER_NAMES.length : Number.MAX_SAFE_INTEGER);
  return reciters
    .map((r, i) => ({r, i, k: rank(r)}))
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map(x => x.r);
}

/** The rewayah the Surahs screen plays a default reciter's surahs from. */
export function pickPlayableRewayah(
  rewayat: readonly Rewayah[],
  surahNumber: number,
): Rewayah | null {
  const withSurah = rewayat.filter(r => r.surah_list.includes(surahNumber));
  const pool = withSurah.length > 0 ? withSurah : rewayat;
  const isHafs = (r: Rewayah): boolean => rewayahFamily(r.name) === 'hafs';
  const isMurattal = (r: Rewayah): boolean =>
    recitationStyle(r.style) === 'murattal';
  return (
    pool.find(r => isHafs(r) && isMurattal(r)) ??
    pool.find(isHafs) ??
    pool.find(isMurattal) ??
    pool[0] ??
    null
  );
}
