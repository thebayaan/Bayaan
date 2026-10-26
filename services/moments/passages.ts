// @ai-start
/**
 * Curated passages for Moments.
 *
 * Each passage is a run of whole ayat that reads as one unit of meaning.
 * Ranges line up with the QUL thematic passages in `data/quran-themes.json`
 * where a theme is short enough to play as one moment.
 */

import {SURAHS} from '@/data/surahData';

export interface MomentPassage {
  id: string;
  surah: number;
  fromAyah: number;
  toAyah: number;
}

export const MOMENT_PASSAGES: MomentPassage[] = [
  {id: '1:1-7', surah: 1, fromAyah: 1, toAyah: 7},
  {id: '2:255', surah: 2, fromAyah: 255, toAyah: 255},
  {id: '2:285-286', surah: 2, fromAyah: 285, toAyah: 286},
  {id: '3:190-194', surah: 3, fromAyah: 190, toAyah: 194},
  {id: '18:1-6', surah: 18, fromAyah: 1, toAyah: 6},
  {id: '55:1-13', surah: 55, fromAyah: 1, toAyah: 13},
  {id: '59:22-24', surah: 59, fromAyah: 22, toAyah: 24},
  {id: '67:1-4', surah: 67, fromAyah: 1, toAyah: 4},
  {id: '93:1-11', surah: 93, fromAyah: 1, toAyah: 11},
  {id: '94:1-8', surah: 94, fromAyah: 1, toAyah: 8},
  {id: '97:1-5', surah: 97, fromAyah: 1, toAyah: 5},
  {id: '103:1-3', surah: 103, fromAyah: 1, toAyah: 3},
  {id: '108:1-3', surah: 108, fromAyah: 1, toAyah: 3},
  {id: '112:1-4', surah: 112, fromAyah: 1, toAyah: 4},
  {id: '113:1-5', surah: 113, fromAyah: 1, toAyah: 5},
  {id: '114:1-6', surah: 114, fromAyah: 1, toAyah: 6},
];

export function isWholeSurah(passage: MomentPassage): boolean {
  const surah = SURAHS.find(s => s.id === passage.surah);
  return passage.fromAyah === 1 && surah?.verses_count === passage.toAyah;
}
// @ai-end
