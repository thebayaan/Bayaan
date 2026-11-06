// Bare i18next singleton (initialised by '@/i18n' at app start): keeps this
// module free of native deps for Jest suites that load it through stores.
// @ai-start
import i18n from 'i18next';
// @ai-end
import {RECITERS, Reciter} from './reciterData';

export interface RewayatEntry {
  id: string;
  name: string;
  displayName: string;
  description: string;
  teacher: string;
  student: string;
  aliases: string[];
}

export interface RewayatInfo extends RewayatEntry {
  reciterCount: number;
}

// Canonical rewayat registry — ordered by Qira'at teacher.
//
// `name` and `aliases` mirror the exact strings stored in the Postgres
// `rewayat.name` column — they must match the API payload verbatim so
// resolveRewayatName() can look up an entry from whatever the backend sends.
// Those fields retain pre-canonical spellings ("Aldori A'n Abi Amr" etc.).
//
// `displayName`, `teacher`, `student`, and `description` are user-facing
// display fields — they carry the canonical transliterations used by the
// RewayahIdentity module (Al-Duri, Qalun, Ibn Dhakwan, Hisham, Asim, Abu
// Amr, Ibn Amir, al-Kisa'i, Abu Ja'far, Ya'qub, etc.) so every UI consumer
// renders the same spelling. `displayName` and `description` are getters
// that resolve in the app language. `teacher` and `student` double as filter
// keys, so they stay English; render them through getRewayatPersonLabel().
// @ai-start
const REWAYAT_REGISTRY: readonly RewayatEntry[] = [
  // Nafi'
  {
    id: 'warsh-an-nafi',
    name: "Warsh A'n Nafi'",
    get displayName() {
      return i18n.t('content:rewayat.entries.warsh-an-nafi.displayName');
    },
    get description() {
      return i18n.t('content:rewayat.entries.warsh-an-nafi.description');
    },
    teacher: "Nafi'",
    student: 'Warsh',
    aliases: [
      "Warsh A'n Nafi' Men Tariq Alazraq",
      "Warsh A'n Nafi' Men Tariq Abi Baker Alasbahani",
    ],
  },
  {
    id: 'qalon-an-nafi',
    name: "Qalon A'n Nafi'",
    get displayName() {
      return i18n.t('content:rewayat.entries.qalon-an-nafi.displayName');
    },
    get description() {
      return i18n.t('content:rewayat.entries.qalon-an-nafi.description');
    },
    teacher: "Nafi'",
    student: 'Qalun',
    aliases: ["Qalon A'n Nafi' Men Tariq Abi Nasheet"],
  },
  // Ibn Kathir
  {
    id: 'albizi-an-ibn-katheer',
    name: "Albizi A'n Ibn Katheer",
    get displayName() {
      return i18n.t(
        'content:rewayat.entries.albizi-an-ibn-katheer.displayName',
      );
    },
    get description() {
      return i18n.t(
        'content:rewayat.entries.albizi-an-ibn-katheer.description',
      );
    },
    teacher: 'Ibn Kathir',
    student: 'Al-Bazzi',
    aliases: ["Albizi and Qunbol A'n Ibn Katheer"],
  },
  {
    id: 'qunbol-an-ibn-katheer',
    name: "Qunbol A'n Ibn Katheer",
    get displayName() {
      return i18n.t(
        'content:rewayat.entries.qunbol-an-ibn-katheer.displayName',
      );
    },
    get description() {
      return i18n.t(
        'content:rewayat.entries.qunbol-an-ibn-katheer.description',
      );
    },
    teacher: 'Ibn Kathir',
    student: 'Qunbul',
    aliases: [],
  },
  // Abu Amr
  {
    id: 'aldori-an-abi-amr',
    name: "Aldori A'n Abi Amr",
    get displayName() {
      return i18n.t('content:rewayat.entries.aldori-an-abi-amr.displayName');
    },
    get description() {
      return i18n.t('content:rewayat.entries.aldori-an-abi-amr.description');
    },
    teacher: 'Abu Amr',
    student: 'Al-Duri',
    aliases: [],
  },
  {
    id: 'assosi-an-abi-amr',
    name: "Assosi A'n Abi Amr",
    get displayName() {
      return i18n.t('content:rewayat.entries.assosi-an-abi-amr.displayName');
    },
    get description() {
      return i18n.t('content:rewayat.entries.assosi-an-abi-amr.description');
    },
    teacher: 'Abu Amr',
    student: 'Al-Susi',
    aliases: [],
  },
  // Ibn Amir
  {
    id: 'ibn-thakwan-an-ibn-amer',
    name: "Ibn Thakwan A'n Ibn Amer",
    get displayName() {
      return i18n.t(
        'content:rewayat.entries.ibn-thakwan-an-ibn-amer.displayName',
      );
    },
    get description() {
      return i18n.t(
        'content:rewayat.entries.ibn-thakwan-an-ibn-amer.description',
      );
    },
    teacher: 'Ibn Amir',
    student: 'Ibn Dhakwan',
    aliases: [],
  },
  {
    id: 'hesham-an-ibn-amer',
    name: "Hesham A'n Ibn Amer",
    get displayName() {
      return i18n.t('content:rewayat.entries.hesham-an-ibn-amer.displayName');
    },
    get description() {
      return i18n.t('content:rewayat.entries.hesham-an-ibn-amer.description');
    },
    teacher: 'Ibn Amir',
    student: 'Hisham',
    aliases: [],
  },
  // Asim
  {
    id: 'hafs-an-assem',
    name: "Hafs A'n Assem",
    get displayName() {
      return i18n.t('content:rewayat.entries.hafs-an-assem.displayName');
    },
    get description() {
      return i18n.t('content:rewayat.entries.hafs-an-assem.description');
    },
    teacher: 'Asim',
    student: 'Hafs',
    aliases: [],
  },
  {
    id: 'shubah-an-assem',
    name: "Shu'bah A'n Assem",
    get displayName() {
      return i18n.t('content:rewayat.entries.shubah-an-assem.displayName');
    },
    get description() {
      return i18n.t('content:rewayat.entries.shubah-an-assem.description');
    },
    teacher: 'Asim',
    student: "Shu'bah",
    aliases: [],
  },
  // Hamzah
  {
    id: 'khalaf-an-hamzah',
    name: "Khalaf A'n Hamzah",
    get displayName() {
      return i18n.t('content:rewayat.entries.khalaf-an-hamzah.displayName');
    },
    get description() {
      return i18n.t('content:rewayat.entries.khalaf-an-hamzah.description');
    },
    teacher: 'Hamzah',
    student: 'Khalaf',
    aliases: [],
  },
  {
    id: 'khallad-an-hamzah',
    name: "Khallad A'n Hamzah",
    get displayName() {
      return i18n.t('content:rewayat.entries.khallad-an-hamzah.displayName');
    },
    get description() {
      return i18n.t('content:rewayat.entries.khallad-an-hamzah.description');
    },
    teacher: 'Hamzah',
    student: 'Khallad',
    aliases: [],
  },
  // al-Kisa'i
  {
    id: 'aldorai-an-alkisaai',
    name: "AlDorai A'n Al-Kisa'ai",
    get displayName() {
      return i18n.t('content:rewayat.entries.aldorai-an-alkisaai.displayName');
    },
    get description() {
      return i18n.t('content:rewayat.entries.aldorai-an-alkisaai.description');
    },
    teacher: "al-Kisa'i",
    student: 'Al-Duri',
    aliases: [],
  },
  {
    id: 'abu-al-harith-an-alkisai',
    name: "Abu Al-Harith A'n Al-Kisa'i",
    get displayName() {
      return i18n.t(
        'content:rewayat.entries.abu-al-harith-an-alkisai.displayName',
      );
    },
    get description() {
      return i18n.t(
        'content:rewayat.entries.abu-al-harith-an-alkisai.description',
      );
    },
    teacher: "al-Kisa'i",
    student: 'Abu al-Harith',
    aliases: [],
  },
  // Abu Ja'far
  {
    id: 'ibn-jammaz-an-abi-jafar',
    name: "Ibn Jammaz A'n Abi Ja'far",
    get displayName() {
      return i18n.t(
        'content:rewayat.entries.ibn-jammaz-an-abi-jafar.displayName',
      );
    },
    get description() {
      return i18n.t(
        'content:rewayat.entries.ibn-jammaz-an-abi-jafar.description',
      );
    },
    teacher: "Abu Ja'far",
    student: 'Ibn Jammaz',
    aliases: [],
  },
  {
    id: 'ibn-wardan-an-abi-jafar',
    name: "Ibn Wardan A'n Abi Ja'far",
    get displayName() {
      return i18n.t(
        'content:rewayat.entries.ibn-wardan-an-abi-jafar.displayName',
      );
    },
    get description() {
      return i18n.t(
        'content:rewayat.entries.ibn-wardan-an-abi-jafar.description',
      );
    },
    teacher: "Abu Ja'far",
    student: 'Ibn Wardan',
    aliases: [],
  },
  // Ya'qub
  {
    id: 'rowis-rawh-an-yakoob',
    name: "Rowis and Rawh A'n Yakoob Al Hadrami",
    get displayName() {
      return i18n.t('content:rewayat.entries.rowis-rawh-an-yakoob.displayName');
    },
    get description() {
      return i18n.t('content:rewayat.entries.rowis-rawh-an-yakoob.description');
    },
    teacher: "Ya'qub",
    student: 'Ruwais and Rawh',
    aliases: [],
  },
  {
    id: 'rawh-an-yaqub',
    name: "Rawh A'n Ya'qub",
    get displayName() {
      return i18n.t('content:rewayat.entries.rawh-an-yaqub.displayName');
    },
    get description() {
      return i18n.t('content:rewayat.entries.rawh-an-yaqub.description');
    },
    teacher: "Ya'qub",
    student: 'Rawh',
    aliases: [],
  },
  {
    id: 'ruwais-an-yaqub',
    name: "Ruwais A'n Ya'qub",
    get displayName() {
      return i18n.t('content:rewayat.entries.ruwais-an-yaqub.displayName');
    },
    get description() {
      return i18n.t('content:rewayat.entries.ruwais-an-yaqub.description');
    },
    teacher: "Ya'qub",
    student: 'Ruwais',
    aliases: [],
  },
  // Khalaf al-Bazzar (as Qari, 10th Qira'ah)
  {
    id: 'idris-an-khalaf',
    name: "Idris A'n Khalaf Al-Bazzar",
    get displayName() {
      return i18n.t('content:rewayat.entries.idris-an-khalaf.displayName');
    },
    get description() {
      return i18n.t('content:rewayat.entries.idris-an-khalaf.description');
    },
    teacher: 'Khalaf al-Bazzar',
    student: 'Idris',
    aliases: [],
  },
  {
    id: 'ishaq-an-khalaf',
    name: "Ishaq A'n Khalaf Al-Bazzar",
    get displayName() {
      return i18n.t('content:rewayat.entries.ishaq-an-khalaf.displayName');
    },
    get description() {
      return i18n.t('content:rewayat.entries.ishaq-an-khalaf.description');
    },
    teacher: 'Khalaf al-Bazzar',
    student: 'Ishaq',
    aliases: [],
  },
];
// @ai-end

