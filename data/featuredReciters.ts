import {RECITERS, Reciter} from './reciterData';

const FEATURED_RECITER_NAMES = [
  'Albaraa Basfar',
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
  // Always return Albaraa Basfar as the featured reciter
  const albaraa = findReciterByName('Albaraa Basfar');
  if (!albaraa) {
    // Fallback to random selection if Albaraa is not found
    const featuredReciters = getFeaturedReciters(1);
    return featuredReciters[0];
  }
  return albaraa;
}
