// Broad tag type for categorizing adhkar
export type AdhkarBroadTag =
  | 'daily'
  | 'prayer'
  | 'protection'
  | 'health'
  | 'travel'
  | 'food'
  | 'social'
  | 'nature'
  | 'spiritual'
  | 'home'
  | 'clothing'
  | 'general';

// Category from database
export interface AdhkarCategory {
  id: string;
  title: string;
  dhikrCount: number;
  broadTags: AdhkarBroadTag[];
}

// Individual dhikr
export interface Dhikr {
  id: string;
  categoryId: string;
  arabic: string;
  translation: string | null;
  transliteration: string | null;
  instruction: string | null;
  repeatCount: number;
  audioFile: string | null;
  sortOrder: number;
}

// For favorites tracking
export interface DhikrFavorite {
  dhikrId: string;
  createdAt: number;
}

// For tasbeeh counter with daily reset tracking
export interface DhikrCount {
  dhikrId: string;
  count: number;
  lastUpdated: number; // Unix timestamp for daily reset check
}

// Super category section type
export type SuperCategorySection = 'main' | 'other';

// Super category (Life With Allah-style groupings)
export interface SuperCategory {
  id: string;
  title: string;
  arabicTitle: string | null;
  color: string;
  heightMultiplier: number; // 1, 2, or 3 (bento layout)
  column: 'left' | 'right';
  sortOrder: number;
  section: SuperCategorySection;
  categoryIds: string[]; // References to adhkar_categories.id
}

// Seed data structure (matches JSON file format)
export interface AdhkarSeedData {
  meta: {
    total_categories: number;
    total_adhkar: number;
    audio_source: string;
    source_book: string;
  };
  categories: Array<{
    id: string;
    title: string;
    broad_tags: string[];
    dhikr_count: number;
  }>;
  adhkar: Array<{
    id: string;
    category_id: string;
    arabic: string;
    translation: string | null;
    transliteration: string | null;
    instruction: string | null;
    repeat_count: number;
    audio_file: string | null;
    order_index: number;
  }>;
}
