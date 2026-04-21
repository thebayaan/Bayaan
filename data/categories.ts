export interface Surah {
  id: number;
  name: string;
  verses?: number;
  period?: 'meccan' | 'medinan';
}

export interface Category {
  id: string;
  title: string;
  description?: string;
  surahs: Surah[];
}

export interface BrowseCategoryIcon {
  name: string;
  type: string;
}

export interface BrowseCategory {
  id: string;
  title: string;
  description?: string;
  backgroundColor: string;
  icon: BrowseCategoryIcon;
  route: string;
  featured?: boolean;
}

export const FEATURED_COLLECTIONS: Category[] = [
  {
    id: 'juz-amma',
    title: 'Juz Amma',
    description: 'The last 37 surahs of the Quran',
    surahs: Array.from({length: 37}, (_, i) => ({
      id: 78 + i,
      name: `Surah ${78 + i}`,
    })),
  },
  {
    id: 'seven-long',
    title: 'The Seven Long Surahs',
    description: "Al-Sab' Al-Tiwal",
    surahs: [
      {id: 2, name: 'Al-Baqarah'},
      {id: 3, name: 'Al-Imran'},
      {id: 4, name: 'An-Nisa'},
      {id: 5, name: "Al-Ma'idah"},
      {id: 6, name: "Al-An'am"},
      {id: 7, name: "Al-A'raf"},
      {id: 9, name: 'At-Tawbah'},
    ],
  },
  {
    id: 'heart-of-quran',
    title: 'Heart of the Quran',
    description: 'Most impactful surahs',
    surahs: [
      {id: 36, name: 'Yasin'},
      {id: 55, name: 'Al-Rahman'},
      {id: 56, name: "Al-Waqi'ah"},
      {id: 67, name: 'Al-Mulk'},
      {id: 18, name: 'Al-Kahf'},
    ],
  },
  {
    id: 'daily-adhkar',
    title: 'Daily Adhkar',
    description: 'Surahs commonly recited daily',
    surahs: [
      {id: 112, name: 'Al-Ikhlas'},
      {id: 113, name: 'Al-Falaq'},
      {id: 114, name: 'An-Nas'},
      {id: 1, name: 'Al-Fatiha'},
    ],
  },
];

export const THEMATIC_COLLECTIONS: Category[] = [
  {
    id: 'prophets',
    title: 'Stories of the Prophets',
    surahs: [
      {id: 12, name: 'Yusuf'},
      {id: 19, name: 'Maryam'},
      {id: 28, name: 'Al-Qasas'},
      {id: 71, name: 'Nuh'},
      {id: 21, name: 'Al-Anbiya'},
      {id: 14, name: 'Ibrahim'},
    ],
  },
  {
    id: 'mercy',
    title: 'Mercy and Forgiveness',
    surahs: [
      {id: 55, name: 'Al-Rahman'},
      {id: 40, name: 'Al-Ghafir'},
      {id: 39, name: 'Az-Zumar'},
      {id: 9, name: 'At-Tawbah'},
    ],
  },
  {
    id: 'faith',
    title: 'Faith and Belief',
    surahs: [
      {id: 112, name: 'Al-Ikhlas'},
      {id: 109, name: 'Al-Kafirun'},
      {id: 103, name: 'Al-Asr'},
      {id: 2, name: 'Al-Baqarah'},
    ],
  },
];

export const LENGTH_BASED_COLLECTIONS: Category[] = [
  {
    id: 'short',
    title: 'Short Surahs',
    description: 'Less than 20 verses',
    surahs: [
      {id: 108, name: 'Al-Kawthar', verses: 3},
      {id: 112, name: 'Al-Ikhlas', verses: 4},
      {id: 103, name: 'Al-Asr', verses: 3},
      {id: 110, name: 'An-Nasr', verses: 3},
    ],
  },
  {
    id: 'medium',
    title: 'Medium Surahs',
    description: '20-100 verses',
    surahs: [
      {id: 36, name: 'Yasin', verses: 83},
      {id: 55, name: 'Al-Rahman', verses: 78},
      {id: 56, name: "Al-Waqi'ah", verses: 96},
    ],
  },
  {
    id: 'long',
    title: 'Long Surahs',
    description: 'More than 100 verses',
    surahs: [
      {id: 2, name: 'Al-Baqarah', verses: 286},
      {id: 3, name: 'Al-Imran', verses: 200},
      {id: 4, name: 'An-Nisa', verses: 176},
    ],
  },
];

