/**
 * Search for the TV app on the phone's engine (utils/search): the same
 * normalisation, tiers, transliteration skeletons and typo budget, so both
 * apps find the same things for the same words.
 *
 * The phone's `catalog.ts` can't be imported here (it reaches i18n and the
 * phone's reciter store), so its two small wrappers, the surah index with
 * numbers / "surah" prefix / aliases and the reciter index with the featured
 * boost, are mirrored below over the TV's own reciter type. On top of them the
 * TV adds adhkar lists and verse references ("2:255", "ayat al kursi",
 * "kahf 10").
 */
import {SURAHS, type Surah} from '../../../data/surahData';
import {SURAH_ALIASES} from '../../../data/searchAliases';
import {FEATURED_RECITER_NAMES} from '../../../data/featuredReciters';
import {
  createSearchIndex,
  TIER,
  type SearchHit,
  type SearchIndex,
} from '../../../utils/search/createSearchIndex';
import {
  normalizeSearchText,
  toSearchKey,
  tokenize,
} from '../../../utils/search/normalize';
import ADHKAR from '../../../data/adhkar.json';
import {ADHKAR_LISTS, type AdhkarList} from '../../data/adhkarLists';
import {surahsInJuz} from '../browseCatalog';
import type {Reciter} from '../../types/reciter';

export {TIER};

// "surah 36", "sura yasin", "سورة يس": the prefix word carries no meaning.
// Same pattern as utils/search/catalog.ts.
const SURAH_PREFIX = /^(surah|surat|sura|soorah|سوره|سورت)\s+/;
const FEATURED = new Set(FEATURED_RECITER_NAMES);

/**
 * TV-only surah names, on top of the phone's shared SURAH_ALIASES (which
 * stay as they are so both apps keep ranking alike). Browse shows a
 * "Juz ʿAmma" tile, so typing it has to find the juz's first surah.
 */
export const TV_SURAH_ALIASES: Readonly<Record<number, readonly string[]>> = {
  78: ['Juz Amma', 'Juz ʿAmma', 'جزء عم'],
};

// "juz 30", "juz30", "جزء ٣٠" (the hamza folds away in the search key): a
// juz by number, never a verse of a surah called "juz".
const JUZ_NUMBER = /^(?:juz|juzz|jus|para|جز)\s*(\d{1,2})$/;

export const JUZ_COUNT = 30;

/** The number a "juz N" query names, in range or not, or null. */
export function juzNumber(query: string): number | null {
  const match = toSearchKey(query).match(JUZ_NUMBER);
  return match ? Number(match[1]) : null;
}

/** The juz a query names by number (1-30), or null. */
export function parseJuz(query: string): number | null {
  const juz = juzNumber(query);
  return juz !== null && juz >= 1 && juz <= JUZ_COUNT ? juz : null;
}

/**
 * "Ash-Sharh" -> "Sharh": the name without its article, so a few typed
 * letters ("sh") rank the surah as a starts-with match, level with a reciter
 * whose name starts that way, instead of a word-start one below it.
 */
export function surahNameWithoutArticle(name: string): string {
  const bare = name.replace(/^(al|an|ar|as|ash|at|ad|adh|az)-/i, '');
  return bare === name ? '' : bare;
}

/**
 * utils/search/catalog.ts createSurahSearch, plus one field: the name
 * without its article (see surahNameWithoutArticle).
 */
export function createSurahSearch(
  surahs: readonly Surah[],
): SearchIndex<Surah> {
  const index = createSearchIndex(surahs, {
    fields: [
      {get: surah => surah.name, weight: 1},
      {get: surah => surahNameWithoutArticle(surah.name), weight: 1},
      {get: surah => surah.name_arabic, weight: 1},
      {get: surah => surah.translated_name_english, weight: 0.8},
      {get: surah => SURAH_ALIASES[surah.id] ?? [], weight: 0.9},
      {get: surah => TV_SURAH_ALIASES[surah.id] ?? [], weight: 0.9},
    ],
  });
  return {
    search(query: string, limit?: number): SearchHit<Surah>[] {
      const key = toSearchKey(query);
      const unprefixed = key.replace(SURAH_PREFIX, '');
      if (/^\d+$/.test(unprefixed)) {
        const surah = surahs.find(item => item.id === Number(unprefixed));
        return surah ? [{item: surah, score: TIER.exact}] : [];
      }
      const tokens = tokenize(unprefixed);
      const numbers = new Set(
        tokens.filter(token => /^\d+$/.test(token)).map(Number),
      );
      if (numbers.size === 0 && unprefixed === key) {
        return index.search(query, limit);
      }
      const text = tokens.filter(token => !/^\d+$/.test(token)).join(' ');
      const hits = index.search(text);
      // "Al-Fatihah (1)": the number picks among name matches.
      const numbered = hits.filter(hit => numbers.has(hit.item.id));
      return (numbered.length > 0 ? numbered : hits).slice(0, limit);
    },
  };
}

