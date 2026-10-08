// @ai-generated
/**
 * useRewayahVerseUnits: loads the rewayah's words on demand when they are
 * 'idle', re-renders when the data service's caches change, reports
 * 'loading' / 'error' / 'unavailable' explicitly, and never retries a failed
 * load in a loop.
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

function render(rewayah: RewayahId | null) {
  const seen: RewayahVerseUnitsResult[] = [];
  function Probe({r}: {r: RewayahId | null}) {
    seen.push(useRewayahVerseUnits(r));
    return null;
  }
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<Probe r={rewayah} />);
  });
  return {seen, renderer, last: () => seen[seen.length - 1]};
}

beforeEach(() => {
  fake.version = 0;
  fake.load.clear();
  fake.units.clear();
  fake.status.clear();
  fake.ensure.mockClear();
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
