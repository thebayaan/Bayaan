// @ai-generated
/**
 * useRewayahVerseUnits: loads the rewayah's words on demand when they are
 * 'idle', requests its verse units once the words are in memory (never
 * building or loading anything during a render: the stand-ins below throw
 * if asked to while a component renders), re-renders when the data
 * service's caches change and when a build of units ends, reports
 * 'loading' / 'error' / 'unavailable' explicitly, tries a failure again
 * once when it mounts and on retry() (never in a loop), and retains the
 * rewayah while mounted (so another surface's load cannot evict its words;
 * see hooks/__tests__/useRewayahVerseUnits.service.test.tsx for the loop
 * that prevents).
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

import {
  useRewayahVerseUnits,
  type RewayahVerseUnitsResult,
} from '@/hooks/useRewayahVerseUnits';
import {REWAYAH_WORDS_RETRY_INTERVAL_MS} from '@/hooks/useRewayahWords';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

interface FakeState {
  /** True while a probe renders: nothing may load or build then. */
  rendering: boolean;
  /** Whether startup loaded the main cache (the data service's). */
  initialized: boolean;
  version: number;
  load: Map<string, string>;
  ensure: jest.Mock;
  bump: () => void;
  /** Retain count per rewayah (retainRewayah minus its releases). */
  retained: Map<string, number>;
  // The units service: built units, refused rewayat, calls.
  units: Map<string, object>;
  refused: Set<string>;
  requested: string[];
  retried: string[];
  unitsVersion: number;
  /** A build ended (units accepted or refused): subscribers are called. */
  buildEnded: () => void;
}

jest.mock('@/services/mushaf/DigitalKhattDataService', () => {
  const listeners = new Set<() => void>();
  const unitsListeners = new Set<() => void>();
  const state: FakeState = {
    rendering: false,
    initialized: true,
    version: 0,
    load: new Map(),
    ensure: jest.fn(() => Promise.resolve()),
    bump: () => {
      state.version += 1;
      listeners.forEach(listener => listener());
    },
    retained: new Map(),
    units: new Map(),
    refused: new Set(),
    requested: [],
    retried: [],
    unitsVersion: 0,
    buildEnded: () => {
      state.unitsVersion += 1;
      unitsListeners.forEach(listener => listener());
    },
  };
  const notInRender = (what: string) => {
    if (state.rendering) throw new Error(`${what} during a render`);
  };
  return {
    __fake: state,
    __unitsListeners: unitsListeners,
    digitalKhattDataService: {
      // The main cache serves Hafs (before startup: the Hafs placeholder).
      rewayah: 'hafs',
      get initialized() {
        return state.initialized;
      },
      subscribeCacheChanges: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      getCacheVersion: () => state.version,
      getRewayahLoadState: (r: string) => state.load.get(r) ?? 'idle',
      ensureRewayahLoaded: (...args: unknown[]) => {
        notInRender('ensureRewayahLoaded()');
        return state.ensure(...args);
      },
      retainRewayah: (r: string) => {
        state.retained.set(r, (state.retained.get(r) ?? 0) + 1);
        let released = false;
        return () => {
          if (released) return;
          released = true;
          state.retained.set(r, (state.retained.get(r) ?? 1) - 1);
        };
      },
    },
  };
});

// The units service's contract: units exist once built (request()), and
// refused units stay refused until retry(); its status follows the words
// while they are not in memory.
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => {
  const dkMock = jest.requireMock(
    '@/services/mushaf/DigitalKhattDataService',
  ) as {__fake: FakeState; __unitsListeners: Set<() => void>};
  const state = dkMock.__fake;
  const notInRender = (what: string) => {
    if (state.rendering) throw new Error(`${what} during a render`);
  };
  return {
    rewayahVerseUnitsService: {
      peek: (r: string) => state.units.get(r) ?? null,
      getStatus: (r: string) => {
        const load = state.load.get(r) ?? 'idle';
        if (load !== 'ready') return load;
        if (state.units.has(r)) return 'ready';
        if (state.refused.has(r)) return 'error';
        // Units are read with the main cache: as startup goes without it.
        if (!state.initialized) {
          return state.load.get('hafs') === 'error' ? 'error' : 'loading';
        }
        return state.requested.includes(r) ? 'loading' : 'idle';
      },
      request: (r: string) => {
        notInRender('request()');
        state.requested.push(r);
        return Promise.resolve(state.units.get(r) ?? null);
      },
      retry: (r: string) => {
        notInRender('retry()');
        state.retried.push(r);
        state.refused.delete(r);
        return Promise.resolve(null);
      },
      subscribe: (listener: () => void) => {
        dkMock.__unitsListeners.add(listener);
        return () => dkMock.__unitsListeners.delete(listener);
      },
      getVersion: () => state.unitsVersion,
    },
  };
});