/** utils/search/catalog.ts createReciterSearch, over the TV reciter shape. */
export function createReciterSearch(
  reciters: readonly Reciter[],
): SearchIndex<Reciter> {
  return createSearchIndex(reciters, {
    fields: [
      {get: reciter => reciter.name, weight: 1},
      {get: reciter => reciter.name_arabic ?? '', weight: 1},
      {get: reciter => reciter.rewayat.map(r => r.name), weight: 0.6},
      {get: reciter => reciter.rewayat.map(r => r.style), weight: 0.4},
    ],
    boost: reciter =>
      FEATURED.has(reciter.name) || reciter.is_featured ? 1 : 0,
  });
}

// ── Adhkar ───────────────────────────────────────────────────────────────────

/** Names people search for a list by, beyond its own title. */
export const ADHKAR_ALIASES: Readonly<Record<string, readonly string[]>> = {
  'morning-adhkar': [
    'Morning adhkar',
    'Morning remembrance',
    'Adhkar as-sabah',
    'Sabah',
    'After Fajr',
    'الصباح',
  ],
  'evening-adhkar': [
    'Evening adhkar',
    'Evening remembrance',
    'Adhkar al-masa',
    'Masa',
    'After Asr',
    'المساء',
  ],
  'before-sleep': ['Sleep', 'Bedtime', 'Night', 'Adhkar an-nawm', 'النوم'],
  'waking-up': ['Wake up', 'Morning waking', 'الاستيقاظ'],
  salah: ['Prayer', 'Salat', 'Namaz', 'الصلاة'],
  'after-salah': ['After prayer', 'Tasbih after prayer', 'Tasbeeh'],
  salawat: [
    'Durood',
    'Darood',
    'Salawat on the Prophet',
    'Blessings on the Prophet',
    'الصلاة على النبي',
  ],
  'praises-of-allah': ['Tasbih', 'Tahmid', 'Takbir', 'Dhikr', 'SubhanAllah'],
  istighfar: [
    'Sayyid al-Istighfar',
    'Seeking forgiveness',
    'Forgiveness',
    'Repentance',
    'Tawbah',
    'Astaghfirullah',
    'سيد الاستغفار',
  ],
  nightmares: ['Bad dream', 'Fear at night'],
  'protection-of-iman': ['Faith', 'Iman', 'Protection'],
  'difficulties-happiness': [
    'Anxiety',
    'Worry',
    'Grief',
    'Sadness',
    'Distress',
    'Hardship',
    'Shukr',
    'Giving thanks',
  ],
  'quranic-duas': ['Rabbana', 'Duas from the Quran'],
  'names-of-allah': ['Asma ul Husna', 'Asma al-Husna', 'أسماء الله الحسنى'],
  clothes: ['Getting dressed', 'New clothes'],
  'lavatory-wudu': ['Wudu', 'Ablution', 'Bathroom', 'Toilet', 'Restroom'],
  'adhan-masjid': ['Adhan', 'Azan', 'Athan', 'Mosque', 'Masjid'],
  home: ['Leaving home', 'Entering home', 'House'],
  istikharah: ['Istikhara', 'Guidance', 'Decision'],
  gatherings: ['Kaffarat al-majlis', 'Assembly', 'Sitting'],
  'food-drink': ['Eating', 'Food', 'Drinking', 'Iftar', 'Breaking fast'],
  travel: ['Safar', 'Journey', 'Car', 'Riding', 'Flight'],
  nature: ['Rain', 'Wind', 'Thunder', 'New moon'],
  'social-interactions': ['Sneezing', 'Salam', 'Greeting', 'Anger'],
  'hajj-umrah': ['Hajj', 'Umrah', 'Talbiyah', 'Arafat'],
  'marriage-children': ['Marriage', 'Wedding', 'Children', 'Newborn'],
  death: ['Funeral', 'Janazah', 'Graves', 'Condolence'],
  'ruqyah-illness': ['Ruqyah', 'Shifa', 'Healing', 'Illness', 'Sick', 'Pain'],
  'money-shopping': ['Debt', 'Money', 'Market', 'Shopping', 'Rizq'],
};

type CategoryRow = {id: string; title: string};
const CATEGORY_TITLES = new Map(
  ((ADHKAR as {categories: CategoryRow[]}).categories ?? []).map(c => [
    c.id,
    c.title.trim(),
  ]),
);

