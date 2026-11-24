// @ai-generated
/**
 * The data behind Browse › All reciters: which rewayat each reciter has,
 * the rewayah chips, the filters, the sort and the flat list the screen
 * draws (letter headers, panel rows or rows of cards).
 */
import type {Reciter} from '@/data/reciterData';
import {
  getNarratorLabel,
  getShortLabel,
  resolveRewayahFromName,
  type RewayahId,
} from '@/services/rewayah/RewayahIdentity';
import {getReciterDisplayName} from '@/i18n/format';
import {sortRecitersByName} from '@/utils/sortReciters';
import {rankReciters} from '@/utils/search/catalog';

export const FULL_QURAN = 114;
/** Rewayat shown as chips before "More". */
export const CHIP_REWAYAT = 5;

export type BrowseSort = 'name' | 'recent';
export type BrowseView = 'list' | 'cards';

/** The canonical rewayat a reciter recorded, in his catalogue order. */
export function rewayahIdsOf(reciter: Reciter): RewayahId[] {
  const ids: RewayahId[] = [];
  for (const rewaya of reciter.rewayat) {
    const id = resolveRewayahFromName(rewaya.name);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** Surahs in the reciter's fullest recording. */
export function mostSurahs(reciter: Reciter): number {
  let most = 0;
  for (const rewaya of reciter.rewayat) {
    const count =
      rewaya.surah_list?.filter(id => id !== null).length ??
      rewaya.surah_total ??
      0;
    most = Math.max(most, count);
  }
  return most;
}

export function hasCompleteQuran(reciter: Reciter): boolean {
  return mostSurahs(reciter) >= FULL_QURAN;
}

/** Every rewayah in the catalogue, most recorded first. */
export function rewayahCounts(
  reciters: readonly Reciter[],
): {id: RewayahId; count: number}[] {
  const counts = new Map<RewayahId, number>();
  for (const reciter of reciters) {
    for (const id of rewayahIdsOf(reciter)) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([id, count]) => ({id, count}))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}

/**
 * The narrator's name ("Warsh"), or the short label where two chips would
 * share a narrator ("Al-Duri (Abu Amr)" and "Al-Duri (al-Kisa'i)").
 */
export function rewayahChipLabel(
  id: RewayahId,
  shown: readonly RewayahId[],
): string {
  const name = getNarratorLabel(id);
  const clash = shown.some(
    other => other !== id && getNarratorLabel(other) === name,
  );
  return clash ? getShortLabel(id) : name;
}

/** "Hafs, Warsh" and, when he hasn't recorded every surah, "· 86 surahs". */
export function reciterLine(
  reciter: Reciter,
  surahsLabel: (count: number) => string,
  separator = ', ',
): string {
  const ids = rewayahIdsOf(reciter);
  const shown = ids.slice(0, 3).map(id => getNarratorLabel(id));
  let line = shown.join(separator);
  if (ids.length > 3) line += ` +${ids.length - 3}`;
  if (!line) {
    // Rewayat the registry doesn't know yet keep their catalogue name.
    line = reciter.rewayat[0]?.name ?? '';
  }
  const most = mostSurahs(reciter);
  if (most > 0 && most < FULL_QURAN) {
    line = line ? `${line} · ${surahsLabel(most)}` : surahsLabel(most);
  }
  return line;
}

export interface BrowseFilters {
  query: string;
  rewayah: RewayahId | null;
  completeOnly: boolean;
  downloadedOnly: boolean;
  downloadedIds: ReadonlySet<string>;
  surahId?: number;
}

/**
 * The reciters that pass every filter. A query ranks them by match;
 * otherwise they follow `sort`.
 */
export function filterReciters(
  all: readonly Reciter[],
  filters: BrowseFilters,
  sort: BrowseSort,
): Reciter[] {
  const {query, rewayah, completeOnly, downloadedOnly, downloadedIds, surahId} =
    filters;
  const passes = (reciter: Reciter) => {
    if (
      surahId &&
      !reciter.rewayat.some(rewaya => rewaya.surah_list?.includes(surahId))
    ) {
      return false;
    }
    if (rewayah && !rewayahIdsOf(reciter).includes(rewayah)) return false;
    if (completeOnly && !hasCompleteQuran(reciter)) return false;
    if (downloadedOnly && !downloadedIds.has(reciter.id)) return false;
    return true;
  };
  const kept = all.filter(passes);
  if (query.trim()) return [...rankReciters(query, kept)];
  if (sort === 'recent') {
    return [...kept].sort(
      (a, b) =>
        (b.date ?? '').localeCompare(a.date ?? '') ||
        a.name.localeCompare(b.name),
    );
  }
  return sortRecitersByName(kept);
}

/** The letter a reciter is filed under: the first letter of his shown name. */
export function indexLetter(reciter: Reciter): string {
  const first = getReciterDisplayName(reciter)
    .trim()
    .charAt(0)
    .toLocaleUpperCase();
  if (!/\p{L}/u.test(first)) return '#';
  // Arabic hamza forms file under alif.
  return /[أإآٱ]/.test(first) ? 'ا' : first;
}

export type BrowseItem =
  | {type: 'header'; key: string; title: string; letter?: string}
  | {
      type: 'row';
      key: string;
      reciter: Reciter;
      first: boolean;
      last: boolean;
    }
  | {type: 'cards'; key: string; reciters: Reciter[]};

export interface BrowseSection {
  key: string;
  title?: string;
  /** Set on A–Z sections, for the index rail. */
  letter?: string;
  reciters: Reciter[];
}

/**
 * A–Z sections when the list is long and sorted by name; otherwise one
 * untitled section (search results, recently added, a short filtered list).
 */
export function letterSections(
  reciters: readonly Reciter[],
  byLetter: boolean,
): BrowseSection[] {
  if (!byLetter) return [{key: 'all', reciters: [...reciters]}];
  const sections: BrowseSection[] = [];
  for (const reciter of reciters) {
    const letter = indexLetter(reciter);
    const last = sections[sections.length - 1];
    if (last && last.letter === letter) last.reciters.push(reciter);
    else
      sections.push({
        key: `letter-${letter}`,
        title: letter,
        letter,
        reciters: [reciter],
      });
  }
  return sections;
}

/** Flattens sections into what the list draws. */
export function buildBrowseItems(
  sections: readonly BrowseSection[],
  view: BrowseView,
  columns: number,
): BrowseItem[] {
  const items: BrowseItem[] = [];
  for (const section of sections) {
    if (section.reciters.length === 0) continue;
    if (section.title) {
      items.push({
        type: 'header',
        key: `h-${section.key}`,
        title: section.title,
        letter: section.letter,
      });
    }
    if (view === 'cards') {
      for (let i = 0; i < section.reciters.length; i += columns) {
        const row = section.reciters.slice(i, i + columns);
        items.push({
          type: 'cards',
          key: `c-${section.key}-${row[0].id}`,
          reciters: row,
        });
      }
    } else {
      section.reciters.forEach((reciter, i) => {
        items.push({
          type: 'row',
          key: `r-${section.key}-${reciter.id}`,
          reciter,
          first: i === 0,
          last: i === section.reciters.length - 1,
        });
      });
    }
  }
  return items;
}

/** Shortest list that still gets letter headers and the index rail. */
export const LETTERS_FROM = 20;
