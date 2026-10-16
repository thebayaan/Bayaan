// scripts/adhkar-content/adhkarFixes.ts
// Content fixes for data/adhkar.json (adhkar audit, 2026-10-12). Every step
// is idempotent: applyAllFixes(fixed) equals fixed, which jest checks against
// the committed file (scripts/__tests__/adhkarFixes.test.ts).
// No '@/' imports: tsx scripts import this file.
import {parseEveningRows} from './eveningRows';
import type {EveningRow} from './eveningRows';
import {
  applyMarkerFixes,
  applyNameFixes,
  applyRowFixes,
  applySiteRows,
  applyTranslitMarkerFixes,
  applyTransliterations,
  updateMetaTotals,
} from './textPolish';

export interface SeedRow {
  id: string;
  category_id: string;
  category_name: string;
  arabic: string;
  translation: string | null;
  transliteration: string | null;
  instruction: string | null;
  repeat_count: number;
  audio_url: string | null;
  order_index: number;
  audio_file: string | null;
}

export type SeedCategory = Record<string, unknown> & {
  id: string;
  dhikr_count: number;
};

export interface SeedFile {
  categories: SeedCategory[];
  adhkar: SeedRow[];
  meta: unknown;
  super_category_dhikr_ids?: Record<string, string[]>;
  super_category_audio_overrides?: Record<string, Record<string, string>>;
}

export type FixStep = (seed: SeedFile, eveningMarkdown: string) => SeedFile;

// Key order of every row in data/adhkar.json; kept so the file round-trips.
const ROW_KEYS = [
  'id',
  'category_id',
  'category_name',
  'arabic',
  'translation',
  'transliteration',
  'instruction',
  'repeat_count',
  'audio_url',
  'order_index',
  'audio_file',
];

export const MORNING_AND_EVENING_CATEGORY = '27';
// Morning rows whose evening wording only lived in a bracketed note.
export const EVENING_VARIANT_IDS: readonly string[] = [
  '77',
  '78',
  '80',
  '81',
  '89',
  '90',
];
const FIRST_EVENING_ORDER_INDEX = 24;

// Hisn al-Muslim order. 93, 94, 95 are morning only; 97 is evening only.
export const MORNING_LIST: readonly string[] = [
  '75',
  '76',
  '77',
  '78',
  '79',
  '80',
  '81',
  '82',
  '83',
  '84',
  '85',
  '86',
  '87',
  '88',
  '89',
  '90',
  '91',
  '92',
  '93',
  '94',
  '95',
  '96',
  '98',
];
export const EVENING_LIST: readonly string[] = [
  '75',
  '76',
  'evening-77',
  'evening-78',
  '79',
  'evening-80',
  'evening-81',
  '82',
  '83',
  '84',
  '85',
  '86',
  '87',
  '88',
  'evening-89',
  'evening-90',
  '91',
  '92',
  '96',
  '97',
  '98',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function toSeedRow(value: unknown): SeedRow {
  if (!isRecord(value)) throw new Error('adhkar row must be an object');
  const {
    id,
    category_id,
    category_name,
    arabic,
    translation,
    transliteration,
    instruction,
    repeat_count,
    audio_url,
    order_index,
    audio_file,
  } = value;
  if (
    typeof id !== 'string' ||
    typeof category_id !== 'string' ||
    typeof category_name !== 'string' ||
    typeof arabic !== 'string' ||
    !isNullableString(translation) ||
    !isNullableString(transliteration) ||
    !isNullableString(instruction) ||
    typeof repeat_count !== 'number' ||
    !isNullableString(audio_url) ||
    typeof order_index !== 'number' ||
    !isNullableString(audio_file)
  ) {
    throw new Error(`malformed adhkar row ${String(id)}`);
  }
  const keys = Object.keys(value).join(',');
  if (keys !== ROW_KEYS.join(',')) {
    throw new Error(`adhkar row ${id} has unexpected keys: ${keys}`);
  }
  return {
    id,
    category_id,
    category_name,
    arabic,
    translation,
    transliteration,
    instruction,
    repeat_count,
    audio_url,
    order_index,
    audio_file,
  };
}

function toSeedCategory(value: unknown): SeedCategory {
  if (!isRecord(value)) throw new Error('category must be an object');
  const {id, dhikr_count} = value;
  if (typeof id !== 'string' || typeof dhikr_count !== 'number') {
    throw new Error(`malformed category ${String(id)}`);
  }
  return {...value, id, dhikr_count};
}

function toLists(value: unknown): Record<string, string[]> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value))
    throw new Error('super_category_dhikr_ids is malformed');
  const entries: [string, unknown][] = Object.entries(value);
  const lists: Record<string, string[]> = {};
  for (const [superId, list] of entries) {
    if (!Array.isArray(list)) throw new Error(`${superId} list is malformed`);
    const items: unknown[] = list;
    lists[superId] = items.map(item => {
      if (typeof item !== 'string') throw new Error(`${superId} has a non-id`);
      return item;
    });
  }
  return lists;
}