export function createAdhkarSearch(
  lists: readonly AdhkarList[],
): SearchIndex<AdhkarList> {
  return createSearchIndex(lists, {
    fields: [
      {get: list => list.title, weight: 1},
      {get: list => list.arabicTitle, weight: 1},
      {get: list => ADHKAR_ALIASES[list.id] ?? [], weight: 0.9},
      {
        get: list =>
          list.categoryIds.flatMap(id => {
            const title = CATEGORY_TITLES.get(id);
            return title ? [title] : [];
          }),
        weight: 0.5,
      },
    ],
    // Morning and evening sit first in the phone's list; keep them first on
    // ties ("adhkar", "dhikr").
    boost: list => (list.section === 'main' ? 0.5 : 0),
  });
}

// ── Verses ───────────────────────────────────────────────────────────────────

export type VerseRef = {
  surah: Surah;
  ayah: number;
  /** A verse's common name ("Ayat al-Kursi"), when it has one. */
  name: string | null;
};

type NamedVerse = {
  surah: number;
  ayah: number;
  name: string;
  /** Names people type for it. */
  names: readonly string[];
  /** Descriptions, weighted below names so "light" stays An-Nur the surah. */
  descriptions: readonly string[];
};

export const NAMED_VERSES: readonly NamedVerse[] = [
  {
    surah: 2,
    ayah: 255,
    name: 'Ayat al-Kursi',
    names: [
      'Ayat al-Kursi',
      'Ayatul Kursi',
      'Ayat ul Kursi',
      'Ayat Kursi',
      'Kursi',
      'آية الكرسي',
    ],
    descriptions: ['Throne verse', 'Verse of the Throne'],
  },
  {
    surah: 2,
    ayah: 285,
    name: 'Amana ar-Rasul',
    names: ['Amana ar-Rasul', 'Amanar Rasul', 'آمن الرسول'],
    descriptions: [
      'Last two verses of Al-Baqarah',
      'End of Al-Baqarah',
      'Akhir al-Baqarah',
    ],
  },
  {
    surah: 24,
    ayah: 35,
    name: 'Ayat an-Nur',
    names: ['Ayat an-Nur', 'Ayatun Nur', 'آية النور'],
    descriptions: ['Verse of Light', 'Light verse'],
  },
];

const VERSE_INDEX = createSearchIndex(NAMED_VERSES, {
  fields: [
    {get: verse => verse.names, weight: 0.95},
    {get: verse => verse.descriptions, weight: 0.7},
  ],
  keyboardFallback: false,
});

const surahById = new Map(SURAHS.map(s => [s.id, s]));

function verseName(surah: number, ayah: number): string | null {
  return (
    NAMED_VERSES.find(v => v.surah === surah && v.ayah === ayah)?.name ?? null
  );
}

function makeRef(surahNumber: number, ayah: number): VerseRef | null {
  const surah = surahById.get(surahNumber);
  if (!surah || ayah < 1 || ayah > surah.verses_count) return null;
  return {surah, ayah, name: verseName(surahNumber, ayah)};
}

/**
 * "2:255", "2 : 255", "surah 2:255", "٢:٢٥٥": the mushaf search's n:m form
 * (components/mushaf/MushafSearchView parseSearchQuery), also with a dot.
 * Null when it isn't a reference or names a verse that doesn't exist.
 */
export function parseVerseRef(query: string): VerseRef | null {
  const q = normalizeSearchText(query).replace(SURAH_PREFIX, '');
  const match = q.match(/^(\d{1,3})\s*[:.]\s*(\d{1,3})$/);
  if (!match) return null;
  return makeRef(Number(match[1]), Number(match[2]));
}

// ── Combined ─────────────────────────────────────────────────────────────────

export type SearchItem =
  | {type: 'surah'; item: Surah}
  | {type: 'reciter'; item: Reciter}
  | {type: 'adhkar'; item: AdhkarList}
  | {type: 'verse'; item: VerseRef};

export type RankedItem = SearchItem & {score: number};

export type SearchKind = SearchItem['type'];

export interface GroupedResults {
  /** The best match across every kind, or null when nothing matched. */
  top: SearchItem | null;
  /** Everything that matched, best first (the suggestions come from here). */
  ranked: RankedItem[];
  /** The sections under the top result; the top item is left out of its own. */
  surahs: Surah[];
  reciters: Reciter[];
  adhkar: AdhkarList[];
}

export const EMPTY_RESULTS: GroupedResults = {
  top: null,
  ranked: [],
  surahs: [],
  reciters: [],
  adhkar: [],
};

const LIMITS = {surahs: 12, reciters: 12, adhkar: 8};

// Below these scores a match is noise for that kind: a long category title
// that shares one short word, a typo-budget hit on an alias ("fatiha" finding
// "Faith"), or a fuzzy hit on a verse nickname. Skeleton and fuzzy adhkar
// hits score 20-45 and are almost never what was meant.
export const MIN_ADHKAR_SCORE = 40;
const MIN_VERSE_SCORE = 40;