export const HAFS_REWAYAT_NAME = "Hafs A'n Assem";
export const DEFAULT_REWAYAH = "Hafs A'n Assem";

export const QIRAAT_TEACHERS: readonly string[] = [
  "Nafi'",
  'Ibn Kathir',
  'Abu Amr',
  'Ibn Amir',
  'Asim',
  'Hamzah',
  "al-Kisa'i",
  "Abu Ja'far",
  "Ya'qub",
  'Khalaf al-Bazzar',
];

// @ai-start
const PERSON_LABEL_KEYS = {
  "Nafi'": 'nafi',
  'Ibn Kathir': 'ibnKathir',
  'Abu Amr': 'abuAmr',
  'Ibn Amir': 'ibnAmir',
  Asim: 'asim',
  Hamzah: 'hamzah',
  "al-Kisa'i": 'kisai',
  "Abu Ja'far": 'abuJafar',
  "Ya'qub": 'yaqub',
  'Khalaf al-Bazzar': 'khalafAlBazzar',
  Warsh: 'warsh',
  Qalun: 'qalun',
  'Al-Bazzi': 'bazzi',
  Qunbul: 'qunbul',
  'Al-Duri': 'duri',
  'Al-Susi': 'susi',
  'Ibn Dhakwan': 'ibnDhakwan',
  Hisham: 'hisham',
  Hafs: 'hafs',
  "Shu'bah": 'shubah',
  Khalaf: 'khalaf',
  Khallad: 'khallad',
  'Abu al-Harith': 'abuAlHarith',
  'Ibn Jammaz': 'ibnJammaz',
  'Ibn Wardan': 'ibnWardan',
  'Ruwais and Rawh': 'ruwaisAndRawh',
  Rawh: 'rawh',
  Ruwais: 'ruwais',
  Idris: 'idris',
  Ishaq: 'ishaq',
} as const;
// @ai-end

