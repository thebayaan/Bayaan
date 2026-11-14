// @ai-generated
/**
 * Where the recording of one word is: Quran.com's word-by-word audio on
 * audio.qurancdn.com, named by Hafs verse and word-by-word position
 * (`wbw/002_255_003.mp3`).
 *
 * The URL is built from the position, not read from the word-by-word data:
 * its audio_url uses Quran.com's total-token numbering, which also counts
 * stop marks, while the qurancdn.com files use word-only numbering, so it
 * names the wrong file in verses with stop marks (in 2:2 word 5, فِيهِ, has
 * audio_url wbw/002_002_006.mp3). Generating from the position is always
 * correct. Moved from WordDetailSheet.
 */

const VERSE_KEY = /^(\d{1,3}):(\d{1,3})$/;
const SURAH_COUNT = 114;

const pad = (n: number) => String(n).padStart(3, '0');

/**
 * The audio URL of word `position` (word-by-word numbering, 1-based) of Hafs
 * verse `verseKey` ('2:255'); '' for a malformed key or position.
 */
export function wordAudioUrl(verseKey: string, position: number): string {
  const match = VERSE_KEY.exec(verseKey);
  if (!match || !Number.isInteger(position) || position < 1) return '';
  const surah = Number(match[1]);
  const ayah = Number(match[2]);
  if (surah < 1 || surah > SURAH_COUNT || ayah < 1) return '';
  const file = `${pad(surah)}_${pad(ayah)}_${pad(position)}.mp3`;
  return `https://audio.qurancdn.com/wbw/${file}`;
}
