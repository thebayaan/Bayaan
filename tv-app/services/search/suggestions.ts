/**
 * Autocomplete under the keyboard: as you type, the recent searches give way
 * to completions of the best matches, each tagged with what it is and with
 * the typed part marked, so "sh" reads ash-[sh]arh · Surah.
 */
import {ARTICLES, toSearchKey, tokenize} from '../../../utils/search/normalize';
import type {RankedItem, VerseRef} from './tvSearch';

export type SuggestionKind = 'Surah' | 'Reciter' | 'Adhkar' | 'Verse';

export type Suggestion = {
  key: string;
  label: string;
  kind: SuggestionKind;
  /** What pressing it puts in the search bar. */
  fill: string;
  /** The typed part inside `label`, as [start, end), or null. */
  match: readonly [number, number] | null;
};

export const MAX_SUGGESTIONS = 5;

export function verseLabel(ref: VerseRef): string {
  const at = `${ref.surah.id}:${ref.ayah}`;
  return ref.name ? `${ref.name} · ${at}` : `${ref.surah.name} · ${at}`;
}

function describe(r: RankedItem): Omit<Suggestion, 'match'> {
  switch (r.type) {
    case 'surah':
      return {
        key: `s${r.item.id}`,
        label: r.item.name,
        kind: 'Surah',
        fill: r.item.name,
      };
    case 'reciter':
      return {
        key: `r${r.item.id}`,
        label: r.item.name,
        kind: 'Reciter',
        fill: r.item.name,
      };
    case 'adhkar':
      return {
        key: `a${r.item.id}`,
        label: r.item.title,
        kind: 'Adhkar',
        fill: r.item.title,
      };
    case 'verse':
      return {
        key: `v${r.item.surah.id}:${r.item.ayah}`,
        label: verseLabel(r.item),
        kind: 'Verse',
        fill: r.item.name ?? `${r.item.surah.id}:${r.item.ayah}`,
      };
  }
}

const SPACE_LIKE = /[\s\-_(),.:;·/]/;

/** Folds `label` to search-key characters, remembering where each came from. */
function fold(label: string): {text: string; map: number[]} {
  let text = '';
  const map: number[] = [];
  for (let i = 0; i < label.length; i++) {
    const ch = label[i];
    const key = toSearchKey(ch);
    const out = key || (SPACE_LIKE.test(ch) ? ' ' : '');
    for (const c of out) {
      text += c;
      map.push(i);
    }
  }
  return {text, map};
}

function findAtWordStart(text: string, needle: string): number {
  let from = 0;
  let any = -1;
  while (needle) {
    const at = text.indexOf(needle, from);
    if (at < 0) break;
    if (at === 0 || text[at - 1] === ' ') return at;
    if (any < 0) any = at;
    from = at + 1;
  }
  return any;
}

/**
 * Where the typed text sits in `label`: at a word start if it can, without a
 * leading article ("al mulk" in "Al-Mulk" is all of it; "mulk" is the word).
 * Null when the match was a variant or typo with no literal overlap.
 */
export function highlightRange(
  label: string,
  query: string,
): readonly [number, number] | null {
  const {text, map} = fold(label);
  const key = toSearchKey(query);
  const bare = tokenize(key)
    .filter(t => !ARTICLES.has(t))
    .join(' ');
  for (const needle of [key, bare]) {
    if (!needle) continue;
    const at = findAtWordStart(text, needle);
    if (at >= 0) {
      return [map[at], map[at + needle.length - 1] + 1];
    }
  }
  return null;
}

/** Completions for `query`, best first, one per label. */
export function buildSuggestions(
  query: string,
  ranked: readonly RankedItem[],
  limit: number = MAX_SUGGESTIONS,
): Suggestion[] {
  if (!toSearchKey(query)) return [];
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const r of ranked) {
    const s = describe(r);
    const dedupe = s.label.toLowerCase();
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push({...s, match: highlightRange(s.label, query)});
    if (out.length >= limit) break;
  }
  return out;
}

/** Splits a label around its match for rendering the typed part in bold. */
export function splitLabel(
  label: string,
  match: readonly [number, number] | null,
): {before: string; match: string; after: string} {
  if (!match) return {before: label, match: '', after: ''};
  return {
    before: label.slice(0, match[0]),
    match: label.slice(match[0], match[1]),
    after: label.slice(match[1]),
  };
}
