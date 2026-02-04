import {AdhkarBroadTag} from '@/types/adhkar';

/**
 * Color mapping for adhkar broad tags
 * Used for CategoryCard gradients and section headers
 */
export const ADHKAR_TAG_COLORS: Record<AdhkarBroadTag, string> = {
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
export function getTagColor(tag: AdhkarBroadTag | string): string {
  return ADHKAR_TAG_COLORS[tag as AdhkarBroadTag] ?? ADHKAR_TAG_COLORS.general;
}

/**
 * Display names for tags (for section headers)
 */
export const ADHKAR_TAG_NAMES: Record<AdhkarBroadTag, string> = {
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
export const ADHKAR_TAG_ORDER: AdhkarBroadTag[] = [
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
