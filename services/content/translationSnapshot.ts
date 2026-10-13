import {SURAHS} from '@/data/surahData';
import type {TranslationFootnote} from '@/services/translation/TranslationDbService';
import type {QfSnapshot} from '@/types/content';
import type {TranslationVerse} from '@/types/translation';

export const VERSE_COUNT = 6236;
const VERSE_KEY = /^(\d{1,3}):(\d{1,3})$/;
// Ayah counts by surah: with uniqueness and the total, every key is a real verse.
const AYAH_COUNTS = new Map(
  SURAHS.map(surah => [surah.id, surah.verses_count]),
);

export interface ParsedTranslation {
  verses: TranslationVerse[];
  footnotes: TranslationFootnote[];
}

function parseVerseKey(value: unknown): {surah: number; ayah: number} | null {
  if (typeof value !== 'string') return null;
  const match = VERSE_KEY.exec(value);
  if (!match) return null;
  const surah = Number(match[1]);
  const ayah = Number(match[2]);
  const ayahCount = AYAH_COUNTS.get(surah);
  if (ayahCount === undefined || ayah < 1 || ayah > ayahCount) return null;
  return {surah, ayah};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// QF footnote ids are numbers; the verse markers carry them as text.
function footnoteId(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  return null;
}

function readFootnotes(value: unknown): TranslationFootnote[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error('translation_bad_footnotes');
  return value.map(item => {
    const id = isRecord(item) ? footnoteId(item.id) : null;
    if (!isRecord(item) || id === null || typeof item.text !== 'string')
      throw new Error('translation_bad_footnotes');
    return {id, text: item.text};
  });
}

// Unlike tafsir there are no verse groups: a translation must carry every
// verse exactly once, or the whole envelope is rejected before any write.
export function parseTranslationSnapshot(
  snapshot: QfSnapshot,
): ParsedTranslation {
  const verses: TranslationVerse[] = [];
  const seen = new Set<string>();
  const footnotes = new Map<string, TranslationFootnote>();
  for (const record of snapshot.records) {
    const position = parseVerseKey(record.verse_key);
    if (!position) throw new Error('translation_bad_verse_key');
    const verseKey = `${position.surah}:${position.ayah}`;
    if (seen.has(verseKey)) throw new Error('translation_duplicate_verse');
    if (typeof record.text !== 'string')
      throw new Error('translation_bad_text');
    seen.add(verseKey);
    verses.push({
      surahNumber: position.surah,
      ayahNumber: position.ayah,
      verseKey,
      text: record.text,
    });
    // A footnote id is the table's primary key per edition: keep the first.
    for (const footnote of readFootnotes(record.foot_notes)) {
      if (!footnotes.has(footnote.id)) footnotes.set(footnote.id, footnote);
    }
  }
  if (verses.length !== VERSE_COUNT) throw new Error('translation_verse_count');
  return {verses, footnotes: [...footnotes.values()]};
}
