export interface OnboardingPage {
  id: string;
  icon: string;
  isCustomIcon?: boolean;
  gradientColors?: [string, string];
  title: string;
  subtitle?: string;
  description: string;
}

export const ONBOARDING_PAGES: OnboardingPage[] = [
  {
    id: 'welcome',
    icon: 'app-icon',
    title: 'Welcome to Bayaan',
    subtitle: 'A New Chapter',
    description:
      'A beautiful Mushaf, ayah highlighting, word-by-word translation, adhkar, ambient sounds, and so much more.',
  },
  {
    id: 'mushaf',
    icon: 'book-outline',
    isCustomIcon: true,
    gradientColors: ['#3B82F6', '#1D4ED8'],
    title: 'The Mushaf',
    description:
      'A dedicated reading screen with the full Uthmani script, beautiful tajweed coloring, and an immersive reading mode.',
  },
  {
    id: 'highlighting',
    icon: 'locate-outline',
    gradientColors: ['#8B5CF6', '#6D28D9'],
    title: 'Follow Along',
    description:
      'Each ayah highlights in sync with the recitation so you never lose your place. Available for most of your favorite reciters, and coming to all reciters soon.',
  },
  {
    id: 'memorize',
    icon: 'repeat-outline',
    isCustomIcon: true,
    gradientColors: ['#6366F1', '#4338CA'],
    title: 'Listen to Memorize',
    description:
      'Repeat a single ayah, play a range of verses, or loop an entire page. Perfect for hifdh and review.',
  },
  {
    id: 'uploads',
    icon: 'cloud-upload-outline',
    gradientColors: ['#06B6D4', '#0891B2'],
    title: 'Personal Recitations',
    description:
      'Import your own audio recordings, tag them with surah and reciter metadata, and organize your personal collection.',
  },
  {
    id: 'ambient',
    icon: 'leaf-outline',
    isCustomIcon: true,
    gradientColors: ['#10B981', '#059669'],
    title: 'Ambient Sounds',
    description:
      'Layer calming nature soundscapes like rain, ocean, forest, and more over your recitation for a focused experience.',
  },
  {
    id: 'verse-interactions',
    icon: 'bookmark-outline',
    gradientColors: ['#F59E0B', '#D97706'],
    title: 'Verse Interactions',
    description:
      'Bookmark, highlight, take notes, copy, and share any verse. Your annotations sync across the app.',
  },
  {
    id: 'adhkar',
    icon: 'flower-outline',
    isCustomIcon: true,
    gradientColors: ['#EC4899', '#DB2777'],
    title: 'Adhkar (Remembrance)',
    description:
      'The complete Hisnul Muslim collection with audio playback, Play All mode, and saved favorites.',
  },
  {
    id: 'wbw',
    icon: 'text-outline',
    isCustomIcon: true,
    gradientColors: ['#0EA5E9', '#0284C7'],
    title: 'Word by Word',
    description:
      'Tap any word to see its meaning, transliteration, and grammar — right in the mushaf or player.',
  },
  {
    id: 'translations',
    icon: 'language-outline',
    isCustomIcon: true,
    gradientColors: ['#A855F7', '#7C3AED'],
    title: 'Translations & Tafseer',
    description:
      'Browse dozens of translations and scholarly commentaries in multiple languages, all downloadable for offline use.',
  },
  {
    id: 'themes',
    icon: 'color-palette-outline',
    isCustomIcon: true,
    gradientColors: ['#F43F5E', '#E11D48'],
    title: 'Thematic Highlighting',
    description:
      'Verses are color-coded by theme so you can see the structure and topics of each surah at a glance.',
  },
  {
    id: 'indopak',
    icon: 'globe-outline',
    gradientColors: ['#22D3EE', '#06B6D4'],
    title: 'IndoPak Script',
    description:
      'Switch to the IndoPak Nastaliq script in the mushaf for the style used across South Asia.',
  },
  {
    id: 'downloads',
    icon: 'download-outline',
    isCustomIcon: true,
    gradientColors: ['#14B8A6', '#0D9488'],
    title: 'Offline Downloads',
    description:
      'Download individual surahs or entire playlists so you can listen without an internet connection.',
  },
  {
    id: 'playlists',
    icon: 'list-outline',
    isCustomIcon: true,
    gradientColors: ['#F97316', '#EA580C'],
    title: 'Playlists',
    description:
      'Create custom playlists, reorder tracks, and build your own listening routines.',
  },
];
