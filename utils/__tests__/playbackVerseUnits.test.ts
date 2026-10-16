// @ai-generated
/**
 * playbackVerseUnits: the audio surfaces read verse units in store selectors
 * and renders, so they never build them: units not built yet are requested
 * (the units service builds them after interactions), and subscribers hear
 * of a build ending as well as of a change of the words in memory (the
 * mushaf player relabels the recited verse then).
 */
jest.mock('@/services/mushaf/DigitalKhattDataService', () => {
  const listeners = new Set<() => void>();
  return {
    __cacheListeners: listeners,
    digitalKhattDataService: {
      subscribeCacheChanges: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
  };
});

const mockBuilt = new Map<string, unknown>();
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => ({
  rewayahVerseUnitsService: jest
    .requireActual('@/services/mushaf/__fixtures__/verseUnitsServiceStub')
    .verseUnitsServiceStub({peek: (r: string) => mockBuilt.get(r) ?? null}),
}));

import {
  canShowRewayahVerses,
  readyVerseUnits,
  subscribeVerseUnitsChanges,
} from '../playbackVerseUnits';
import {rewayahVerseUnitsService} from '@/services/mushaf/RewayahVerseUnitsService';
import type {VerseUnitsServiceStub} from '@/services/mushaf/__fixtures__/verseUnitsServiceStub';

const units = rewayahVerseUnitsService as unknown as VerseUnitsServiceStub;
const cacheListeners = (
  jest.requireMock('@/services/mushaf/DigitalKhattDataService') as {
    __cacheListeners: Set<() => void>;
  }
).__cacheListeners;

beforeEach(() => {
  mockBuilt.clear();
  units.requested.length = 0;
});

it('reads built units; requests units not built yet, never builds them', () => {
  expect(readyVerseUnits('warsh')).toBeNull();
  expect(canShowRewayahVerses('warsh')).toBe(false);
  expect(units.requested).toEqual(['warsh', 'warsh']);

  const built = {rewayah: 'warsh'};
  mockBuilt.set('warsh', built);
  units.requested.length = 0;
  expect(readyVerseUnits('warsh')).toBe(built);
  expect(canShowRewayahVerses('warsh')).toBe(true);
  expect(units.requested).toEqual([]);
});

it('Hafs needs no units', () => {
  expect(canShowRewayahVerses('hafs')).toBe(true);
  expect(units.requested).toEqual([]);
});

it('subscribers hear of a words change and of a build ending', () => {
  const listener = jest.fn();
  const stop = subscribeVerseUnitsChanges(listener);
  for (const notify of [...cacheListeners]) notify();
  units.notify();
  expect(listener).toHaveBeenCalledTimes(2);
  stop();
  for (const notify of [...cacheListeners]) notify();
  units.notify();
  expect(listener).toHaveBeenCalledTimes(2);
});
