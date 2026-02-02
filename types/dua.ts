// Broad tag type for categorizing duas
export type DuaBroadTag =
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
export interface DuaCategory {
  id: string;
  title: string;
  duaCount: number;
  broadTags: DuaBroadTag[];
}

// Individual dua
export interface Dua {
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
export interface DuaFavorite {
  duaId: string;
  createdAt: number;
}

// For tasbeeh counter with daily reset tracking
export interface DuaCount {
  duaId: string;
  count: number;
  lastUpdated: number; // Unix timestamp for daily reset check
}

// Seed data structure (matches JSON file format)
export interface DuaSeedData {
  meta: {
    total_categories: number;
    total_duas: number;
    audio_source: string;
    source_book: string;
  };
  categories: Array<{
    id: string;
    title: string;
    broad_tags: string[];
    dua_count: number;
  }>;
  duas: Array<{
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