// On equal scores: an explicit verse reference, then surahs (the phone puts
// surahs first), named verses, adhkar, reciters.
const KIND_ORDER: Record<SearchKind, number> = {
  verse: 1,
  surah: 0,
  adhkar: 3,
  reciter: 4,
};

/** A surah name plus a verse number ("kahf 10" -> 18:10). */
function nameAndVerse(
  query: string,
  surahIndex: SearchIndex<Surah>,
): VerseRef | null {
  const tokens = tokenize(toSearchKey(query).replace(SURAH_PREFIX, ''));
  const numbers = tokens.filter(t => /^\d+$/.test(t));
  if (numbers.length !== 1 || tokens.length < 2) return null;
  const text = tokens.filter(t => !/^\d+$/.test(t)).join(' ');
  const best = surahIndex.search(text, 1)[0];
  if (!best || best.score < TIER.wordPrefix * 0.8) return null;
  const n = Number(numbers[0]);
  // "Al-Fatihah 1" names the surah, not its first verse.
  if (n === best.item.id) return null;
  return makeRef(best.item.id, n);
}

export function createTvSearch(
  reciters: readonly Reciter[],
  options: {
    surahs?: readonly Surah[];
    adhkar?: readonly AdhkarList[];
  } = {},
): {search(query: string): GroupedResults} {
  const surahIndex = createSurahSearch(options.surahs ?? SURAHS);
  const reciterIndex = createReciterSearch(reciters);
  const adhkarIndex = createAdhkarSearch(options.adhkar ?? ADHKAR_LISTS);

  return {
    search(query: string): GroupedResults {
      const key = toSearchKey(query);
      if (!key) return EMPTY_RESULTS;

      // "juz 31" names no juz; it is never a verse of An-Naba (whose
      // "Juz Amma" alias would otherwise read it as 78:31).
      if (juzNumber(query) !== null && parseJuz(query) === null) {
        return EMPTY_RESULTS;
      }
      const ranked: RankedItem[] = [];
      const juz = parseJuz(query);
      const ref = juz
        ? null
        : (parseVerseRef(query) ?? nameAndVerse(query, surahIndex));
      if (juz) {
        // The juz's surahs in mushaf order; the first (where it starts)
        // is the top result.
        surahsInJuz(juz, options.surahs ?? SURAHS).forEach((surah, i) =>
          ranked.push({
            type: 'surah',
            item: surah,
            score: TIER.exact - i / 100,
          }),
        );
      } else if (ref) {
        // Above any name match: the person typed exactly which verse.
        ranked.push({type: 'verse', item: ref, score: TIER.exact + 5});
        ranked.push({type: 'surah', item: ref.surah, score: TIER.exact});
      } else {
        surahIndex
          .search(query)
          .forEach(hit =>
            ranked.push({type: 'surah', item: hit.item, score: hit.score}),
          );
        // A bare number is a surah reference; nothing else matches digits.
        if (!/^\d+$/.test(key.replace(SURAH_PREFIX, ''))) {
          reciterIndex
            .search(query)
            .forEach(hit =>
              ranked.push({type: 'reciter', item: hit.item, score: hit.score}),
            );
          adhkarIndex.search(query).forEach(hit => {
            if (hit.score >= MIN_ADHKAR_SCORE) {
              ranked.push({type: 'adhkar', item: hit.item, score: hit.score});
            }
          });
          VERSE_INDEX.search(query).forEach(hit => {
            const named = makeRef(hit.item.surah, hit.item.ayah);
            if (named && hit.score >= MIN_VERSE_SCORE) {
              ranked.push({type: 'verse', item: named, score: hit.score});
            }
          });
        }
      }

      ranked.sort(
        (a, b) => b.score - a.score || KIND_ORDER[a.type] - KIND_ORDER[b.type],
      );
      const top = ranked[0] ?? null;
      const isTop = (item: SearchItem): boolean =>
        top !== null && top.type === item.type && top.item === item.item;
      // Each kind's items, typed by the caller (Vega's older TypeScript
      // can't narrow an indexed Extract through a generic).
      const pick = (kind: SearchKind, limit: number): unknown[] =>
        ranked
          .filter(r => r.type === kind && !isTop(r))
          .slice(0, limit)
          .map(r => r.item);

      return {
        top: top ? ({type: top.type, item: top.item} as SearchItem) : null,
        ranked,
        surahs: pick('surah', LIMITS.surahs) as Surah[],
        reciters: pick('reciter', LIMITS.reciters) as Reciter[],
        adhkar: pick('adhkar', LIMITS.adhkar) as AdhkarList[],
      };
    },
  };
}
