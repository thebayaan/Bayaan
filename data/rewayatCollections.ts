import {RECITERS, Reciter} from './reciterData';

export interface RewayatInfo {
  id: string;
  name: string;
  displayName: string;
  description: string;
  reciterCount: number;
}

// All available rewayat (excluding Hafs A'n Assem as it's the default)
export const REWAYAT_TYPES: RewayatInfo[] = [
  {
    id: 'warsh-an-nafi',
    name: "Warsh A'n Nafi'",
    displayName: 'Warsh',
    description: 'Narration of Warsh from Imam Nafi',
    reciterCount: 12,
  },
  {
    id: 'qalon-an-nafi',
    name: "Qalon A'n Nafi'",
    displayName: 'Qalon',
    description: 'Narration of Qalon from Imam Nafi',
    reciterCount: 11,
  },
  {
    id: 'aldorai-an-alkisaai',
    name: "AlDorai A'n Al-Kisa'ai",
    displayName: 'Al-Dorai',
    description: 'Narration of Al-Dorai from Al-Kisa\'i',
    reciterCount: 6,
  },
  {
    id: 'aldori-an-abi-amr',
    name: "Aldori A'n Abi Amr",
    displayName: 'Al-Dori (Abi Amr)',
    description: 'Narration of Al-Dori from Abi Amr',
    reciterCount: 5,
  },
  {
    id: 'shubah-an-assem',
    name: "Shu'bah A'n Assem",
    displayName: "Shu'bah",
    description: "Narration of Shu'bah from Imam Assem",
    reciterCount: 3,
  },
  {
    id: 'assosi-an-abi-amr',
    name: "Assosi A'n Abi Amr",
    displayName: 'Al-Sosi',
    description: 'Narration of Al-Sosi from Abi Amr',
    reciterCount: 2,
  },
  {
    id: 'albizi-an-ibn-katheer',
    name: "Albizi A'n Ibn Katheer",
    displayName: 'Al-Bazzi',
    description: 'Narration of Al-Bazzi from Ibn Katheer',
    reciterCount: 2,
  },
  {
    id: 'ibn-thakwan-an-ibn-amer',
    name: "Ibn Thakwan A'n Ibn Amer",
    displayName: 'Ibn Thakwan',
    description: 'Narration of Ibn Thakwan from Ibn Amer',
    reciterCount: 2,
  },
  {
    id: 'khalaf-an-hamzah',
    name: "Khalaf A'n Hamzah",
    displayName: 'Khalaf',
    description: 'Narration of Khalaf from Hamzah',
    reciterCount: 2,
  },
  {
    id: 'rowis-rawh-an-yakoob',
    name: "Rowis and Rawh A'n Yakoob Al Hadrami",
    displayName: 'Rowis & Rawh',
    description: "Narration of Rowis and Rawh from Ya'qub Al-Hadrami",
    reciterCount: 2,
  },
  {
    id: 'warsh-tariq-alazraq',
    name: "Warsh A'n Nafi' Men Tariq Alazraq",
    displayName: 'Warsh (Alazraq)',
    description: 'Warsh from the way of Alazraq',
    reciterCount: 2,
  },
];

/**
 * Gets reciters who have a specific rewayat
 */
export function getRecitersByRewayat(rewayatName: string): Reciter[] {
  return RECITERS.filter(reciter =>
    reciter.rewayat.some(r => r.name === rewayatName),
  );
}

/**
 * Gets all unique rewayat types from all reciters
 */
export function getAllRewayatTypes(): RewayatInfo[] {
  return REWAYAT_TYPES;
}

/**
 * Gets rewayat info by ID
 */
export function getRewayatById(id: string): RewayatInfo | undefined {
  return REWAYAT_TYPES.find(r => r.id === id);
}

/**
 * Gets rewayat info by name
 */
export function getRewayatByName(name: string): RewayatInfo | undefined {
  return REWAYAT_TYPES.find(r => r.name === name);
}

