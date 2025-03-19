import {RECITERS, Reciter} from './reciterData';

// Featured Reciters - Spotlight reciters chosen by Bayaan
const FEATURED_RECITER_NAMES = [
  'Mishary Rashid Alafasy',
  'Abdulbasit Abdulsamad',
  'Mahmoud Khalil Al-Hussary',
  'Mohammed Siddiq Al-Minshawi',
  'Abdullah Basfar',
  'Maher Al Meaqly',
  'Mohammed Ayyub',
  'Mohammed Jibreel',
  'Ahmad Al-Ajmy',
  'Hani Ar-Rifai',
];

// Trending Reciters - Currently popular among users
const TRENDING_RECITER_NAMES = [
  'Mishary Rashid Alafasy',
  'Abu Bakr Al-Shatri',
  'Yasser Al-Dosari',
  'Idrees Abkr',
  'Abdullah Al-Johany',
  'Salah Al-Budair',
  'Bandar Balila',
  'Nasser Al-Qatami',
  'Ahmed Al-Ajmy',
  'Raad Al-Kurdi',
];

// Bayaan Originals - Exclusive recitations curated by Bayaan
const BAYAAN_ORIGINALS_RECITER_NAMES = [
  'Albaraa Basfar',
  'Saad Al-Ghamdi',
  'Ibrahim Al-Akhdar',
  'Ali Al-Huzaifi',
  'Mahmoud Ali Albanna',
  'Khalid Al-Qahtani',
  'Salah Al-Budair',
  'Hani Ar-Rifai',
  'Maher Al Meaqly',
  'Abdulrahman Alsudaes',
];

// Best for Tajweed - Reciters known for excellent tajweed and correct pronunciation
const TAJWEED_RECITER_NAMES = [
  'Mishary Rashid Alafasy',
  'Mahmoud Khalil Al-Hussary',
  'Mohammed Siddiq Al-Minshawi',
  'Abdulbasit Abdulsamad',
  'Mohammed Ayyub',
  'Ahmad Al-Ajmy',
  'Saad Al-Ghamdi',
  'Ibrahim Al-Akhdar',
  'Maher Al Meaqly',
  'Abdullah Basfar',
];

// Best for Memorization - Reciters with clear, measured pace ideal for memorization
const MEMORIZATION_RECITER_NAMES = [
  'Hani Ar-Rifai',
  'Mahmoud Khalil Al-Hussary',
  'Mohammed Siddiq Al-Minshawi Muallim',
  'Khalifa Al-Tunaiji',
  'Mohammed Jibreel',
  'Salah Al-Budair',
  'Abdullah Al-Mattrod',
  'Idrees Abkr',
  'Yassin Al-Jazaery',
  'Abu Bakr Al-Shatri',
];

// For Beginners - Reciters who are approachable and easy to listen to for first-time listeners
const BEGINNER_FRIENDLY_RECITER_NAMES = [
  'Mishary Rashid Alafasy',
  'Maher Al Meaqly',
  'Abu Bakr Al-Shatri',
  'Abdullah Basfar',
  'Saad Al-Ghamdi',
  'Bandar Balila',
  'Nasser Al-Qatami',
  'Yasser Al-Dosari',
  'Idrees Abkr',
  'Ahmad Al-Ajmy',
];

// Diverse Rewayat - Reciters who excel in multiple narration styles/qira'at
const DIVERSE_REWAYAT_RECITER_NAMES = [
  'Mahmoud Khalil Al-Hussary',
  'Abdulbasit Abdulsamad',
  'Mohammed Siddiq Al-Minshawi',
  'Mohammed Jibreel',
  'Yasser Al-Dosari',
  'Ali Al-Huzaifi',
  'Abdullah Basfar',
  'Ahmed Al-Ajmy',
  'Bandar Balila',
  'Khalid Al-Qahtani',
];

/**
 * Normalizes a reciter name for comparison (removes spaces, special characters, etc.)
 */
