import {useSyncExternalStore} from 'react';
import {
  getContinueEntries,
  type ContinueEntry,
} from '../services/continueListeningStore';
import {storage} from '../services/storage';

const CONTINUE_KEY = 'bayaan_tv_continue';

function subscribe(cb: () => void): () => void {
  const listener = storage.addOnValueChangedListener(key => {
    if (key === CONTINUE_KEY) cb();
  });
  return () => listener.remove();
}

export function useContinueListening(): ContinueEntry[] {
  return useSyncExternalStore(
    subscribe,
    getContinueEntries,
    getContinueEntries,
  );
}
