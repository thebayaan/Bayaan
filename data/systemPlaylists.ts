/**
 * System Playlists - Curated playlists created by Bayaan
 * These are read-only playlists that provide themed collections of Quranic recitations
 */

export interface SystemPlaylistItem {
  surahId: number;
  reciterId?: string; // Optional - if not provided, user chooses reciter
  rewayatId?: string; // Optional - if not provided, use default rewayat
}

export interface SystemPlaylist {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  backgroundColor: string;
  type: 'surah-only' | 'fully-curated';
  items: SystemPlaylistItem[];
  heightMultiplier: number;
  column: 'left' | 'right';
  order: number;
}

/**
 * System playlists organized by category
 * Total: 12 playlists (6 per column)
 */
export const SYSTEM_PLAYLISTS: SystemPlaylist[] = [
  // ========== LEFT COLUMN ==========

  // Time-based: Morning Reflections
  {
    id: 'morning-reflections',
    title: 'Morning Reflections',
    description:
      'Start your day with uplifting surahs that inspire gratitude and hope',
    backgroundColor: '#F59E0B', // Warm amber
    type: 'surah-only',
    items: [
      {surahId: 1}, // Al-Fatihah
      {surahId: 93}, // Ad-Duhaa
      {surahId: 94}, // Ash-Sharh
      {surahId: 112}, // Al-Ikhlas
      {surahId: 113}, // Al-Falaq
      {surahId: 114}, // An-Nas
    ],
    heightMultiplier: 2,
    column: 'left',
    order: 1,
  },

  // Duration: Quick Listen
  {
    id: 'quick-listen',
    title: 'Quick Listen',
    subtitle: '5-15 minutes',
    description:
      'Perfect for short listening sessions during your commute or breaks',
    backgroundColor: '#8B5CF6', // Purple
    type: 'surah-only',
    items: [
      {surahId: 36}, // Ya-Sin
      {surahId: 55}, // Ar-Rahman
      {surahId: 56}, // Al-Waqiah
      {surahId: 67}, // Al-Mulk
      {surahId: 78}, // An-Naba
    ],
    heightMultiplier: 1,
    column: 'left',
    order: 2,
  },

  // Purpose: Heart Softeners
  {
    id: 'heart-softeners',
    title: 'Heart Softeners',
    description: 'Emotional and touching recitations that deeply move the soul',
    backgroundColor: '#EC4899', // Pink
    type: 'surah-only',
    items: [
      {surahId: 12}, // Yusuf
      {surahId: 18}, // Al-Kahf
      {surahId: 19}, // Maryam
      {surahId: 36}, // Ya-Sin
      {surahId: 55}, // Ar-Rahman
      {surahId: 56}, // Al-Waqiah
    ],
    heightMultiplier: 2,
    column: 'left',
    order: 3,
  },

  // Educational: Stories of the Prophets
  {
    id: 'stories-prophets',
    title: 'Stories of the Prophets',
    description: 'Surahs featuring narratives of the messengers of Allah',
    backgroundColor: '#0EA5E9', // Sky blue
    type: 'surah-only',
    items: [
      {surahId: 10}, // Yunus
      {surahId: 11}, // Hud
      {surahId: 12}, // Yusuf
      {surahId: 14}, // Ibrahim
      {surahId: 19}, // Maryam
      {surahId: 71}, // Nuh
    ],
    heightMultiplier: 1,
    column: 'left',
    order: 4,
  },

  // Special: Protection & Healing
  {
    id: 'protection-healing',
    title: 'Protection & Healing',
    description: 'Surahs for ruqyah and seeking refuge in Allah',
    backgroundColor: '#10B981', // Emerald
    type: 'surah-only',
    items: [
      {surahId: 1}, // Al-Fatihah
      {surahId: 2}, // Al-Baqarah (for Ayat al-Kursi)
      {surahId: 112}, // Al-Ikhlas
      {surahId: 113}, // Al-Falaq
      {surahId: 114}, // An-Nas
    ],
    heightMultiplier: 2,
    column: 'left',
    order: 5,
  },

  // Trending: Most Loved
  {
    id: 'most-loved',
    title: 'Most Loved',
    description: 'Community favorites that resonate with listeners worldwide',
    backgroundColor: '#EF4444', // Red
    type: 'surah-only',
    items: [
      {surahId: 18}, // Al-Kahf
      {surahId: 36}, // Ya-Sin
      {surahId: 55}, // Ar-Rahman
      {surahId: 56}, // Al-Waqiah
      {surahId: 67}, // Al-Mulk
    ],
    heightMultiplier: 1,
    column: 'left',
    order: 6,
  },

  // ========== RIGHT COLUMN ==========

  // Time-based: Evening Serenity
  {
    id: 'evening-serenity',
    title: 'Evening Serenity',
    description: 'Calm and peaceful surahs perfect for evening reflection',
    backgroundColor: '#6366F1', // Indigo
    type: 'surah-only',
    items: [
      {surahId: 36}, // Ya-Sin
      {surahId: 55}, // Ar-Rahman
      {surahId: 67}, // Al-Mulk
      {surahId: 76}, // Al-Insan
      {surahId: 89}, // Al-Fajr
    ],
    heightMultiplier: 1,
    column: 'right',
    order: 1,
  },

  // Time-based: Friday Essentials
  {
    id: 'friday-essentials',
    title: 'Friday Essentials',
    description: 'Al-Kahf and other recommended Friday recitations',
    backgroundColor: '#059669', // Green
    type: 'surah-only',
    items: [
      {surahId: 18}, // Al-Kahf (Friday essential)
      {surahId: 32}, // As-Sajdah
      {surahId: 62}, // Al-Jumuah
      {surahId: 76}, // Al-Insan
    ],
    heightMultiplier: 2,
    column: 'right',
    order: 2,
  },

  // Purpose: Focus & Study
  {
    id: 'focus-study',
    title: 'Focus & Study',
    description: 'Measured, clear recitations ideal for background listening',
    backgroundColor: '#14B8A6', // Teal
    type: 'surah-only',
    items: [
      {surahId: 2}, // Al-Baqarah
      {surahId: 3}, // Ali 'Imran
      {surahId: 4}, // An-Nisa
      {surahId: 18}, // Al-Kahf
    ],
    heightMultiplier: 1,
    column: 'right',
    order: 3,
  },

  // Special: Juz Amma
  {
    id: 'juz-amma',
    title: 'Juz Amma',
    subtitle: 'The 30th Juz',
    description: 'Complete collection of short surahs from the last juz',
    backgroundColor: '#F97316', // Orange
    type: 'surah-only',
    items: [
      {surahId: 78}, // An-Naba
      {surahId: 79}, // An-Naziat
      {surahId: 80}, // Abasa
      {surahId: 81}, // At-Takwir
      {surahId: 82}, // Al-Infitar
      {surahId: 83}, // Al-Mutaffifin
      {surahId: 84}, // Al-Inshiqaq
      {surahId: 85}, // Al-Buruj
      {surahId: 86}, // At-Tariq
      {surahId: 87}, // Al-Ala
      {surahId: 88}, // Al-Ghashiyah
      {surahId: 89}, // Al-Fajr
      {surahId: 90}, // Al-Balad
      {surahId: 91}, // Ash-Shams
      {surahId: 92}, // Al-Layl
      {surahId: 93}, // Ad-Duha
      {surahId: 94}, // Ash-Sharh
      {surahId: 95}, // At-Tin
      {surahId: 96}, // Al-Alaq
      {surahId: 97}, // Al-Qadr
      {surahId: 98}, // Al-Bayyinah
      {surahId: 99}, // Az-Zalzalah
      {surahId: 100}, // Al-Adiyat
      {surahId: 101}, // Al-Qariah
      {surahId: 102}, // At-Takathur
      {surahId: 103}, // Al-Asr
      {surahId: 104}, // Al-Humazah
      {surahId: 105}, // Al-Fil
      {surahId: 106}, // Quraysh
      {surahId: 107}, // Al-Maun
      {surahId: 108}, // Al-Kawthar
      {surahId: 109}, // Al-Kafirun
      {surahId: 110}, // An-Nasr
      {surahId: 111}, // Al-Masad
      {surahId: 112}, // Al-Ikhlas
      {surahId: 113}, // Al-Falaq
      {surahId: 114}, // An-Nas
    ],
    heightMultiplier: 2,
    column: 'right',
    order: 4,
  },

  // Special: Memorization Station
  {
    id: 'memorization-station',
    title: 'Memorization Station',
    description: 'Short surahs perfect for those beginning their memorization',
    backgroundColor: '#7C3AED', // Violet
    type: 'surah-only',
    items: [
      {surahId: 1}, // Al-Fatihah
      {surahId: 103}, // Al-Asr
      {surahId: 108}, // Al-Kawthar
      {surahId: 109}, // Al-Kafirun
      {surahId: 110}, // An-Nasr
      {surahId: 111}, // Al-Masad
      {surahId: 112}, // Al-Ikhlas
      {surahId: 113}, // Al-Falaq
      {surahId: 114}, // An-Nas
    ],
    heightMultiplier: 1,
    column: 'right',
    order: 5,
  },

  // Trending: Bayaan Essentials
  {
    id: 'bayaan-essentials',
    title: 'Bayaan Essentials',
    description: 'Our top recommendations for every listener',
    backgroundColor: '#DC2626', // Deep red
    type: 'surah-only',
    items: [
      {surahId: 1}, // Al-Fatihah
      {surahId: 18}, // Al-Kahf
      {surahId: 36}, // Ya-Sin
      {surahId: 55}, // Ar-Rahman
      {surahId: 67}, // Al-Mulk
      {surahId: 112}, // Al-Ikhlas
    ],
    heightMultiplier: 1,
    column: 'right',
    order: 6,
  },
];

/**
 * Get a system playlist by ID
 */
export function getSystemPlaylistById(id: string): SystemPlaylist | undefined {
  return SYSTEM_PLAYLISTS.find(playlist => playlist.id === id);
}

/**
 * Get all system playlists
 */
export function getAllSystemPlaylists(): SystemPlaylist[] {
  return SYSTEM_PLAYLISTS;
}

/**
 * Get system playlists organized by column for grid layout
 */
export function getSystemPlaylistsByColumn(): {
  left: SystemPlaylist[];
  right: SystemPlaylist[];
} {
  const left = SYSTEM_PLAYLISTS.filter(p => p.column === 'left').sort(
    (a, b) => a.order - b.order,
  );
  const right = SYSTEM_PLAYLISTS.filter(p => p.column === 'right').sort(
    (a, b) => a.order - b.order,
  );
  return {left, right};
}