/**
 * Display label for a registry `teacher` / `student` value (e.g. "Nafi'"),
 * in the app language. Unknown names are returned unchanged.
 */
// @ai-start
export function getRewayatPersonLabel(name: string): string {
  const key = PERSON_LABEL_KEYS[name as keyof typeof PERSON_LABEL_KEYS];
  return key ? i18n.t(`content:rewayat.people.${key}`) : name;
}
// @ai-end

// Lazy-built lookup map: DB name (or alias) -> RewayatEntry
let _nameMap: Map<string, RewayatEntry> | null = null;
function getNameMap(): Map<string, RewayatEntry> {
  if (_nameMap) return _nameMap;
  _nameMap = new Map();
  for (const entry of REWAYAT_REGISTRY) {
    _nameMap.set(entry.name, entry);
    for (const alias of entry.aliases) {
      _nameMap.set(alias, entry);
    }
  }
  return _nameMap;
}

// Lazy-built id map
let _idMap: Map<string, RewayatEntry> | null = null;
function getIdMap(): Map<string, RewayatEntry> {
  if (_idMap) return _idMap;
  _idMap = new Map();
  for (const entry of REWAYAT_REGISTRY) {
    _idMap.set(entry.id, entry);
  }
  return _idMap;
}

/** Resolve any DB rewayat name (including aliases like "Men Tariq" variants) to canonical entry. */
export function resolveRewayatName(dbName: string): RewayatEntry | undefined {
  return getNameMap().get(dbName);
}

