// @ai-generated
/**
 * The word model of Word Study, as pure functions over loaded data: the
 * words a selection steps through, references to them, and the root and
 * lemma of a word's morphology.
 *
 * A word is a word-by-word word, named by its Hafs verse and word-by-word
 * position: the key of its i'rab, meaning, transliteration and audio. It is
 * shown with the mushaf's own (DigitalKhatt) text of its slots, never the
 * word-by-word textUthmani, which is damaged in some words (2:4:9 holds
 * U+FFFD). Its slots ('S:A:W', Hafs locations) are the key of the readings;
 * they differ from the word-by-word position only in 2:181, 8:6 and 13:37,
 * where DigitalKhatt writes بَعْدَ مَا as two slots
 * (services/wbw/wordAlignment.ts).
 */
import {
  MORPH_LEMMA_LABEL,
  MORPH_ROOT_LABEL,
  type MorphFact,
} from '@/services/irab/irabFormat';
import type {DKWordInfo} from '@/services/mushaf/DigitalKhattDataService';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import type {WBWWord} from '@/services/wbw/WBWDataService';
import {alignDkWithWbw, slotsByWbwPosition} from '@/services/wbw/wordAlignment';
import {
  getDkFontFamily,
  type MushafRenderer,
} from '@/store/mushafSettingsStore';
import type {WordStudyPart} from './verseUnitScreens';

/** A word: its Hafs verse and word-by-word position. */
export interface WordRef {
  verseKey: string;
  position: number;
}

/** A word of a selection's sequence. */
export interface StudyWord extends WordRef {
  /** Its place in the sequence, 0-based. */
  index: number;
  /** The index of the part (selectionWordParts) holding it. */
  part: number;
  /** Its DigitalKhatt Hafs slots, 'S:A:W', in order (two for بَعْدَ مَا). */
  slots: readonly string[];
  /** The DigitalKhatt text of its slots, joined by ' '. */
  text: string;
}

/** A part's loaded words: its Hafs DigitalKhatt slots and word-by-word words. */
export interface PartWords {
  dk: readonly DKWordInfo[];
  wbw: readonly WBWWord[];
}

/**
 * Every word of the parts in reading order, across verses: for each part,
 * the word-by-word words whose first DigitalKhatt slot lies in its
 * wordRange (all of them without one), never the verse-end marker. `words`
 * is keyed by the part's verse key; a part without loaded words adds none.
 */
export function buildWordSequence(
  parts: readonly WordStudyPart[],
  words: ReadonlyMap<string, PartWords>,
): StudyWord[] {
  const sequence: StudyWord[] = [];
  parts.forEach((part, partIndex) => {
    const loaded = words.get(part.verseKey);
    if (!loaded) return;
    const {pairs} = alignDkWithWbw(loaded.dk, loaded.wbw);
    const slotText = new Map<number, string>();
    for (const {dk} of pairs) slotText.set(dk.wordPositionInVerse, dk.text);
    const range = part.wordRange;
    // In reading order: a word's first pair comes before the next word's.
    for (const [position, slots] of slotsByWbwPosition(pairs)) {
      const first = slots[0];
      if (range && (first < range.first || first > range.last)) continue;
      sequence.push({
        verseKey: part.verseKey,
        position,
        index: sequence.length,
        part: partIndex,
        slots: slots.map(slot => `${part.verseKey}:${slot}`),
        text: slots.map(slot => slotText.get(slot) ?? '').join(' '),
      });
    }
  });
  return sequence;
}

/** True when both name the same word. */
export function sameWord(a: WordRef, b: WordRef): boolean {
  return a.verseKey === b.verseKey && a.position === b.position;
}

/** The index of `ref` in the sequence; -1 when it is not there (or null). */
export function indexOfWord(
  sequence: readonly StudyWord[],
  ref: WordRef | null | undefined,
): number {
  if (!ref) return -1;
  return sequence.findIndex(word => sameWord(word, ref));
}

/** A word's morphology: root and lemma apart, the other facts in data order. */
export interface MorphSummary {
  /** The root as the data writes it, spaced letters ("م ل ك"); null if none. */
  root: string | null;
  /** The lemma (الأصل المعجمي); null if none. */
  lemma: string | null;
  /** Every other fact, in data order. */
  rest: readonly MorphFact[];
}

/** Takes the root (MORPH_ROOT_LABEL) and lemma (MORPH_LEMMA_LABEL) out. */
export function summarizeMorph(facts: readonly MorphFact[]): MorphSummary {
  let root: string | null = null;
  let lemma: string | null = null;
  const rest: MorphFact[] = [];
  for (const fact of facts) {
    if (root === null && fact.label === MORPH_ROOT_LABEL) {
      root = fact.value.trim() || null;
    } else if (lemma === null && fact.label === MORPH_LEMMA_LABEL) {
      lemma = fact.value.trim() || null;
    } else {
      rest.push(fact);
    }
  }
  return {root, lemma, rest};
}

/**
 * A root's letters without the spaces ('م ل ك' -> 'ملك'), as typed in a
 * search box. The Quran search keys its roots by the morphology value itself
 * (roots.root is the spaced form): RootResults takes MorphSummary.root as
 * is, not this.
 */
export function rootSearchKey(root: string): string {
  return root.replace(/\s+/g, '');
}

/** The DigitalKhatt faces registered for React Native Text (AppInitializer). */
export type RnQuranFontFamily = 'DigitalKhattV1' | 'DigitalKhattV2';

/**
 * The DigitalKhatt face for Quran text drawn with React Native Text: the
 * face getDkFontFamily gives Skia for the renderer and rewayah, except
 * IndoPak, a Skia-only face, which is drawn in Madani 1421 (V2).
 */
export function rnQuranFontFamily(
  renderer: MushafRenderer,
  rewayah: RewayahId,
): RnQuranFontFamily {
  const family = getDkFontFamily(renderer, rewayah);
  return family === 'DigitalKhattIndoPak' ? 'DigitalKhattV2' : family;
}