const fake = (
  jest.requireMock('@/services/mushaf/DigitalKhattDataService') as {
    __fake: FakeState;
  }
).__fake;

(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT =
  true;

function Probe({
  r,
  seen,
}: {
  r: RewayahId | null;
  seen: RewayahVerseUnitsResult[];
}) {
  fake.rendering = true;
  try {
    seen.push(useRewayahVerseUnits(r));
  } finally {
    fake.rendering = false;
  }
  return null;
}

function render(rewayah: RewayahId | null) {
  const seen: RewayahVerseUnitsResult[] = [];
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<Probe r={rewayah} seen={seen} />);
  });
  return {seen, renderer, last: () => seen[seen.length - 1]};
}

/** Retain counts above zero, by rewayah. */
const retained = () =>
  Object.fromEntries([...fake.retained].filter(([, count]) => count > 0));

let now = 0;
let dateSpy: jest.SpyInstance;

beforeEach(() => {
  fake.initialized = true;
  fake.version = 0;
  fake.load.clear();
  fake.ensure.mockClear();
  fake.retained.clear();
  fake.units.clear();
  fake.refused.clear();
  fake.requested.length = 0;
  fake.retried.length = 0;
  // Every test starts long after the last automatic retry.
  now += 10 * REWAYAH_WORDS_RETRY_INTERVAL_MS;
  dateSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
});

afterEach(() => dateSpy.mockRestore());

it('loads idle words, requests the units, renders them when built', () => {
  const {last} = render('warsh');
  expect(fake.ensure.mock.calls).toEqual([['warsh']]);
  expect(last()).toMatchObject({units: null, status: 'loading'});
  expect(fake.requested).toEqual([]);

  // The words land: the units are requested (built after interactions),
  // and the hook says 'loading' until that build ends.
  fake.load.set('warsh', 'ready');
  act(() => fake.bump());
  expect(fake.requested).toEqual(['warsh']);
  expect(last()).toMatchObject({units: null, status: 'loading'});

  const units = {rewayah: 'warsh'};
  fake.units.set('warsh', units);
  act(() => fake.buildEnded());
  expect(last()).toMatchObject({units, status: 'ready'});
  // Asked once each, never again on later changes.
  act(() => fake.bump());
  act(() => fake.buildEnded());
  expect(fake.ensure).toHaveBeenCalledTimes(1);
  expect(fake.requested).toEqual(['warsh']);
});

it('words already in memory: requests the units, never builds them itself', () => {
  fake.load.set('warsh', 'ready');
  const {last} = render('warsh');
  expect(fake.ensure).not.toHaveBeenCalled();
  expect(fake.requested).toEqual(['warsh']);
  expect(last()).toMatchObject({units: null, status: 'loading'});
});

it('tries refused units and a failed load again once when it mounts', () => {
  fake.load.set('warsh', 'ready');
  fake.refused.add('warsh');
  const warsh = render('warsh');
  expect(warsh.last()).toMatchObject({units: null, status: 'error'});
  // Built again: the words are in memory, the units were refused.
  expect(fake.retried).toEqual(['warsh']);
  expect(fake.ensure).not.toHaveBeenCalled();

  fake.load.set('qalun', 'error');
  const qalun = render('qalun');
  expect(qalun.last()).toMatchObject({units: null, status: 'error'});
  // Loaded again, the data service forgetting the failure first.
  expect(fake.ensure.mock.calls).toEqual([['qalun', {retry: true}]]);

  // Never in a loop: cache changes and ended builds ask for nothing more.
  fake.refused.add('warsh');
  act(() => fake.bump());
  act(() => fake.buildEnded());
  act(() => fake.bump());
  expect(fake.retried).toEqual(['warsh']);
  expect(fake.ensure).toHaveBeenCalledTimes(1);
});