/** Look up a rewayat entry by kebab-case slug. */
export function getRewayatById(id: string): RewayatInfo | undefined {
  const entry = getIdMap().get(id);
  if (!entry) return undefined;
  return {...entry, reciterCount: countRecitersForEntry(entry)};
}

/** Look up by primary name. */
export function getRewayatByName(name: string): RewayatInfo | undefined {
  const entry = REWAYAT_REGISTRY.find(r => r.name === name);
  if (!entry) return undefined;
  return {...entry, reciterCount: countRecitersForEntry(entry)};
}

/** All rewayat with dynamic reciter counts (includes Hafs). */
export function getAllRewayatWithCounts(): RewayatInfo[] {
  return REWAYAT_REGISTRY.map(entry => ({
    ...entry,
    reciterCount: countRecitersForEntry(entry),
  }));
}

/** All rewayat excluding Hafs (backwards compat for home screen carousel). */
export function getAllRewayatTypes(): RewayatInfo[] {
  return getAllRewayatWithCounts().filter(
    r => r.id !== 'hafs-an-assem' && r.reciterCount > 0,
  );
}

/** Find reciters who have a specific rewayat (by primary name or alias). */
export function getRecitersByRewayat(rewayatName: string): Reciter[] {
  const entry = resolveRewayatName(rewayatName);
  if (!entry) {
    // Fallback: direct name match
    return RECITERS.filter(reciter =>
      reciter.rewayat.some(r => r.name === rewayatName),
    );
  }
  const names = new Set([entry.name, ...entry.aliases]);
  return RECITERS.filter(reciter =>
    reciter.rewayat.some(r => names.has(r.name)),
  );
}

/** All primary rewayat names (for picker UIs). */
export function getRewayahNames(): string[] {
  return REWAYAT_REGISTRY.map(r => r.name);
}

// Internal: count reciters for a registry entry (name + aliases)
function countRecitersForEntry(entry: RewayatEntry): number {
  const names = new Set([entry.name, ...entry.aliases]);
  const reciterIds = new Set<string>();
  for (const reciter of RECITERS) {
    for (const r of reciter.rewayat) {
      if (names.has(r.name)) {
        reciterIds.add(reciter.id);
        break;
      }
    }
  }
  return reciterIds.size;
}
