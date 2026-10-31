// @ai-generated
import type {Reciter, Rewayat} from '@/data/reciterData';
import {getDisplayLabelFromName} from '@/services/rewayah/RewayahIdentity';

const FULL_QURAN = 114;

/** The rewayat of a reciter that cover all 114 surahs. */
export function completeRewayat(reciter: Reciter): Rewayat[] {
  return reciter.rewayat.filter(
    r => (r.surah_list?.filter(id => id !== null).length ?? 0) === FULL_QURAN,
  );
}

export function hasCompleteQuran(reciter: Reciter): boolean {
  return completeRewayat(reciter).length > 0;
}

/** 'murattal2' -> 'murattal', so duplicate styles share one label. */
export function baseStyle(style: string): string {
  return style.trim().toLowerCase().replace(/\d+$/, '');
}

/**
 * Short labels for a reciter's recitations. When they all share a rewayah
 * the style alone tells them apart ("Murattal", "Mojawwad"); otherwise the
 * rewayah leads ("Hafs · Murattal", "Al-Duri · Murattal").
 */
export function recitationLabels(
  rewayat: readonly Rewayat[],
  styleLabel: (style: string) => string,
): string[] {
  const names = new Set(rewayat.map(r => r.name.trim()));
  const labels = rewayat.map(r => {
    const style = styleLabel(baseStyle(r.style));
    if (names.size === 1) return style;
    return `${getDisplayLabelFromName(r.name.trim())} · ${style}`;
  });
  // Two recordings of the same rewayah and style: number the later ones.
  const seen = new Map<string, number>();
  return labels.map(label => {
    const count = (seen.get(label) ?? 0) + 1;
    seen.set(label, count);
    return count === 1 ? label : `${label} ${count}`;
  });
}

export interface ReciterSection {
  key: string;
  title: string;
  /** Each item is one visual row of up to `columns` reciters. */
  data: Reciter[][];
}

/** Splits items into rows of `size` for the grid. */
export function toRows<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

/**
 * Groups reciters A–Z by the first letter of their display name, then splits
 * each group into rows of `columns` for the grid on wide windows.
 */
export function buildReciterSections(
  reciters: readonly Reciter[],
  displayName: (reciter: Reciter) => string,
  columns: number,
): ReciterSection[] {
  const sorted = [...reciters].sort((a, b) =>
    displayName(a).localeCompare(displayName(b)),
  );
  const groups = new Map<string, Reciter[]>();
  for (const reciter of sorted) {
    const first = displayName(reciter).trim().charAt(0).toUpperCase();
    const letter = /\p{L}/u.test(first) ? first : '#';
    const group = groups.get(letter);
    if (group) group.push(reciter);
    else groups.set(letter, [reciter]);
  }
  return [...groups].map(([letter, group]) => ({
    key: letter,
    title: letter,
    data: toRows(group, Math.max(1, columns)),
  }));
}
