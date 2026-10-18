/**
 * The phone's curated surah collections (data/systemPlaylists.ts), for
 * Home's "Collections" rail. Copied rather than imported: the phone module
 * reads its titles from i18n and the brand config, which the TV app does not
 * resolve. Juz 'Amma is left out because Home gives it a rail of its own.
 * Keep in sync when the phone adds or changes a collection.
 */
export type SurahCollection = {
  id: string;
  title: string;
  /** One line under the title, from the phone's description. */
  description: string;
  color: string;
  surahs: readonly number[];
};

export const SURAH_COLLECTIONS: readonly SurahCollection[] = [
  {
    id: 'most-loved',
    title: 'Most Loved',
    description: 'Community favourites',
    color: '#EF4444',
    surahs: [18, 36, 55, 56, 67],
  },
  {
    id: 'morning-reflections',
    title: 'Morning Reflections',
    description: 'Gratitude and hope to start the day',
    color: '#F59E0B',
    surahs: [1, 93, 94, 112, 113, 114],
  },
  {
    id: 'quick-listen',
    title: 'Quick Listen',
    description: 'For a short break',
    color: '#8B5CF6',
    surahs: [36, 55, 56, 67, 78],
  },
  {
    id: 'heart-softeners',
    title: 'Heart Softeners',
    description: 'Recitations that move the soul',
    color: '#EC4899',
    surahs: [12, 18, 19, 36, 55, 56],
  },
  {
    id: 'evening-serenity',
    title: 'Evening Serenity',
    description: 'Calm surahs for the evening',
    color: '#6366F1',
    surahs: [36, 55, 67, 76, 89],
  },
  {
    id: 'friday-essentials',
    title: 'Friday Essentials',
    description: 'Al-Kahf and the Friday recitations',
    color: '#059669',
    surahs: [18, 32, 62, 76],
  },
  {
    id: 'stories-prophets',
    title: 'Stories of the Prophets',
    description: 'The narratives of the messengers',
    color: '#0EA5E9',
    surahs: [10, 11, 12, 14, 19, 71],
  },
  {
    id: 'protection-healing',
    title: 'Protection & Healing',
    description: 'Surahs for seeking refuge in Allah',
    color: '#10B981',
    surahs: [1, 2, 112, 113, 114],
  },
  {
    id: 'memorization-station',
    title: 'Memorization Station',
    description: 'Short surahs to begin memorizing',
    color: '#7C3AED',
    surahs: [1, 103, 108, 109, 110, 111, 112, 113, 114],
  },
  {
    id: 'focus-study',
    title: 'Focus & Study',
    description: 'Measured recitations for long sessions',
    color: '#14B8A6',
    surahs: [2, 3, 4, 18],
  },
  {
    id: 'bayaan-essentials',
    title: 'Bayaan Essentials',
    description: 'Our picks for every listener',
    color: '#DC2626',
    surahs: [1, 18, 36, 55, 67, 112],
  },
];

/** Juz 'Amma, the 30th juz: An-Naba to An-Nas. */
export const JUZ_AMMA_SURAHS: readonly number[] = Array.from(
  {length: 114 - 78 + 1},
  (_, i) => 78 + i,
);
