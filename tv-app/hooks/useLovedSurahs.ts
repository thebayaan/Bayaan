import {useSyncExternalStore} from 'react';
import {
  LOVED_SURAHS_KEY,
  getLovedSurahs,
  migrateLovedSurahs,
  storage,
  type LovedSurah,
} from '../services/lovedSurahsStore';

// Older builds saved one love per surah; bring them to the current shape
// before anything reads them.
migrateLovedSurahs();

let cachedSnapshot: LovedSurah[] = [];
let cachedRaw: string | undefined;

function getSnapshot(): LovedSurah[] {
  const raw = storage.getString(LOVED_SURAHS_KEY);
  if (raw === cachedRaw) return cachedSnapshot;
  cachedRaw = raw;
  cachedSnapshot = getLovedSurahs();
  return cachedSnapshot;
}

function subscribe(cb: () => void): () => void {
  const listener = storage.addOnValueChangedListener(key => {
    if (key === LOVED_SURAHS_KEY) cb();
  });
  return () => listener.remove();
}

/** The listener's favorite surahs, live. */
export function useLovedSurahs(): LovedSurah[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
