/**
 * useRewayahWords / useRewayahText against a fake DigitalKhattDataService:
 * loads on demand whenever the rewayah is 'idle' (including after a cache
 * change made it idle again, e.g. a mushaf switch evicting it), reports
 * 'loading' / 'error' / 'unavailable' explicitly instead of empty or
 * substituted text, and never retries a failed load in a loop.
 */
// @ai-start
// It also retains the rewayah while it shows a verse.
// @ai-end
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

import {
  useRewayahText,
  useRewayahWords,
  type RewayahWordsResult,
} from '@/hooks/useRewayahWords';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

interface FakeWord {
  text: string;
  verseKey: string;
  wordPositionInVerse: number;
}

interface FakeService {
  version: number;
  states: Map<string, string>;
  words: Map<string, FakeWord[]>;
  ensure: jest.Mock;
  retain: jest.Mock; // @ai
  release: jest.Mock; // @ai
  bump: () => void;
}

jest.mock('@/services/mushaf/DigitalKhattDataService', () => {
  const listeners = new Set<() => void>();
  const fakeState: FakeService = {
    version: 0,
    states: new Map(),
    words: new Map(),
    ensure: jest.fn(() => Promise.resolve()),
    release: jest.fn(), // @ai
    retain: jest.fn(() => fakeState.release), // @ai
    bump: () => {
      fakeState.version += 1;
      listeners.forEach(listener => listener());
    },
  };
  return {
    __fake: fakeState,
    digitalKhattDataService: {
      subscribeCacheChanges: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      getCacheVersion: () => fakeState.version,
      getRewayahLoadState: (rewayah: string) =>
        fakeState.states.get(rewayah) ?? 'idle',
      ensureRewayahLoaded: (rewayah: string) => fakeState.ensure(rewayah),
      retainRewayah: (rewayah: string) => fakeState.retain(rewayah), // @ai
      tryGetVerseWords: (verseKey: string, rewayah: string) => {
        if (fakeState.states.get(rewayah) !== 'ready') return null;
        return fakeState.words.get(`${rewayah}|${verseKey}`) ?? [];
      },
    },
  };
});

const fake = (
  jest.requireMock('@/services/mushaf/DigitalKhattDataService') as {
    __fake: FakeService;
  }
).__fake;

(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT =
  true;

function word(text: string, position: number): FakeWord {
  return {text, verseKey: '2:255', wordPositionInVerse: position};
}

function renderWords(verseKey: string | null, rewayah: RewayahId) {
  const results: RewayahWordsResult[] = [];
  function Probe(): null {
    results.push(useRewayahWords(verseKey, rewayah));
    return null;
  }
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(<Probe />);
  });
  return {
    latest: () => results[results.length - 1],
    unmount: () => act(() => renderer?.unmount()),
  };
}

let errorSpy: jest.SpyInstance;

beforeEach(() => {
  fake.version = 0;
  fake.states.clear();
  fake.words.clear();
  fake.ensure.mockClear();
  // @ai-start
  fake.retain.mockClear();
  fake.release.mockClear();
  // @ai-end
  // react-test-renderer prints a deprecation notice under React 19.
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe('useRewayahWords', () => {
  it('loads an idle rewayah once and re-renders when it becomes ready', () => {
    const view = renderWords('2:255', 'warsh');
    expect(view.latest()).toEqual({words: [], status: 'loading'});
    expect(fake.ensure).toHaveBeenCalledTimes(1);
    expect(fake.ensure).toHaveBeenCalledWith('warsh');

    fake.states.set('warsh', 'ready');
    fake.words.set('warsh|2:255', [word('W1', 1), word('W2', 2)]);
    act(() => fake.bump());
    expect(view.latest().status).toBe('ready');
    expect(view.latest().words.map(w => w.text)).toEqual(['W1', 'W2']);
    expect(fake.ensure).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it('does not start another load while one is in flight', () => {
    fake.states.set('warsh', 'loading');
    const view = renderWords('2:255', 'warsh');
    act(() => fake.bump());
    expect(view.latest().status).toBe('loading');
    expect(fake.ensure).not.toHaveBeenCalled();
    view.unmount();
  });

  it('loads again when a cache change makes the rewayah idle (mushaf switched away)', () => {
    fake.states.set('hafs', 'ready');
    fake.words.set('hafs|2:255', [word('H1', 1)]);
    const view = renderWords('2:255', 'hafs');
    expect(view.latest().status).toBe('ready');
    expect(fake.ensure).not.toHaveBeenCalled();

    fake.states.set('hafs', 'idle');
    act(() => fake.bump());
    expect(view.latest()).toEqual({words: [], status: 'loading'});
    expect(fake.ensure).toHaveBeenCalledWith('hafs');
    view.unmount();
  });

  it('reports a failed load as an error and does not retry in a loop', () => {
    fake.states.set('warsh', 'error');
    const view = renderWords('2:255', 'warsh');
    act(() => fake.bump());
    act(() => fake.bump());
    expect(view.latest()).toEqual({words: [], status: 'error'});
    expect(fake.ensure).not.toHaveBeenCalled();
    view.unmount();
  });

  it('reports rewayat without bundled text as unavailable', () => {
    const view = renderWords('2:255', 'hisham');
    expect(view.latest()).toEqual({words: [], status: 'unavailable'});
    expect(fake.ensure).not.toHaveBeenCalled();
    expect(fake.retain).not.toHaveBeenCalled(); // @ai
    view.unmount();
  });

  it('is ready with no words when there is no verse', () => {
    const view = renderWords(null, 'warsh');
    expect(view.latest()).toEqual({words: [], status: 'ready'});
    expect(fake.ensure).not.toHaveBeenCalled();
    expect(fake.retain).not.toHaveBeenCalled(); // @ai
    view.unmount();
  });

  // @ai-start
  it('retains the rewayah while it shows a verse and releases it on unmount', () => {
    fake.states.set('warsh', 'ready');
    const view = renderWords('2:255', 'warsh');
    expect(fake.retain).toHaveBeenCalledTimes(1);
    expect(fake.retain).toHaveBeenCalledWith('warsh');
    act(() => fake.bump());
    expect(fake.retain).toHaveBeenCalledTimes(1);
    expect(fake.release).not.toHaveBeenCalled();
    view.unmount();
    expect(fake.release).toHaveBeenCalledTimes(1);
  });
  // @ai-end
});

describe('useRewayahText', () => {
  it('joins words with single spaces and skips blank slots', () => {
    fake.states.set('warsh', 'ready');
    fake.words.set('warsh|2:255', [
      word('W1', 1),
      word('', 2),
      word('W3 W4', 3),
    ]);
    let text = '';
    function Probe(): null {
      text = useRewayahText('2:255', 'warsh').text;
      return null;
    }
    let renderer: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      renderer = TestRenderer.create(<Probe />);
    });
    expect(text).toBe('W1 W3 W4');
    act(() => renderer?.unmount());
  });
});