export const PERIOD_BASED_COLLECTIONS: Category[] = [
  {
    id: 'meccan',
    title: 'Notable Meccan Surahs',
    surahs: [
      {id: 96, name: 'Al-Alaq', period: 'meccan'},
      {id: 74, name: 'Al-Muddaththir', period: 'meccan'},
      {id: 73, name: 'Al-Muzzammil', period: 'meccan'},
      {id: 93, name: 'Ad-Duha', period: 'meccan'},
    ],
  },
  {
    id: 'medinan',
    title: 'Notable Medinan Surahs',
    surahs: [
      {id: 2, name: 'Al-Baqarah', period: 'medinan'},
      {id: 8, name: 'Al-Anfal', period: 'medinan'},
      {id: 24, name: 'An-Nur', period: 'medinan'},
      {id: 49, name: 'Al-Hujurat', period: 'medinan'},
    ],
  },
];

export const SPECIAL_COLLECTIONS: Category[] = [
  {
    id: 'most-recited',
    title: 'Most Recited',
    surahs: [
      {id: 1, name: 'Al-Fatiha'},
      {id: 2, name: 'Al-Baqarah'},
      {id: 36, name: 'Yasin'},
      {id: 67, name: 'Al-Mulk'},
      {id: 18, name: 'Al-Kahf'},
    ],
  },
  {
    id: 'most-loved',
    title: 'Most Loved by Community',
    surahs: [
      {id: 55, name: 'Al-Rahman'},
      {id: 36, name: 'Yasin'},
      {id: 18, name: 'Al-Kahf'},
      {id: 56, name: "Al-Waqi'ah"},
      {id: 67, name: 'Al-Mulk'},
    ],
  },
];

export const BROWSE_CATEGORIES: BrowseCategory[] = [
  {
    id: 'juz-amma',
    title: 'Juz Amma',
    backgroundColor: '#1E40AF',
    icon: {name: 'book-open', type: 'feather'},
    route: '/juz-amma',
    featured: true,
  },
  {
    id: 'daily-adhkar',
    title: 'Daily Adhkar',
    backgroundColor: '#059669',
    icon: {name: 'sun', type: 'feather'},
    route: '/daily-adhkar',
    featured: true,
  },
  {
    id: 'prophets',
    title: 'Stories of Prophets',
    backgroundColor: '#7C3AED',
    icon: {name: 'book', type: 'feather'},
    route: '/stories',
  },
  {
    id: 'heart-of-quran',
    title: 'Heart of Quran',
    backgroundColor: '#DC2626',
    icon: {name: 'heart', type: 'feather'},
    route: '/heart-of-quran',
    featured: true,
  },
  {
    id: 'most-recited',
    title: 'Most Recited',
    backgroundColor: '#2563EB',
    icon: {name: 'trending-up', type: 'feather'},
    route: '/most-recited',
  },
  {
    id: 'short',
    title: 'Short Surahs',
    backgroundColor: '#EA580C',
    icon: {name: 'clock', type: 'feather'},
    route: '/short-surahs',
  },
  {
    id: 'meccan',
    title: 'Meccan Surahs',
    backgroundColor: '#0D9488',
    icon: {name: 'map', type: 'feather'},
    route: '/meccan',
  },
  {
    id: 'medinan',
    title: 'Medinan Surahs',
    backgroundColor: '#7C3AED',
    icon: {name: 'home', type: 'feather'},
    route: '/medinan',
  },
];
