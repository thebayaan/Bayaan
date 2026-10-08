// @ai-generated
/**
 * useRewayahVerseUnits: loads the rewayah's words on demand when they are
 * 'idle', re-renders when the data service's caches change, reports
 * 'loading' / 'error' / 'unavailable' explicitly, never retries a failed
 * load in a loop, and retains the rewayah while mounted (so another
 * surface's load cannot evict its words; see
 * hooks/__tests__/useRewayahVerseUnits.service.test.tsx for the loop that
 * prevents).
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

import {
  useRewayahVerseUnits,
  type RewayahVerseUnitsResult,
} from '@/hooks/useRewayahVerseUnits';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

interface FakeState {
  version: number;
  load: Map<string, string>;
  units: Map<string, object>;
  status: Map<string, string>;
  ensure: jest.Mock;
  bump: () => void;
  /** Retain count per rewayah (retainRewayah minus its releases). */
  retained: Map<string, number>;
}

jest.mock('@/services/mushaf/DigitalKhattDataService', () => {
  const listeners = new Set<() => void>();
  const state: FakeState = {
    version: 0,
    load: new Map(),
    units: new Map(),
    status: new Map(),
    ensure: jest.fn(() => Promise.resolve()),
    bump: () => {
      state.version += 1;
      listeners.forEach(listener => listener());
    },
    retained: new Map(),
  };
  return {
    __fake: state,
    digitalKhattDataService: {
      subscribeCacheChanges: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      getCacheVersion: () => state.version,
      getRewayahLoadState: (r: string) => state.load.get(r) ?? 'idle',
      ensureRewayahLoaded: (r: string) => state.ensure(r),
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

jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => {
  const {__fake: state} = jest.requireMock(
    '@/services/mushaf/DigitalKhattDataService',
  ) as {__fake: FakeState};
  return {
    rewayahVerseUnitsService: {
      get: (r: string) => state.units.get(r) ?? null,
      getStatus: (r: string) =>
        state.status.get(r) ?? state.load.get(r) ?? 'idle',
    },
  };
});

const fake = (
  jest.requireMock('@/services/mushaf/DigitalKhattDataService') as {
    __fake: FakeState;
  }
).__fake;

function Probe({
  r,
  seen,
}: {
  r: RewayahId | null;
  seen: RewayahVerseUnitsResult[];
}) {
  seen.push(useRewayahVerseUnits(r));
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

beforeEach(() => {
  fake.version = 0;
  fake.load.clear();
  fake.units.clear();
  fake.status.clear();
  fake.ensure.mockClear();
  fake.retained.clear();
});

it('loads an idle rewayah and returns its units once ready', () => {
  const {last} = render('warsh');
  expect(fake.ensure).toHaveBeenCalledWith('warsh');
  expect(last()).toEqual({units: null, status: 'loading'});
  const units = {rewayah: 'warsh'};
  fake.load.set('warsh', 'ready');
  fake.units.set('warsh', units);
  act(() => fake.bump());
  expect(last()).toEqual({units, status: 'ready'});
  expect(fake.ensure).toHaveBeenCalledTimes(1);
});

it('reports refused units and failed loads as errors without retrying', () => {
  fake.load.set('warsh', 'ready');
  fake.status.set('warsh', 'error');
  expect(render('warsh').last()).toEqual({units: null, status: 'error'});
  fake.load.set('qalun', 'error');
  const {last} = render('qalun');
  act(() => fake.bump());
  expect(last()).toEqual({units: null, status: 'error'});
  expect(fake.ensure).not.toHaveBeenCalled();
});

it('is unavailable without a bundled words DB or a rewayah', () => {
  expect(render('hisham').last()).toEqual({units: null, status: 'unavailable'});
  expect(render(null).last()).toEqual({units: null, status: 'unavailable'});
  expect(fake.ensure).not.toHaveBeenCalled();
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
