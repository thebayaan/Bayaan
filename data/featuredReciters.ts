import {RECITERS, Reciter} from './reciterData';

const FEATURED_RECITER_NAMES = [
  'Mishari Rashid Al-Afasy',
  'Abdul Basit Abdul Samad',
  'Mahmoud Khalil Al-Hussary',
  'Muhammad Siddiq Al-Minshawi',
  'Abdul Rahman Al-Sudais',
  'Saud Al-Shuraim',
  'Muhammad Ayyub',
  'Muhammad Jibreel',
  'Maher Al-Muaiqly',
  'Idrees Abkr',
  'Abdullah Awad Al-Juhany',
  'Ahmad Al-Ajmy',
  'Saad Al-Ghamdi',
  'Mahmoud Ali Al-Banna',
  'Abdul Muhsin Al-Qasim',
  'Yasser Al-Dosari',
];

function normalizeReciterName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove special characters and spaces
    .trim();
}

function findReciterByName(name: string): Reciter | undefined {
  const normalizedName = normalizeReciterName(name);
  return RECITERS.find(
    reciter => normalizeReciterName(reciter.name) === normalizedName,
  );
}

export function getFeaturedReciters(count = 10): Reciter[] {
  const featuredReciters = FEATURED_RECITER_NAMES.map(findReciterByName).filter(
    (r): r is Reciter => r !== undefined,
  );

  const shuffled = [...featuredReciters].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

export function getFeaturedReciterOfTheDay(): Reciter {
  const today = new Date();
  const startOfYear = new Date(today.getFullYear(), 0, 0);
  const diff = today.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));

  // Get reciter for today
  const index = dayOfYear % FEATURED_RECITER_NAMES.length;
  const reciter = findReciterByName(FEATURED_RECITER_NAMES[index]);

  // Fallback to first available featured reciter if undefined
  if (!reciter) {
    const fallbackReciter = FEATURED_RECITER_NAMES.map(findReciterByName).find(
      (r): r is Reciter => r !== undefined,
    );

    // Final fallback to first reciter in RECITERS array
    return fallbackReciter || RECITERS[0];
  }

  return reciter;
}
