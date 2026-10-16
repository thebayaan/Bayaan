import {useSyncExternalStore} from 'react';
import {
  LOVED_SURAHS_KEY,
  getLovedSurahs,
  storage,
  type LovedSurah,
} from '../services/lovedSurahsStore';

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
