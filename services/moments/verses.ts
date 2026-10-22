// @ai-start
import type {QuranData} from '@/types/quran';
import {getBundledTranslation} from '@/utils/translationLookup';

const quranData = require('@/data/quran.json') as QuranData;

const arabicByKey = new Map<string, string>();
for (const verse of Object.values(quranData)) {
  // The bundled text ends with the ayah number in Arabic digits.
  arabicByKey.set(verse.verse_key, verse.text.replace(/\s*[٠-٩]+\s*$/, ''));
}

export function getAyahArabic(surah: number, ayah: number): string {
  return arabicByKey.get(`${surah}:${ayah}`) ?? '';
}

export function getAyahTranslation(surah: number, ayah: number): string {
  return getBundledTranslation(`${surah}:${ayah}`, 'saheeh')
    .replace(/<sup[^>]*>.*?<\/sup>/g, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}

/**
 * Text for "Copy ayah text": Arabic, translation and citation, in the same
 * layout as the verse actions sheet. Moments only plays Hafs, so the citation
 * carries no rewayah label.
 */
export function getAyahCopyText(surah: number, ayah: number): string {
  return [
    getAyahArabic(surah, ayah),
    getAyahTranslation(surah, ayah),
    `Quran ${surah}:${ayah}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}
// @ai-end
