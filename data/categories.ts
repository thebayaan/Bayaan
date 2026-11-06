// @ai-start
import i18n from '@/i18n';
// @ai-end

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

// @ai-start
export const FEATURED_COLLECTIONS: Category[] = [
  {
    id: 'juz-amma',
    get title() {
      return i18n.t('content:categories.juzAmma.title');
    },
    get description() {
      return i18n.t('content:categories.juzAmma.description');
    },
    surahs: Array.from({length: 37}, (_, i) => ({
      id: 78 + i,
      name: `Surah ${78 + i}`,
    })),
  },
  {
    id: 'seven-long',
    get title() {
      return i18n.t('content:categories.sevenLong.title');
    },
    get description() {
      return i18n.t('content:categories.sevenLong.description');
    },
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
    get title() {
      return i18n.t('content:categories.heartOfQuran.title');
    },
    get description() {
      return i18n.t('content:categories.heartOfQuran.description');
    },
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
    get title() {
      return i18n.t('content:categories.dailyAdhkar.title');
    },
    get description() {
      return i18n.t('content:categories.dailyAdhkar.description');
    },
    surahs: [
      {id: 112, name: 'Al-Ikhlas'},
      {id: 113, name: 'Al-Falaq'},
      {id: 114, name: 'An-Nas'},
      {id: 1, name: 'Al-Fatiha'},
    ],
  },
];
// @ai-end

// @ai-start
export const THEMATIC_COLLECTIONS: Category[] = [
  {
    id: 'prophets',
    get title() {
      return i18n.t('content:categories.prophets.title');
    },
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
    get title() {
      return i18n.t('content:categories.mercy.title');
    },
    surahs: [
      {id: 55, name: 'Al-Rahman'},
      {id: 40, name: 'Al-Ghafir'},
      {id: 39, name: 'Az-Zumar'},
      {id: 9, name: 'At-Tawbah'},
    ],
  },
  {
    id: 'faith',
    get title() {
      return i18n.t('content:categories.faith.title');
    },
    surahs: [
      {id: 112, name: 'Al-Ikhlas'},
      {id: 109, name: 'Al-Kafirun'},
      {id: 103, name: 'Al-Asr'},
      {id: 2, name: 'Al-Baqarah'},
    ],
  },
];
// @ai-end

// @ai-start
export const LENGTH_BASED_COLLECTIONS: Category[] = [
  {
    id: 'short',
    get title() {
      return i18n.t('content:categories.short.title');
    },
    get description() {
      return i18n.t('content:categories.short.description');
    },
    surahs: [
      {id: 108, name: 'Al-Kawthar', verses: 3},
      {id: 112, name: 'Al-Ikhlas', verses: 4},
      {id: 103, name: 'Al-Asr', verses: 3},
      {id: 110, name: 'An-Nasr', verses: 3},
    ],
  },
  {
    id: 'medium',
    get title() {
      return i18n.t('content:categories.medium.title');
    },
    get description() {
      return i18n.t('content:categories.medium.description');
    },
    surahs: [
      {id: 36, name: 'Yasin', verses: 83},
      {id: 55, name: 'Al-Rahman', verses: 78},
      {id: 56, name: "Al-Waqi'ah", verses: 96},
    ],
  },
  {
    id: 'long',
    get title() {
      return i18n.t('content:categories.long.title');
    },
    get description() {
      return i18n.t('content:categories.long.description');
    },
    surahs: [
      {id: 2, name: 'Al-Baqarah', verses: 286},
      {id: 3, name: 'Al-Imran', verses: 200},
      {id: 4, name: 'An-Nisa', verses: 176},
    ],
  },
];
// @ai-end

// @ai-start
export const PERIOD_BASED_COLLECTIONS: Category[] = [
  {
    id: 'meccan',
    get title() {
      return i18n.t('content:categories.meccan.title');
    },
    surahs: [
      {id: 96, name: 'Al-Alaq', period: 'meccan'},
      {id: 74, name: 'Al-Muddaththir', period: 'meccan'},
      {id: 73, name: 'Al-Muzzammil', period: 'meccan'},
      {id: 93, name: 'Ad-Duha', period: 'meccan'},
    ],
  },
  {
    id: 'medinan',
    get title() {
      return i18n.t('content:categories.medinan.title');
    },
    surahs: [
      {id: 2, name: 'Al-Baqarah', period: 'medinan'},
      {id: 8, name: 'Al-Anfal', period: 'medinan'},
      {id: 24, name: 'An-Nur', period: 'medinan'},
      {id: 49, name: 'Al-Hujurat', period: 'medinan'},
    ],
  },
];
// @ai-end

// @ai-start
export const SPECIAL_COLLECTIONS: Category[] = [
  {
    id: 'most-recited',
    get title() {
      return i18n.t('content:categories.mostRecited.title');
    },
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
    get title() {
      return i18n.t('content:categories.mostLoved.title');
    },
    surahs: [
      {id: 55, name: 'Al-Rahman'},
      {id: 36, name: 'Yasin'},
      {id: 18, name: 'Al-Kahf'},
      {id: 56, name: "Al-Waqi'ah"},
      {id: 67, name: 'Al-Mulk'},
    ],
  },
];
// @ai-end

// @ai-start
export const BROWSE_CATEGORIES: BrowseCategory[] = [
  {
    id: 'juz-amma',
    get title() {
      return i18n.t('content:categories.browse.juzAmma');
    },
    backgroundColor: '#1E40AF',
    icon: {name: 'book-open', type: 'feather'},
    route: '/juz-amma',
    featured: true,
  },
  {
    id: 'daily-adhkar',
    get title() {
      return i18n.t('content:categories.browse.dailyAdhkar');
    },
    backgroundColor: '#059669',
    icon: {name: 'sun', type: 'feather'},
    route: '/daily-adhkar',
    featured: true,
  },
  {
    id: 'prophets',
    get title() {
      return i18n.t('content:categories.browse.prophets');
    },
    backgroundColor: '#7C3AED',
    icon: {name: 'book', type: 'feather'},
    route: '/stories',
  },
  {
    id: 'heart-of-quran',
    get title() {
      return i18n.t('content:categories.browse.heartOfQuran');
    },
    backgroundColor: '#DC2626',
    icon: {name: 'heart', type: 'feather'},
    route: '/heart-of-quran',
    featured: true,
  },
  {
    id: 'most-recited',
    get title() {
      return i18n.t('content:categories.browse.mostRecited');
    },
    backgroundColor: '#2563EB',
    icon: {name: 'trending-up', type: 'feather'},
    route: '/most-recited',
  },
  {
    id: 'short',
    get title() {
      return i18n.t('content:categories.browse.short');
    },
    backgroundColor: '#EA580C',
    icon: {name: 'clock', type: 'feather'},
    route: '/short-surahs',
  },
  {
    id: 'meccan',
    get title() {
      return i18n.t('content:categories.browse.meccan');
    },
    backgroundColor: '#0D9488',
    icon: {name: 'map', type: 'feather'},
    route: '/meccan',
  },
  {
    id: 'medinan',
    get title() {
      return i18n.t('content:categories.browse.medinan');
    },
    backgroundColor: '#7C3AED',
    icon: {name: 'home', type: 'feather'},
    route: '/medinan',
  },
];
// @ai-end
