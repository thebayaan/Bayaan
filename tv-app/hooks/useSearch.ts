import {useEffect, useMemo, useState} from 'react';
import {SURAHS, type Surah} from '../../data/surahData';
import type {Reciter} from '../types/reciter';

export const MIN_QUERY_LENGTH = 2;
const MAX_RECITER_RESULTS = 20;
const MAX_SURAH_RESULTS = 12;
const DEBOUNCE_MS = 250;

export interface SearchResults {
  reciters: Reciter[];
  surahs: Surah[];
  loading: boolean;
}

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function searchReciters(reciters: Reciter[], query: string): Reciter[] {
  const q = normalizeQuery(query);
  if (q.length < MIN_QUERY_LENGTH) return [];
  return reciters
    .filter(r => r.name.toLowerCase().includes(q))
    .slice(0, MAX_RECITER_RESULTS);
}

export function searchSurahs(query: string): Surah[] {
  const q = normalizeQuery(query);
  if (q.length < MIN_QUERY_LENGTH) return [];
  const asNumber = Number(q);
  const matchesNumber = Number.isInteger(asNumber) && asNumber > 0;
  return SURAHS.filter(
    s =>
      s.name.toLowerCase().includes(q) ||
      s.translated_name_english.toLowerCase().includes(q) ||
      (matchesNumber && s.id === asNumber),
  ).slice(0, MAX_SURAH_RESULTS);
}

/**
 * Debounced search over the supplied reciters plus the bundled surah list.
 * `loading` is true while a freshly typed query waits for the debounce to
 * settle, so the screen can keep prior results visible without flicker.
 */
export function useSearch(query: string, reciters: Reciter[]): SearchResults {
  const normalized = normalizeQuery(query);
  const active = normalized.length >= MIN_QUERY_LENGTH;
  const [settled, setSettled] = useState('');

  useEffect(() => {
    if (!active) {
      setSettled('');
      return;
    }
    const handle = setTimeout(() => setSettled(normalized), DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [normalized, active]);

  const reciterResults = useMemo(
    () => searchReciters(reciters, settled),
    [reciters, settled],
  );
  const surahResults = useMemo(() => searchSurahs(settled), [settled]);
  const loading = active && settled !== normalized;

  return {reciters: reciterResults, surahs: surahResults, loading};
}
