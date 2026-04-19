import {useSyncExternalStore} from 'react';
import {
  getContinueEntries,
  type ContinueEntry,
} from '../services/continueListeningStore';
import {storage} from '../services/storage';

const CONTINUE_KEY = 'bayaan_tv_continue';

let cachedSnapshot: ContinueEntry[] = [];
let cachedRaw: string | undefined;

function getSnapshot(): ContinueEntry[] {
  const raw = storage.getString(CONTINUE_KEY);
  if (raw === cachedRaw) return cachedSnapshot;
  cachedRaw = raw;
  cachedSnapshot = getContinueEntries();
  return cachedSnapshot;
}

function subscribe(cb: () => void): () => void {
  const listener = storage.addOnValueChangedListener(key => {
    if (key === CONTINUE_KEY) cb();
  });
  return () => listener.remove();
}

export function useContinueListening(): ContinueEntry[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
