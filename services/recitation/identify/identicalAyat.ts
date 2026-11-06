import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {SURAHS} from '@/data/surahData';

// Ayat with exactly the same wording sound the same, so recognition cannot
// tell which one is recited; Which ayah? names one and lists the others. In
// the Hafs text 264 ayat fall in 90 such groups (55:13 has 30 twins, 77:15
// has 10 including 83:10).

const AYAH_MARKER = '۝';

/**
 * For every ayah that shares its wording with others, those others in
 * mushaf order. Ayat with unique wording, or unknown wording, are absent.
 */
export function buildIdenticalAyatIndex(
  keys: readonly string[],
  wordingOf: (key: string) => string | null,
): Map<string, readonly string[]> {
  const groups = new Map<string, string[]>();
  for (const key of keys) {
    const wording = wordingOf(key);
    if (!wording) continue;
    const group = groups.get(wording);
    if (group) group.push(key);
    else groups.set(wording, [key]);
  }
  const index = new Map<string, readonly string[]>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (const key of group)
      index.set(
        key,
        group.filter(k => k !== key),
      );
  }
  return index;
}

function hafsWording(key: string): string | null {
  const words = digitalKhattDataService.tryGetVerseWords(key, 'hafs');
  if (!words || words.length === 0) return null;
  return words
    .filter(word => !word.text.trimStart().startsWith(AYAH_MARKER))
    .map(word => word.text)
    .join(' ');
}

function allVerseKeys(): string[] {
  const keys: string[] = [];
  for (const surah of SURAHS) {
    for (let ayah = 1; ayah <= surah.verses_count; ayah++) {
      keys.push(`${surah.id}:${ayah}`);
    }
  }
  return keys;
}

let index: Map<string, readonly string[]> | null = null;

/**
 * The other ayat worded exactly like `verseKey` (a Hafs key). Empty until
 * the Hafs text is loaded; the index is built once, on first use.
 */
export function identicalAyatOf(verseKey: string): readonly string[] {
  if (!index) {
    if (!digitalKhattDataService.isRewayahReady('hafs')) return [];
    index = buildIdenticalAyatIndex(allVerseKeys(), hafsWording);
  }
  return index.get(verseKey) ?? [];
}
