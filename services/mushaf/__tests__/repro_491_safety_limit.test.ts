// @ai-generated
/**
 * Repro test for PR #491 (RFC-023 step 5), written during code review.
 *
 * Built from a copy of readerRestoreState.test.ts with the same mock: the
 * session store says the last screen was the reader.
 *
 * Finding 1 (review comment): beginReaderRestore starts the 15 s safety limit
 * at root mount, so when the boot or a share import takes longer than that,
 * the state moves from 'pushing' to 'ended' before the push and
 * shouldPushReader refuses it.
 *   Expected: after 15 s with no push yet, shouldPushReader(null) is still true.
 *   On the PR head: it returns false and the state is 'ended'.
 *
 * Note: readerRestoreState.test.ts ("frees everything at the safety limit
 * when no push ever came") asserts the current behaviour as correct.
 */
const mockSession = {lastScreenWasMushaf: true, throws: false};
jest.mock('@/services/mushaf/MushafSessionStore', () => ({
  mushafSessionStore: {
    getLastScreenWasMushaf: () => {
      if (mockSession.throws) throw new Error('no storage');
      return mockSession.lastScreenWasMushaf;
    },
  },
}));

import {
  RESTORE_SAFETY_LIMIT_MS,
  beginReaderRestore,
  shouldPushReader,
} from '../readerRestoreState';

beforeEach(() => {
  jest.useFakeTimers();
  mockSession.lastScreenWasMushaf = true;
  mockSession.throws = false;
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('PR #491 finding 1, at the store level', () => {
  it('F2 (store): the safety limit does not cancel a push that has not happened yet', () => {
    beginReaderRestore();
    jest.advanceTimersByTime(RESTORE_SAFETY_LIMIT_MS);
    // On the PR head: false, because the state is already 'ended'.
    expect(shouldPushReader(null)).toBe(true);
  });
});