function normalizeReciterName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove special characters and spaces
    .trim();
}

/**
 * Finds a reciter by their name using normalized comparison
 */
function findReciterByName(name: string): Reciter | undefined {
  const normalizedName = normalizeReciterName(name);
  return RECITERS.find(
    reciter => normalizeReciterName(reciter.name) === normalizedName,
  );
}

/**
 * Gets featured reciters chosen by Bayaan to spotlight
 */
export function getFeaturedReciters(count?: number): Reciter[] {
  const reciters = FEATURED_RECITER_NAMES.map(findReciterByName).filter(
    (reciter): reciter is Reciter => reciter !== undefined,
  );
  return count ? reciters.slice(0, count) : reciters;
}

/**
 * Gets trending reciters that are currently popular among users
 */
export function getTrendingReciters(count?: number): Reciter[] {
  const reciters = TRENDING_RECITER_NAMES.map(findReciterByName).filter(
    (reciter): reciter is Reciter => reciter !== undefined,
  );
  return count ? reciters.slice(0, count) : reciters;
}

/**
 * Gets Bayaan's exclusive curated recitations
 */
export function getBayaanOriginalsReciters(count?: number): Reciter[] {
  const reciters = BAYAAN_ORIGINALS_RECITER_NAMES.map(findReciterByName).filter(
    (reciter): reciter is Reciter => reciter !== undefined,
  );
  return count ? reciters.slice(0, count) : reciters;
}

/**
 * Gets a list of reciters known for excellent tajweed and correct pronunciation
 */
export function getTajweedReciters(count?: number): Reciter[] {
  const reciters = TAJWEED_RECITER_NAMES.map(findReciterByName).filter(
    (reciter): reciter is Reciter => reciter !== undefined,
  );
  return count ? reciters.slice(0, count) : reciters;
}

/**
 * Gets a list of reciters ideal for memorization with clear, measured pace
 */
export function getMemorizationReciters(count?: number): Reciter[] {
  const reciters = MEMORIZATION_RECITER_NAMES.map(findReciterByName).filter(
    (reciter): reciter is Reciter => reciter !== undefined,
  );
  return count ? reciters.slice(0, count) : reciters;
}

/**
 * Gets a list of reciters who are approachable for beginners
 */
export function getBeginnerFriendlyReciters(count?: number): Reciter[] {
  const reciters = BEGINNER_FRIENDLY_RECITER_NAMES.map(
    findReciterByName,
  ).filter((reciter): reciter is Reciter => reciter !== undefined);
  return count ? reciters.slice(0, count) : reciters;
}

/**
 * Gets a list of reciters who excel in multiple narration styles/qira'at
 */
export function getDiverseRewayatReciters(count?: number): Reciter[] {
  const reciters = DIVERSE_REWAYAT_RECITER_NAMES.map(findReciterByName).filter(
    (reciter): reciter is Reciter => reciter !== undefined,
  );
  return count ? reciters.slice(0, count) : reciters;
}

/**
 * Gets reciters for a specific collection by name
 */
export function getReciterCollection(
  collectionName:
    | 'featured'
    | 'trending'
    | 'bayaan-originals'
    | 'tajweed'
    | 'memorization'
    | 'beginner-friendly'
    | 'diverse-rewayat',
  count?: number,
): Reciter[] {
  switch (collectionName) {
    case 'featured':
      return getFeaturedReciters(count);
    case 'trending':
      return getTrendingReciters(count);
    case 'bayaan-originals':
      return getBayaanOriginalsReciters(count);
    case 'tajweed':
      return getTajweedReciters(count);
    case 'memorization':
      return getMemorizationReciters(count);
    case 'beginner-friendly':
      return getBeginnerFriendlyReciters(count);
    case 'diverse-rewayat':
      return getDiverseRewayatReciters(count);
    default:
      return [];
  }
}
