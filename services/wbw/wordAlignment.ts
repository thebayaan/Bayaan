// @ai-generated
/**
 * Pairs the mushaf's word slots of a Hafs verse (DigitalKhatt words) with the
 * word-by-word words of the same verse. A word-by-word grid draws the
 * mushaf's own words and shows each with the gloss and transliteration of
 * its word-by-word word; the word-by-word position is also the key of the
 * i'rab, the meaning and the word audio. So this pairing decides what every
 * word is shown with.
 *
 * The two sources number the words of a verse alike, except where
 * DigitalKhatt writes one word-by-word word as two slots: بَعْدَ مَا in 2:181,
 * 8:6 and 13:37. alignDkWithWbw:
 *  1. takes the verse-end marker slot ('۝٧') out first: it is never paired;
 *  2. pairs the remaining slots 1:1 in order when there are as many slots as
 *     word-by-word words (every verse but those three);
 *  3. otherwise accumulates slot texts until they spell the word-by-word word
 *     (normalizeForMatch on both sides), so both slots of بَعْدَ مَا pair with
 *     one word and the words after it stay aligned. A slot that spells
 *     nothing pairs with the current word and moves on; slots left over
 *     after the last word pair with that last word.
 *
 * The 1:1 case never compares text. The word-by-word text spells hamza and
 * alef maksura differently, ends some words with a pause mark after a space,
 * and is damaged in places: U+FFFD in 55 words (25:42:9 is 'عَلَيْهَا' and two
 * U+FFFD), a trailing U+200F in 27:26:8. Comparing it mispaired 25:42 (every
 * word after word 9 took the previous word's gloss and the end marker was
 * drawn as a word) and 27:26 (the end marker was drawn inside word 8).
 * wordAlignment.database.test.ts checks every verse of the bundled data.
 */
import type {DKWordInfo} from '@/services/mushaf/DigitalKhattDataService';
import {parseVerseMarker} from '@/services/mushaf/RewayahVerseUnits';
import type {WBWWord} from '@/services/wbw/WBWDataService';

/** A DigitalKhatt word slot of a verse. */
export type DkSlot = Pick<DKWordInfo, 'text' | 'wordPositionInVerse'>;
/** A word-by-word word of the same verse. */
export type WbwToken = Pick<WBWWord, 'position' | 'textUthmani'>;

export interface WordPair<
  D extends DkSlot = DkSlot,
  W extends WbwToken = WbwToken,
> {
  dk: D;
  wbw: W;
}

export interface DkWbwAlignment<
  D extends DkSlot = DkSlot,
  W extends WbwToken = WbwToken,
> {
  /**
   * One entry per DigitalKhatt word slot, in slot order; a word-by-word word
   * drawn by two slots appears twice (بَعْدَ مَا).
   */
  pairs: WordPair<D, W>[];
  /** The verse-end marker slot ('۝٧'); never paired with a word. */
  endMarker: D | null;
}

/**
 * The diacritics WBWVerseView stripped before this module (harakat, Quranic
 * annotation and pause marks, tatweel, the combining hamzas, Arabic-Indic
 * digits), kept as they were so the N:1 pairing of 2:181, 8:6 and 13:37 is
 * unchanged.
 */
const ARABIC_DIACRITICS =
  // eslint-disable-next-line no-misleading-character-class
  /[\u064B-\u065F\u0670\u06D6-\u06ED\u0617-\u061A\u08D3-\u08FF\u0640\u06E5\u06E6\u0653-\u0655\u065F\uFE70-\uFE7F\u0610-\u0615\u0656-\u065E\u0660-\u066F]/g;

/**
 * Characters that are not part of a word: U+FFFD (damaged word-by-word
 * entries), the LRM / RLM marks (U+200E, U+200F) and the Arabic letter mark
 * (U+061C).
 */
const NOT_LETTERS = /[\uFFFD\u200E\u200F\u061C]/g;

/** A word's text for matching: diacritics and marks out, spaces collapsed. */
export function normalizeForMatch(text: string): string {
  return text
    .replace(ARABIC_DIACRITICS, '')
    .replace(NOT_LETTERS, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True for a verse-end marker slot ('۝٧'), as the words DBs store it. */
export function isVerseEndMarker(text: string): boolean {
  return parseVerseMarker(text) !== null;
}

/**
 * Pairs a verse's DigitalKhatt slots (in slot order, the marker included)
 * with its word-by-word words (in position order). See the module comment.
 */
export function alignDkWithWbw<D extends DkSlot, W extends WbwToken>(
  dk: readonly D[],
  wbw: readonly W[],
): DkWbwAlignment<D, W> {
  let endMarker: D | null = null;
  const slots: D[] = [];
  for (const slot of dk) {
    if (isVerseEndMarker(slot.text)) endMarker = slot;
    else slots.push(slot);
  }

  const pairs: WordPair<D, W>[] = [];
  if (slots.length === 0 || wbw.length === 0) return {pairs, endMarker};

  if (slots.length === wbw.length) {
    for (let i = 0; i < slots.length; i++) {
      pairs.push({dk: slots[i], wbw: wbw[i]});
    }
    return {pairs, endMarker};
  }

  let wbwIdx = 0;
  let accumulated = '';
  for (const slot of slots) {
    if (wbwIdx >= wbw.length) {
      pairs.push({dk: slot, wbw: wbw[wbw.length - 1]});
      continue;
    }
    const word = wbw[wbwIdx];
    pairs.push({dk: slot, wbw: word});
    const dkNorm = normalizeForMatch(slot.text);
    const wbwNorm = normalizeForMatch(word.textUthmani);
    accumulated = accumulated ? `${accumulated} ${dkNorm}` : dkNorm;
    // The slots so far start the word (it is written as several slots): the
    // next slot continues the same word.
    if (wbwNorm.startsWith(`${accumulated} `)) continue;
    // The slots spell the word, or nothing matches: the next slot is the
    // next word.
    wbwIdx++;
    accumulated = '';
  }
  return {pairs, endMarker};
}

/**
 * The DigitalKhatt slot positions of each word-by-word word, by word-by-word
 * position, in slot order (2:181: word 3 -> slots [3, 4]).
 */
export function slotsByWbwPosition(
  pairs: readonly WordPair[],
): Map<number, number[]> {
  const out = new Map<number, number[]>();
  for (const {dk, wbw} of pairs) {
    const slots = out.get(wbw.position);
    if (slots) slots.push(dk.wordPositionInVerse);
    else out.set(wbw.position, [dk.wordPositionInVerse]);
  }
  return out;
}
