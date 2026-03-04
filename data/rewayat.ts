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

// Canonical rewayat registry — ordered by Qira'at teacher
const REWAYAT_REGISTRY: readonly RewayatEntry[] = [
  // Nafi'
  {
    id: 'warsh-an-nafi',
    name: "Warsh A'n Nafi'",
    displayName: 'Warsh',
    description: "Narration of Warsh from Imam Nafi'",
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
    displayName: 'Qalon',
    description: "Narration of Qalon from Imam Nafi'",
    teacher: "Nafi'",
    student: 'Qalon',
    aliases: ["Qalon A'n Nafi' Men Tariq Abi Nasheet"],
  },
  // Ibn Katheer
  {
    id: 'albizi-an-ibn-katheer',
    name: "Albizi A'n Ibn Katheer",
    displayName: 'Al-Bazzi',
    description: 'Narration of Al-Bazzi from Ibn Katheer',
    teacher: 'Ibn Katheer',
    student: 'Albizi',
    aliases: ["Albizi and Qunbol A'n Ibn Katheer"],
  },
  {
    id: 'qunbol-an-ibn-katheer',
    name: "Qunbol A'n Ibn Katheer",
    displayName: 'Qunbol',
    description: 'Narration of Qunbol from Ibn Katheer',
    teacher: 'Ibn Katheer',
    student: 'Qunbol',
    aliases: [],
  },
  // Abi Amr
  {
    id: 'aldori-an-abi-amr',
    name: "Aldori A'n Abi Amr",
    displayName: 'Al-Dori (Abi Amr)',
    description: 'Narration of Al-Dori from Abi Amr',
    teacher: 'Abi Amr',
    student: 'Aldori',
    aliases: [],
  },
  {
    id: 'assosi-an-abi-amr',
    name: "Assosi A'n Abi Amr",
    displayName: 'Al-Sosi',
    description: 'Narration of Al-Sosi from Abi Amr',
    teacher: 'Abi Amr',
    student: 'Assosi',
    aliases: [],
  },
  // Ibn Amer
  {
    id: 'ibn-thakwan-an-ibn-amer',
    name: "Ibn Thakwan A'n Ibn Amer",
    displayName: 'Ibn Thakwan',
    description: 'Narration of Ibn Thakwan from Ibn Amer',
    teacher: 'Ibn Amer',
    student: 'Ibn Thakwan',
    aliases: [],
  },
  {
    id: 'hesham-an-ibn-amer',
    name: "Hesham A'n Ibn Amer",
    displayName: 'Hesham',
    description: 'Narration of Hesham from Ibn Amer',
    teacher: 'Ibn Amer',
    student: 'Hesham',
    aliases: [],
  },
  // Assem
  {
    id: 'hafs-an-assem',
    name: "Hafs A'n Assem",
    displayName: 'Hafs',
    description: 'Narration of Hafs from Imam Assem',
    teacher: 'Assem',
    student: 'Hafs',
    aliases: [],
  },
  {
    id: 'shubah-an-assem',
    name: "Shu'bah A'n Assem",
    displayName: "Shu'bah",
    description: "Narration of Shu'bah from Imam Assem",
    teacher: 'Assem',
    student: "Shu'bah",
    aliases: [],
  },
  // Hamzah
  {
    id: 'khalaf-an-hamzah',
    name: "Khalaf A'n Hamzah",
    displayName: 'Khalaf',
    description: 'Narration of Khalaf from Hamzah',
    teacher: 'Hamzah',
    student: 'Khalaf',
    aliases: [],
  },
  {
    id: 'khallad-an-hamzah',
    name: "Khallad A'n Hamzah",
    displayName: 'Khallad',
    description: 'Narration of Khallad from Hamzah',
    teacher: 'Hamzah',
    student: 'Khallad',
    aliases: [],
  },
  // Al-Kisa'ai
  {
    id: 'aldorai-an-alkisaai',
    name: "AlDorai A'n Al-Kisa'ai",
    displayName: 'Al-Dorai',
    description: "Narration of Al-Dorai from Al-Kisa'ai",
    teacher: "Al-Kisa'ai",
    student: 'AlDorai',
    aliases: [],
  },
  {
    id: 'abu-al-harith-an-alkisai',
    name: "Abu Al-Harith A'n Al-Kisa'i",
    displayName: 'Abu Al-Harith',
    description: "Narration of Abu Al-Harith from Al-Kisa'ai",
    teacher: "Al-Kisa'ai",
    student: 'Abu Al-Harith',
    aliases: [],
  },
  // Abi Ja'far
  {
    id: 'ibn-jammaz-an-abi-jafar',
    name: "Ibn Jammaz A'n Abi Ja'far",
    displayName: 'Ibn Jammaz',
    description: "Narration of Ibn Jammaz from Abi Ja'far",
    teacher: "Abi Ja'far",
    student: 'Ibn Jammaz',
    aliases: [],
  },
  {
    id: 'ibn-wardan-an-abi-jafar',
    name: "Ibn Wardan A'n Abi Ja'far",
    displayName: 'Ibn Wardan',
    description: "Narration of Ibn Wardan from Abi Ja'far",
    teacher: "Abi Ja'far",
    student: 'Ibn Wardan',
    aliases: [],
  },
  // Yakoob
  {
    id: 'rowis-rawh-an-yakoob',
    name: "Rowis and Rawh A'n Yakoob Al Hadrami",
    displayName: 'Rowis & Rawh',
    description: "Narration of Rowis and Rawh from Ya'qub Al-Hadrami",
    teacher: 'Yakoob',
    student: 'Rowis and Rawh',
    aliases: [],
  },
  {
    id: 'rawh-an-yaqub',
    name: "Rawh A'n Ya'qub",
    displayName: 'Rawh',
    description: "Narration of Rawh from Ya'qub Al-Hadrami",
    teacher: 'Yakoob',
    student: 'Rawh',
    aliases: [],
  },
  {
    id: 'ruwais-an-yaqub',
    name: "Ruwais A'n Ya'qub",
    displayName: 'Ruwais',
    description: "Narration of Ruwais from Ya'qub Al-Hadrami",
    teacher: 'Yakoob',
    student: 'Ruwais',
    aliases: [],
  },
  // Khalaf (as Qari, 10th Qira'ah)
  {
    id: 'idris-an-khalaf',
    name: "Idris A'n Khalaf Al-Bazzar",
    displayName: 'Idris',
    description: 'Narration of Idris from Khalaf Al-Bazzar',
    teacher: 'Khalaf',
    student: 'Idris',
    aliases: [],
  },
  {
    id: 'ishaq-an-khalaf',
    name: "Ishaq A'n Khalaf Al-Bazzar",
    displayName: 'Ishaq',
    description: 'Narration of Ishaq from Khalaf Al-Bazzar',
    teacher: 'Khalaf',
    student: 'Ishaq',
    aliases: [],
  },
];

export const HAFS_REWAYAT_NAME = "Hafs A'n Assem";
export const DEFAULT_REWAYAH = "Hafs A'n Assem";

export const QIRAAT_TEACHERS: readonly string[] = [
  "Nafi'",
  'Ibn Katheer',
  'Abi Amr',
  'Ibn Amer',
  'Assem',
  'Hamzah',
  "Al-Kisa'ai",
  "Abi Ja'far",
  'Yakoob',
  'Khalaf',
];

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
