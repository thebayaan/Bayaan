import type {QuranData, Verse} from '@/types/quran';
import {SURAHS} from '@/data/surahData';
import {getBundledTranslation} from '@/utils/translationLookup';

const TOTAL_VERSES = 6236;

function dateKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function hashToVerseIndex(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(31, h) + key.charCodeAt(i);
  }
  return Math.abs(h) % TOTAL_VERSES;
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '');
}

let sortedVersesCache: Verse[] | null = null;

function getSortedVerses(): Verse[] {
  if (sortedVersesCache) return sortedVersesCache;
  const quranData = require('@/data/quran.json') as QuranData;
  sortedVersesCache = Object.values(quranData).sort((a, b) => a.id - b.id);
  return sortedVersesCache;
}

export interface VerseOfTheDay {
  verseKey: string;
  arabicText: string;
  translation: string;
  surahName: string;
  surahNumber: number;
  ayahNumber: number;
}

/**
 * Deterministic verse for the user's local calendar day (same ayah for everyone on a given date).
 */
export function getVerseOfTheDayForDate(
  date: Date = new Date(),
): VerseOfTheDay {
  const verses = getSortedVerses();
  const idx = hashToVerseIndex(dateKeyLocal(date));
  const v = verses[idx];
  const surah = SURAHS[v.surah_number - 1];
  const translationRaw = getBundledTranslation(v.verse_key, 'saheeh');
  const translation = stripHtml(translationRaw).replace(/\s+/g, ' ').trim();

  return {
    verseKey: v.verse_key,
    arabicText: v.text,
    translation,
    surahName: surah?.name ?? `Surah ${v.surah_number}`,
    surahNumber: v.surah_number,
    ayahNumber: v.ayah_number,
  };
}

export function truncateForWidget(text: string, maxChars: number): string {
  const t = text.trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, Math.max(0, maxChars - 1)).trim()}…`;
}