function toAudioOverrides(
  value: unknown,
): Record<string, Record<string, string>> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw new Error('super_category_audio_overrides is malformed');
  }
  const overrides: Record<string, Record<string, string>> = {};
  for (const [superId, files] of Object.entries(value)) {
    if (!isRecord(files)) throw new Error(`${superId} overrides are malformed`);
    const byDhikr: Record<string, string> = {};
    for (const [dhikrId, file] of Object.entries(files)) {
      if (typeof file !== 'string') {
        throw new Error(`${superId} override ${dhikrId} is not a file name`);
      }
      byDhikr[dhikrId] = file;
    }
    overrides[superId] = byDhikr;
  }
  return overrides;
}

export function parseSeedFile(value: unknown): SeedFile {
  if (
    !isRecord(value) ||
    !Array.isArray(value.categories) ||
    !Array.isArray(value.adhkar)
  ) {
    throw new Error('data/adhkar.json is malformed');
  }
  const categories: unknown[] = value.categories;
  const adhkar: unknown[] = value.adhkar;
  const seed: SeedFile = {
    categories: categories.map(toSeedCategory),
    adhkar: adhkar.map(toSeedRow),
    meta: value.meta,
  };
  const lists = toLists(value.super_category_dhikr_ids);
  if (lists) seed.super_category_dhikr_ids = lists;
  const overrides = toAudioOverrides(value.super_category_audio_overrides);
  if (overrides) seed.super_category_audio_overrides = overrides;
  return seed;
}

// data/adhkar.json is 2-space JSON without a trailing newline.
export function serializeSeedFile(seed: SeedFile): string {
  return JSON.stringify(seed, null, 2);
}

// ---- Morning and evening ---------------------------------------------------