it('on a new mount, tries again only after the retry interval', () => {
  fake.load.set('qalun', 'error');
  const first = render('qalun');
  expect(fake.ensure).toHaveBeenCalledTimes(1);
  act(() => first.renderer.unmount());

  // Rows mounting together, or the player reopened at once: no new try.
  const again = render('qalun');
  expect(again.last().status).toBe('error');
  expect(fake.ensure).toHaveBeenCalledTimes(1);
  act(() => again.renderer.unmount());

  now += REWAYAH_WORDS_RETRY_INTERVAL_MS;
  const later = render('qalun');
  expect(fake.ensure).toHaveBeenCalledTimes(2);
  expect(fake.ensure).toHaveBeenLastCalledWith('qalun', {retry: true});
  act(() => later.renderer.unmount());
});

it('retry() tries again at once, whatever failed', () => {
  fake.load.set('qalun', 'error');
  const qalun = render('qalun');
  fake.ensure.mockClear();
  act(() => qalun.last().retry());
  expect(fake.ensure.mock.calls).toEqual([['qalun', {retry: true}]]);

  fake.load.set('warsh', 'ready');
  fake.refused.add('warsh');
  const warsh = render('warsh');
  fake.retried.length = 0;
  act(() => warsh.last().retry());
  expect(fake.retried).toEqual(['warsh']);
  // The units service ends that build: the hook renders its units.
  const units = {rewayah: 'warsh'};
  fake.units.set('warsh', units);
  act(() => fake.buildEnded());
  expect(warsh.last()).toMatchObject({units, status: 'ready'});
});

it('startup failed with the words in memory: tries startup again', () => {
  // Startup could not load the main cache (Hafs); a Warsh side copy is in
  // memory, but its units are read with the main cache's word ids.
  fake.initialized = false;
  fake.load.set('hafs', 'error');
  fake.load.set('warsh', 'ready');
  const warsh = render('warsh');
  expect(warsh.last()).toMatchObject({units: null, status: 'error'});
  // Tried again when it mounts, and by retry(): the main cache.
  expect(fake.ensure.mock.calls).toEqual([['hafs', {retry: true}]]);
  fake.ensure.mockClear();
  act(() => warsh.last().retry());
  expect(fake.ensure.mock.calls).toEqual([['hafs', {retry: true}]]);
  expect(fake.retried).toEqual([]);
  expect(fake.requested).toEqual([]);
  // Startup loads it: the units are requested.
  fake.initialized = true;
  fake.load.set('hafs', 'ready');
  act(() => fake.bump());
  expect(fake.requested).toEqual(['warsh']);
  expect(warsh.last()).toMatchObject({units: null, status: 'loading'});
});

it('is unavailable without a bundled words DB or a rewayah', () => {
  expect(render('hisham').last()).toMatchObject({
    units: null,
    status: 'unavailable',
  });
  expect(render(null).last()).toMatchObject({
    units: null,
    status: 'unavailable',
  });
  expect(fake.ensure).not.toHaveBeenCalled();
  expect(fake.requested).toEqual([]);
});

it('retains the rewayah while mounted, and releases it', () => {
  const {renderer} = render('warsh');
  expect(retained()).toEqual({warsh: 1});
  // A cache change (a load landing, another surface's load) re-renders
  // without retaining again.
  act(() => fake.bump());
  expect(retained()).toEqual({warsh: 1});
  // Another rewayah: the first one is released.
  act(() => renderer.update(<Probe r="al-bazzi" seen={[]} />));
  expect(retained()).toEqual({'al-bazzi': 1});
  act(() => renderer.unmount());
  expect(retained()).toEqual({});
});

it('retains nothing without a rewayah or a bundled words DB', () => {
  const none = render(null);
  const hisham = render('hisham');
  expect(retained()).toEqual({});
  act(() => none.renderer.unmount());
  act(() => hisham.renderer.unmount());
});
