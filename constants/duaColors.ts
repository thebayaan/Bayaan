import {DuaBroadTag} from '@/types/dua';

/**
 * Color mapping for dua broad tags
 * Used for CategoryCard gradients and section headers
 */
export const DUA_TAG_COLORS: Record<DuaBroadTag, string> = {
  daily: '#4F46E5', // Indigo - morning/evening adhkar
  prayer: '#059669', // Emerald - salah related
  protection: '#7C3AED', // Violet - protection duas
  health: '#10B981', // Green - healing
  travel: '#F59E0B', // Amber - journeys
  food: '#EF4444', // Red - eating/drinking
  social: '#EC4899', // Pink - relationships
  nature: '#06B6D4', // Cyan - weather, animals
  spiritual: '#8B5CF6', // Purple - worship
  home: '#F97316', // Orange - house/family
  clothing: '#6366F1', // Indigo - dressing
  general: '#6B7280', // Gray - miscellaneous
};

/**
 * Get color for a tag, with fallback
 */
export function getTagColor(tag: DuaBroadTag | string): string {
  return DUA_TAG_COLORS[tag as DuaBroadTag] ?? DUA_TAG_COLORS.general;
}

/**
 * Display names for tags (for section headers)
 */
export const DUA_TAG_NAMES: Record<DuaBroadTag, string> = {
  daily: 'Daily Adhkar',
  prayer: 'Prayer',
  protection: 'Protection',
  health: 'Health & Healing',
  travel: 'Travel',
  food: 'Food & Drink',
  social: 'Social',
  nature: 'Nature',
  spiritual: 'Spiritual',
  home: 'Home & Family',
  clothing: 'Clothing',
  general: 'General',
};

/**
 * Order of tags for display (most important first)
 */
export const DUA_TAG_ORDER: DuaBroadTag[] = [
  'daily',
  'prayer',
  'protection',
  'spiritual',
  'health',
  'travel',
  'food',
  'home',
  'social',
  'nature',
  'clothing',
  'general',
];