// Where the evening note starts in each field of a morning variant row. The
// note always runs to the end of the field.
const EVENING_NOTE_START = {
  arabic: /\s*\[\s*وإذا أمسى/,
  translation:
    /\s*(\[In the evening:\]|\[For the evening|\(Note: for the evening)/,
  transliteration: /\s+widha amsa qal:/,
  instruction:
    /\s*(\[In the evening:\]|\[For the evening|\(Note: for the evening)/,
};

function cutAt(value: string, marker: RegExp): string {
  const index = value.search(marker);
  return index < 0 ? value : value.slice(0, index).trimEnd();
}

function cutNullableAt(value: string | null, marker: RegExp): string | null {
  return value === null ? null : cutAt(value, marker);
}

export function stripEveningNotes(seed: SeedFile): SeedFile {
  const variants = new Set(EVENING_VARIANT_IDS);
  return {
    ...seed,
    adhkar: seed.adhkar.map(row => {
      if (!variants.has(row.id)) return row;
      return {
        ...row,
        arabic: cutAt(row.arabic, EVENING_NOTE_START.arabic),
        translation: cutNullableAt(
          row.translation,
          EVENING_NOTE_START.translation,
        ),
        transliteration: cutNullableAt(
          row.transliteration,
          EVENING_NOTE_START.transliteration,
        ),
        // Row 77's instruction is the source's mixed morning/evening
        // transliteration ("...likewise, one says in the morning: Amsayna");
        // the curated morning transliteration stays in `transliteration`.
        instruction:
          row.id === '77'
            ? ''
            : cutNullableAt(row.instruction, EVENING_NOTE_START.instruction),
      };
    }),
  };
}

export function applyEveningRows(
  seed: SeedFile,
  eveningRows: readonly EveningRow[],
): SeedFile {
  const expected = EVENING_VARIANT_IDS.map(id => `evening-${id}`);
  const got = eveningRows.map(row => row.id);
  if (got.join(',') !== expected.join(',')) {
    throw new Error(
      `expected evening rows ${expected.join(', ')}, got ${got.join(', ')}`,
    );
  }
  const categoryName = seed.adhkar.find(
    row => row.category_id === MORNING_AND_EVENING_CATEGORY,
  )?.category_name;
  if (!categoryName) throw new Error('category 27 has no rows');
  const built: SeedRow[] = eveningRows.map((row, index) => ({
    id: row.id,
    category_id: MORNING_AND_EVENING_CATEGORY,
    category_name: categoryName,
    arabic: `((${row.arabic}))`,
    translation: row.translation,
    transliteration: row.transliteration,
    instruction: null,
    repeat_count: row.repeatCount,
    audio_url: null,
    order_index: FIRST_EVENING_ORDER_INDEX + index,
    audio_file: null,
  }));
  const eveningIds = new Set(expected);
  const rest = seed.adhkar.filter(row => !eveningIds.has(row.id));
  const lastMorningEvening = rest.findLastIndex(
    row => row.category_id === MORNING_AND_EVENING_CATEGORY,
  );
  return {
    ...seed,
    adhkar: [
      ...rest.slice(0, lastMorningEvening + 1),
      ...built,
      ...rest.slice(lastMorningEvening + 1),
    ],
  };
}

export function setPeriodLists(seed: SeedFile): SeedFile {
  return {
    ...seed,
    super_category_dhikr_ids: {
      'morning-adhkar': [...MORNING_LIST],
      'evening-adhkar': [...EVENING_LIST],
    },
  };
}

export function recountCategories(seed: SeedFile): SeedFile {
  return {
    ...seed,
    categories: seed.categories.map(category => ({
      ...category,
      dhikr_count: seed.adhkar.filter(row => row.category_id === category.id)
        .length,
    })),
  };
}

// ---- Text, count and translation fixes --------------------------------------

export interface RowPatch {
  arabic?: string;
  translation?: string | null;
  transliteration?: string | null;
  instruction?: string | null;
  repeat_count?: number;
}

// Exact values; sources are listed in the adhkar content fix plan (Task 5).
export const TEXT_FIXES: Readonly<Record<string, RowPatch>> = {
  '83': {repeat_count: 7},
  '148': {repeat_count: 7},
  '119': {
    repeat_count: 3,
    arabic:
      '((سُبْحَانَ المَلِكِ القُدُّوسِ)) ثلاثَ مرَّاتٍ والثَّالِثَةُ يَجْهَرُ بها ويَمُدُّ بها صَوتَهُ يقولُ: [رَبِّ الْمَلاَئِكَةِ وَالرُّوحِ].',
  },
  '130': {repeat_count: 3},
  '195': {repeat_count: 100},
  '114': {repeat_count: 3},
  '106': {repeat_count: 33},
  '255': {
    translation:
      'He who uttered:" There is no god but Allah, the One, having no partner with Him, His is the Sovereignty and all praise is due to Him and He is Potent over everything" ten times, he is like one who emancipated four slaves from the progeny of Isma\'il.',
    instruction: '',
  },
  '185': {
    translation:
      'If any one of you is invited, he should accept (the invitation). In case he is fasting, he should pray (in order to bless the inmates of the house), and if he is not fasting he should eat.',
    instruction: '',
  },
  '86': {
    translation:
      'In the name of Allah, when Whose name is mentioned nothing on Earth or in Heaven can cause harm, and He is the Hearer, the Knower (three times)',
  },
  '134': {
    translation:
      '(He should say: (I have believed in Allah and His Messengers.))',
  },
  '133': {
    translation:
      '(Say:) I seek refuge in Allah. (Then you should desist from doing what you are in doubt about.)',
    instruction: '',
  },
  '61': {
    transliteration:
      'Allahumma innee as-alukal-jannah, wa-aAAoothu bika minan-nar.',
  },
  '267': {
    arabic:
      'قَالَ النَّبِيُّ صلى الله عليه وسلم ((إِذَا كَانَ جُنْحُ اللَّيْلِ – أَوْ أَمْسَيْتُم – فَـكُفُّوا صِبْيانَـكُم، فَإِنَّ الشَّيَاطِينَ تَنْتَشِرُ حِينَئِذٍ، فَإِذَا ذَهَبَ سَاعَةٌ مِنَ اللَّيلِ فَخَلُّوهُمْ، وَأَغْلِقُوا الأَبْوَابَ وَاذْكُرُوا اسْمَ اللَّهِ؛ فَإِنَّ الشَّيطَانَ لاَ يَفْتَحُ بَاباً مُغلَقاً، وَأَوْكُوا قِرَبَكُمْ، وَاذْكُرُوا اسْمَ اللَّهِ، وَخَمِّرُوا آنِيَتَكُم، وَاذْكُرُوا اسْمَ اللَّهِ، وَلَوْ أَنْ تَعْرُضُوا عَلَيْهَا شَيْئاً، وَأَطْفِئُوا مَصَابِيحَكُمْ)).',
  },
  'quranic-35': {
    arabic:
      'رَبَّنَا وَأَدْخِلْهُمْ جَنَّاتِ عَدْنٍ الَّتِي وَعَدْتَهُمْ وَمَنْ صَلَحَ مِنْ آبَائِهِمْ وَأَزْوَاجِهِمْ وَذُرِّيَّاتِهِمْ إِنَّكَ أَنْتَ الْعَزِيزُ الْحَكِيمُ وَقِهِمُ السَّيِّئَاتِ وَمَنْ تَقِ السَّيِّئَاتِ يَوْمَئِذٍ فَقَدْ رَحِمْتَهُ وَذَلِكَ هُوَ الْفَوْزُ الْعَظِيمُ',
    translation:
      'Our Lord, and admit them to gardens of perpetual residence which You have promised them and whoever was righteous among their fathers, their spouses and their offspring. Indeed, it is You who is the Exalted in Might, the Wise. And protect them from the evil consequences [of their deeds]. And he whom You protect from evil consequences that Day - You will have given him mercy. And that is the great attainment.',
  },
};

export function applyTextFixes(seed: SeedFile): SeedFile {
  return {
    ...seed,
    adhkar: seed.adhkar.map(row =>
      Object.hasOwn(TEXT_FIXES, row.id) ? {...row, ...TEXT_FIXES[row.id]} : row,
    ),
  };
}

// ---- Audio (user decision 2026-10-13: Alafasy for morning, evening and the
// Quranic duas; Duraihim stays for the rest of Hisn al-Muslim) ---------------

// Rows 72 and 149 pointed at the recordings of 73 and 49. The bundled files
// adhkar_72.mp3 and adhkar_149.mp3 are now the hisnmuslim.com originals.
export const AUDIO_URL_FIXES: Readonly<Record<string, string>> = {
  '72': 'http://www.hisnmuslim.com/audio/ar/72.mp3',
  '149': 'http://www.hisnmuslim.com/audio/ar/149.mp3',
};

// Rows in both lists. Each list plays a cut from its own Alafasy session, so
// the evening list overrides these rows' (morning) audio_file. Row 96 has one
// cut for both lists.
export const EVENING_SHARED_AUDIO_IDS: readonly string[] = [
  '75',
  '76',
  '79',
  '82',
  '83',
  '84',
  '85',
  '86',
  '87',
  '88',
  '91',
  '92',
  '98',
];

export function eveningAudioFile(id: string): string {
  return `adhkar_evening_${id}.mp3`;
}

export function applyAudioFixes(seed: SeedFile): SeedFile {
  const eveningRowFiles = new Map(
    EVENING_VARIANT_IDS.map(id => [`evening-${id}`, eveningAudioFile(id)]),
  );
  return {
    ...seed,
    adhkar: seed.adhkar.map(row => {
      const eveningFile = eveningRowFiles.get(row.id);
      if (eveningFile) return {...row, audio_file: eveningFile};
      if (Object.hasOwn(AUDIO_URL_FIXES, row.id)) {
        return {...row, audio_url: AUDIO_URL_FIXES[row.id]};
      }
      return row;
    }),
    super_category_audio_overrides: {
      'evening-adhkar': Object.fromEntries(
        EVENING_SHARED_AUDIO_IDS.map(id => [id, eveningAudioFile(id)]),
      ),
    },
  };
}

// Tasks append their steps before recountCategories, which must stay last.
export const FIX_STEPS: FixStep[] = [
  seed => stripEveningNotes(seed),
  (seed, eveningMarkdown) =>
    applyEveningRows(seed, parseEveningRows(eveningMarkdown)),
  seed => setPeriodLists(seed),
  seed => applyTextFixes(seed),
  seed => applyAudioFixes(seed),
  seed => applySiteRows(seed),
  seed => applyRowFixes(seed),
  seed => applyMarkerFixes(seed),
  seed => applyTransliterations(seed),
  seed => applyTranslitMarkerFixes(seed),
  seed => applyNameFixes(seed),
  seed => updateMetaTotals(seed),
  seed => recountCategories(seed),
];

export function applyAllFixes(
  seed: SeedFile,
  eveningMarkdown: string,
): SeedFile {
  return FIX_STEPS.reduce(
    (current, step) => step(current, eveningMarkdown),
    seed,
  );
}
