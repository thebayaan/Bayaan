// @ai-generated
/**
 * Text helpers of the word-study sections. They live here, not in
 * utils/rtl.ts and i18n/format.ts as the design suggested, because those
 * files belong to no track of the word-study plan; move them there when
 * another screen needs them.
 */
import {currentLanguage} from '@/i18n/language';
import {getLanguageConfig, type AppLanguage} from '@/i18n/languages';

/**
 * Wraps a value in Unicode isolates (FSI … PDI), so a value of the other
 * direction does not scramble the punctuation around it
 * (docs/i18n/README.md, Mixed-direction strings).
 */
export const isolate = (value: string): string => `\u2068${value}\u2069`;

/**
 * The Arabic or the English form of a bilingual data field, as the
 * language's `bilingualContent` decides; Arabic when the English form is
 * empty.
 */
export function pickBilingualText(
  ar: string,
  en: string,
  language: AppLanguage = currentLanguage,
): string {
  return getLanguageConfig(language).bilingualContent === 'ar' || !en ? ar : en;
}

/** Text cut near `max` characters at a space, with an ellipsis. */
export function cutText(text: string, max: number): string {
  if (text.length <= max) return text;
  const space = text.lastIndexOf(' ', max);
  return `${text.slice(0, space > max * 0.75 ? space : max).trimEnd()}…`;
}

/** A text split into marked and unmarked runs by UTF-16 ranges [from, to). */
export function markRuns(
  text: string,
  marks: readonly (readonly [number, number])[],
): {text: string; marked: boolean}[] {
  const ranges = marks
    .map(([a, b]) => [Math.max(0, a), Math.min(text.length, b)] as const)
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  const merged: [number, number][] = [];
  for (const [a, b] of ranges) {
    const last = merged[merged.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  const runs: {text: string; marked: boolean}[] = [];
  let at = 0;
  for (const [a, b] of merged) {
    if (a > at) runs.push({text: text.slice(at, a), marked: false});
    runs.push({text: text.slice(a, b), marked: true});
    at = b;
  }
  if (at < text.length) runs.push({text: text.slice(at), marked: false});
  return runs;
}
