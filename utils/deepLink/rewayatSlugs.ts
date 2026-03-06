/**
 * Rewayat slug utilities for user-friendly URLs
 */

import { Rewayat } from '@/data/reciterData';

/**
 * Convert rewayat name to URL-friendly slug
 */
export function rewayatNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/['\u2019]/g, '') // Remove apostrophes
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .replace(/-+/g, '-'); // Collapse multiple hyphens
}

/**
 * Find rewayat by slug within a reciter's rewayat list
 */
export function findRewayatBySlug(rewayat: Rewayat[], slug: string): Rewayat | null {
  // First try exact slug match
  const bySlug = rewayat.find(r => rewayatNameToSlug(r.name) === slug);
  if (bySlug) return bySlug;
  
  // Try partial matches for common variations
  const normalized = slug.toLowerCase();
  
  // Handle common shortened forms
  if (normalized === 'hafs' || normalized.includes('hafs')) {
    return rewayat.find(r => r.name.includes('Hafs')) || null;
  }
  
  if (normalized === 'warsh' || normalized.includes('warsh')) {
    return rewayat.find(r => r.name.includes('Warsh')) || null;
  }
  
  if (normalized === 'qalun' || normalized.includes('qalun')) {
    return rewayat.find(r => r.name.includes('Qalun')) || null;
  }
  
  if (normalized === 'duri' || normalized.includes('duri')) {
    return rewayat.find(r => r.name.includes('Duri')) || null;
  }
  
  // Try UUID lookup as fallback (for backward compatibility)
  const byId = rewayat.find(r => r.id === slug);
  if (byId) return byId;
  
  return null;
}

/**
 * Generate slug from rewayat for URLs
 */
export function generateRewayatSlug(rewayat: Rewayat): string {
  return rewayatNameToSlug(rewayat.name);
}

/**
 * Common rewayat slug mappings for reference
 */
export const COMMON_REWAYAT_SLUGS = {
  'hafs-an-assem': 'Hafs A\'n Assem',
  'warsh-an-nafi': 'Warsh A\'n Nafi\'',
  'qalun-an-nafi': 'Qalun A\'n Nafi\'',
  'duri-an-al-kisai': 'Duri A\'n Al-Kisa\'i',
} as const;

/**
 * Get the most common rewayat slug for a reciter (usually Hafs)
 */
export function getDefaultRewayatSlug(rewayat: Rewayat[]): string | null {
  // Prioritize Hafs A'n Assem if available
  const hafs = rewayat.find(r => r.name.includes('Hafs'));
  if (hafs) return generateRewayatSlug(hafs);
  
  // Otherwise use the first rewayat
  if (rewayat.length > 0) {
    return generateRewayatSlug(rewayat[0]);
  }
  
  return null;
}
