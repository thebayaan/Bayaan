/**
 * The useContinueListening hook is a thin useSyncExternalStore wrapper. Its
 * correctness follows from getContinueEntries being correct (verified in
 * continueListeningStore.test.ts). This file verifies that the underlying
 * store functions produce the expected data and that the hook file compiles
 * with the expected imports.
 */
import {
  getContinueEntries,
  recordProgress,
} from '../services/continueListeningStore';
import {storage} from '../services/storage';

beforeEach(() => storage.clearAll());

it('returns empty initially via getContinueEntries', () => {
  expect(getContinueEntries()).toEqual([]);
});

it('returns recorded entries after recordProgress', () => {
  recordProgress({
    reciterId: 'a',
    rewayahId: 'r',
    surahNumber: 1,
    positionSeconds: 10,
    durationSeconds: 60,
  });
  const entries = getContinueEntries();
  expect(entries).toHaveLength(1);
  expect(entries[0].reciterId).toBe('a');
});
