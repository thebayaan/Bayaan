// @ai-generated
// Copy/share text must be the text of the rewayah it is labelled with: wait
// for a side cache, report failure, never substitute Hafs for a non-Hafs
// request. Readiness is the data service's load state, so a loaded verse
// with no visible words never stalls a selection, and a Hafs request whose
// words failed to load gets the bundled Hafs text at once. Fixtures use
// placeholder words (W1, W2, ...) with real verse-end markers (U+06DD +
// Arabic-Indic digits) rather than Quran text.
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {
  useRewayahVerseTexts,
  type UseRewayahVerseTextsResult,
} from '../useRewayahVerseTexts';
import {
  formatQuranCitation,
  formatVerseRange,
  getBundledHafsVerseText,
  hasNoOwnText,
  isHafsTextFailed,
  isRewayahTextLoaded,
  joinVerseTexts,
  noOwnTextMessage,
  readLoadedVerseTexts,
  resolveVerseTexts,
  waitForRewayahText,
  watchRewayahText,
} from '../rewayahVerseText';

// A stand-in for the data service's read API with the load-state semantics
// of DigitalKhattDataService: the main cache serves `current` once
// `mainReady`; side caches serve other rewayat once loaded; a failed load is
// remembered ('error'). ensureRewayahLoaded resolves once the words are
// readable, waits for a main load of `current` that is still running, and
// rejects at once when that main load already failed.
jest.mock('@/services/mushaf/DigitalKhattDataService', () => {
  type MockWord = {
    text: string;
    verseKey: string;
    wordPositionInVerse: number;
  };
  type MockVerses = Map<string, MockWord[]>;
  type MockPending = {resolve: () => void; reject: (err: Error) => void};
  const WITH_TEXT = new Set([
    'hafs',
    'shubah',
    'al-bazzi',
    'qunbul',
    'warsh',
    'qalun',
    'al-duri-abi-amr',
    'al-susi',
  ]);
  const listeners = new Set<() => void>();
  const state = {
    current: 'hafs',
    mainReady: true,
    version: 0,
    main: new Map() as MockVerses,
    side: new Map<string, MockVerses>(),
    errors: new Set<string>(),
    pendingSide: new Map<string, MockPending>(),
    pendingMain: [] as MockPending[],
  };
  const notify = () => {
    state.version += 1;
    for (const listener of [...listeners]) listener();
  };
  const service = {
    get rewayah() {
      return state.current;
    },
    get initialized() {
      return state.mainReady;
    },
    isRewayahReady(rewayah: string): boolean {
      return rewayah === state.current
        ? state.mainReady
        : state.side.has(rewayah);
    },
    getRewayahLoadState(rewayah: string): string {
      if (!WITH_TEXT.has(rewayah)) return 'unavailable';
      if (service.isRewayahReady(rewayah)) return 'ready';
      if (state.pendingSide.has(rewayah)) return 'loading';
      if (state.errors.has(rewayah)) return 'error';
      if (rewayah === state.current) return 'loading';
      return 'idle';
    },
    // Contract: blank word slots are omitted (rt-overlay's getVerseWords).
    getVerseWords(verseKey: string, rewayah?: string): MockWord[] {
      const verses =
        !rewayah || rewayah === state.current
          ? state.main
          : state.side.get(rewayah);
      return (verses?.get(verseKey) ?? []).filter(w => w.text !== '');
    },
    getVerseText(verseKey: string, rewayah?: string): string {
      return service
        .getVerseWords(verseKey, rewayah)
        .map(w => w.text)
        .join(' ');
    },
    subscribeCacheChanges: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getCacheVersion: () => state.version,
    ensureRewayahLoaded: jest.fn(
      (rewayah: string) =>
        new Promise<void>((resolve, reject) => {
          if (service.isRewayahReady(rewayah)) {
            resolve();
            return;
          }
          if (rewayah === state.current && !state.mainReady) {
            if (state.errors.has(rewayah)) {
              reject(new Error('initial load failed'));
              return;
            }
            state.pendingMain.push({resolve, reject});
            return;
          }
          state.pendingSide.set(rewayah, {resolve, reject});
        }),
    ),
  };
  const toVerses = (slots: Record<string, string[]>): MockVerses => {
    const verses: MockVerses = new Map();
    for (const [verseKey, texts] of Object.entries(slots)) {
      verses.set(
        verseKey,
        texts.map((text, i) => ({text, verseKey, wordPositionInVerse: i + 1})),
      );
    }
    return verses;
  };
  return {
    digitalKhattDataService: service,
    __test: {
      state,
      listeners,
      reset(current: string, main: Record<string, string[]>, mainReady = true) {
        state.current = current;
        state.mainReady = mainReady;
        state.main = toVerses(main);
        state.side.clear();
        state.errors.clear();
        state.pendingSide.clear();
        state.pendingMain = [];
        listeners.clear();
        service.ensureRewayahLoaded.mockClear();
      },
      finishSideLoad(
        rewayah: string,
        slots: Record<string, string[]>,
        {quiet = false}: {quiet?: boolean} = {},
      ) {
        state.side.set(rewayah, toVerses(slots));
        state.errors.delete(rewayah);
        if (!quiet) notify();
        state.pendingSide.get(rewayah)?.resolve();
        state.pendingSide.delete(rewayah);
      },
      failSideLoad(rewayah: string) {
        state.errors.add(rewayah);
        state.pendingSide.get(rewayah)?.reject(new Error('disk I/O error'));
        state.pendingSide.delete(rewayah);
        notify();
      },
      finishMainLoad(rewayah: string, slots: Record<string, string[]>) {
        state.current = rewayah;
        state.main = toVerses(slots);
        state.mainReady = true;
        state.errors.delete(rewayah);
        notify();
        for (const waiter of state.pendingMain.splice(0)) waiter.resolve();
      },
      failMainLoad() {
        state.errors.add(state.current);
        notify();
        for (const waiter of state.pendingMain.splice(0)) {
          waiter.reject(new Error('initial load failed'));
        }
      },
      markFailed(rewayah: string) {
        state.errors.add(rewayah);
      },
    },
  };
});

type TestHelpers = {
  state: {pendingSide: Map<string, unknown>; pendingMain: unknown[]};
  listeners: Set<() => void>;
  reset: (
    current: string,
    main: Record<string, string[]>,
    mainReady?: boolean,
  ) => void;
  finishSideLoad: (
    rewayah: string,
    slots: Record<string, string[]>,
    options?: {quiet?: boolean},
  ) => void;
  failSideLoad: (rewayah: string) => void;
  finishMainLoad: (rewayah: string, slots: Record<string, string[]>) => void;
  failMainLoad: () => void;
  markFailed: (rewayah: string) => void;
};
const {__test: t, digitalKhattDataService: dk} = jest.requireMock(
  '@/services/mushaf/DigitalKhattDataService',
) as {
  __test: TestHelpers;
  digitalKhattDataService: {ensureRewayahLoaded: jest.Mock};
};

const M1 = '۝١'; // end of verse 1
const M2 = '۝٢'; // end of verse 2
const M3 = '۝٣'; // end of verse 3

// Hafs-shaped slots (every verse ends in its own marker slot).
const HAFS = {
  '1:1': ['H1', 'H2', M1],
  '1:2': ['H3', 'H4', M2],
};
// Rewayah slots in the Release 1 model: a blank Hafs marker slot where the
// rewayah verse continues, an inline marker inside a slot where a rewayah
// verse ends mid Hafs verse, and a multi-token slot.
const REWAYAH = {
  '1:1': ['R1', 'R2', ''],
  '1:2': ['R3 R4', `R5 ${M1}`, 'R6', M2],
};
// A Hafs verse whose slots are all blank in the rewayah (its words are read
// with the next verse). No bundled DB has one today; the slot model allows it.
const MERGED = {
  '1:2': ['', '', ''],
  '1:3': ['R1 R2', 'R3', M1],
};

let warnSpy: jest.SpyInstance;

beforeEach(() => {
  jest.useRealTimers();
  t.reset('hafs', HAFS);
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe('readLoadedVerseTexts', () => {
  it('reads the active rewayah from the main cache', () => {
    expect(isRewayahTextLoaded('hafs')).toBe(true);
    expect(readLoadedVerseTexts(['1:1', '1:2'], 'hafs')).toEqual([
      `H1 H2 ${M1}`,
      `H3 H4 ${M2}`,
    ]);
  });

  it('returns null, not Hafs, for a rewayah whose words are not loaded', () => {
    expect(isRewayahTextLoaded('warsh')).toBe(false);
    expect(readLoadedVerseTexts(['1:1'], 'warsh')).toBeNull();
  });

  it('returns null for a rewayah without bundled text data', () => {
    expect(isRewayahTextLoaded('hisham')).toBe(false);
    expect(readLoadedVerseTexts(['1:1'], 'hisham')).toBeNull();
  });

  it('returns null while the active rewayah is still loading', () => {
    t.reset('warsh', {}, false);
    expect(isRewayahTextLoaded('warsh')).toBe(false);
    expect(readLoadedVerseTexts(['1:1'], 'warsh')).toBeNull();
  });

  it('reads a loaded side cache, keeping slot structure from getVerseText', () => {
    t.finishSideLoad('warsh', REWAYAH);
    expect(readLoadedVerseTexts(['1:1', '1:2'], 'warsh')).toEqual([
      'R1 R2',
      `R3 R4 R5 ${M1} R6 ${M2}`,
    ]);
  });

  it('reads a verse with no visible words in a loaded rewayah as empty', () => {
    t.finishSideLoad('warsh', MERGED);
    expect(isRewayahTextLoaded('warsh')).toBe(true);
    expect(readLoadedVerseTexts(['1:2', '1:3'], 'warsh')).toEqual([
      '',
      `R1 R2 R3 ${M1}`,
    ]);
  });
});

describe('waitForRewayahText', () => {
  it('starts a side load for a non-active rewayah and resolves when it lands', async () => {
    const waiting = waitForRewayahText('warsh', 5000);
    expect(dk.ensureRewayahLoaded).toHaveBeenCalledWith('warsh');
    t.finishSideLoad('warsh', REWAYAH);
    await expect(waiting).resolves.toBe(true);
    expect(t.listeners.size).toBe(0);
  });

  it('settles as soon as the load request resolves, even without a cache notification', async () => {
    jest.useFakeTimers();
    const waiting = waitForRewayahText('warsh', 5000);
    t.finishSideLoad('warsh', MERGED, {quiet: true});
    await expect(waiting).resolves.toBe(true);
  });

  it('resolves false when the load fails', async () => {
    const waiting = waitForRewayahText('warsh', 5000);
    t.failSideLoad('warsh');
    await expect(waiting).resolves.toBe(false);
    expect(t.listeners.size).toBe(0);
  });

  it('resolves false when the load outlasts the timeout', async () => {
    jest.useFakeTimers();
    const waiting = waitForRewayahText('warsh', 5000);
    jest.advanceTimersByTime(5000);
    await expect(waiting).resolves.toBe(false);
    expect(t.listeners.size).toBe(0);
  });

  it('waits for the main cache when the rewayah is the one loading there', async () => {
    // Active rewayah still loading (startup or a switch): no side load.
    t.reset('warsh', {}, false);
    const waiting = waitForRewayahText('warsh', 5000);
    expect(t.state.pendingSide.has('warsh')).toBe(false);
    expect(t.state.pendingMain).toHaveLength(1);
    t.finishMainLoad('warsh', REWAYAH);
    await expect(waiting).resolves.toBe(true);
  });

  it('asks again for a non-Hafs rewayah whose last load failed', async () => {
    t.markFailed('warsh');
    const waiting = waitForRewayahText('warsh', 5000);
    expect(dk.ensureRewayahLoaded).toHaveBeenCalledWith('warsh');
    t.finishSideLoad('warsh', REWAYAH);
    await expect(waiting).resolves.toBe(true);
  });

  it('gives up after a second request that still leaves the words missing', async () => {
    jest.useFakeTimers();
    // A service that reports success without the words becoming readable
    // must not be asked forever (that would starve the timeout).
    dk.ensureRewayahLoaded
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(() => Promise.resolve());
    await expect(waitForRewayahText('warsh', 5000)).resolves.toBe(false);
    expect(dk.ensureRewayahLoaded).toHaveBeenCalledTimes(2);
    expect(t.listeners.size).toBe(0);
  });

  it('stops listening when cancelled', () => {
    const onSettled = jest.fn();
    const cancel = watchRewayahText('warsh', onSettled, 5000);
    expect(t.listeners.size).toBe(1);
    cancel();
    expect(t.listeners.size).toBe(0);
    t.finishSideLoad('warsh', REWAYAH);
    expect(onSettled).not.toHaveBeenCalled();
  });

  it('resolves immediately when the text is already loaded', async () => {
    await expect(waitForRewayahText('hafs', 5000)).resolves.toBe(true);
    expect(dk.ensureRewayahLoaded).not.toHaveBeenCalled();
  });
});

describe('resolveVerseTexts', () => {
  it('returns the requested rewayah once its words load', async () => {
    const resolving = resolveVerseTexts(['1:1', '1:2'], 'warsh', 5000);
    t.finishSideLoad('warsh', REWAYAH);
    await expect(resolving).resolves.toEqual({
      status: 'ready',
      rewayah: 'warsh',
      texts: ['R1 R2', `R3 R4 R5 ${M1} R6 ${M2}`],
    });
  });

  it('never stalls on a verse with no visible words in a loaded rewayah', async () => {
    jest.useFakeTimers();
    t.finishSideLoad('warsh', MERGED);
    // No timer is advanced: the result must not depend on the timeout.
    await expect(
      resolveVerseTexts(['1:2', '1:3'], 'warsh', 5000),
    ).resolves.toEqual({
      status: 'ready',
      rewayah: 'warsh',
      texts: ['', `R1 R2 R3 ${M1}`],
    });
    await expect(resolveVerseTexts(['1:2'], 'warsh', 5000)).resolves.toEqual({
      status: 'ready',
      rewayah: 'warsh',
      texts: [''],
    });
  });

  it('reports a non-Hafs failure instead of substituting Hafs', async () => {
    const resolving = resolveVerseTexts(['1:1'], 'warsh', 5000);
    t.failSideLoad('warsh');
    await expect(resolving).resolves.toEqual({
      status: 'unavailable',
      rewayah: 'warsh',
    });
  });

  it('falls back to the bundled Hafs text only for a Hafs request', async () => {
    t.reset('warsh', REWAYAH);
    const resolving = resolveVerseTexts(['1:1'], 'hafs', 5000);
    t.failSideLoad('hafs');
    const result = await resolving;
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.rewayah).toBe('hafs');
    expect(result.texts).toEqual([getBundledHafsVerseText('1:1')]);
    expect(result.texts[0].length).toBeGreaterThan(0);
  });

  it('serves the bundled Hafs text at once when the Hafs words failed to load', async () => {
    jest.useFakeTimers();
    t.reset('hafs', {}, false);
    t.failMainLoad();
    expect(isHafsTextFailed('hafs')).toBe(true);
    // No timer is advanced: the 10 s wait must not apply.
    await expect(resolveVerseTexts(['1:1'], 'hafs')).resolves.toEqual({
      status: 'ready',
      rewayah: 'hafs',
      texts: [getBundledHafsVerseText('1:1')],
    });
    expect(dk.ensureRewayahLoaded).not.toHaveBeenCalled();
  });

  it('serves the bundled Hafs text as soon as a Hafs load it waits for fails', async () => {
    jest.useFakeTimers();
    t.reset('hafs', {}, false);
    const resolving = resolveVerseTexts(['1:2'], 'hafs');
    t.failMainLoad();
    await expect(resolving).resolves.toEqual({
      status: 'ready',
      rewayah: 'hafs',
      texts: [getBundledHafsVerseText('1:2')],
    });
  });

  it('never treats a failed non-Hafs load like the Hafs fallback', () => {
    t.markFailed('warsh');
    expect(isHafsTextFailed('warsh')).toBe(false);
  });
});

describe('getBundledHafsVerseText', () => {
  it('reads the bundled Hafs JSON by verse key', () => {
    const raw = require('@/data/quran.json') as Record<
      string,
      {verse_key: string; text: string}
    >;
    const entry = Object.values(raw).find(v => v.verse_key === '2:255');
    expect(getBundledHafsVerseText('2:255')).toBe(entry?.text);
    expect(getBundledHafsVerseText('999:1')).toBe('');
  });
});

describe('joinVerseTexts', () => {
  it('breaks lines only after a verse number', () => {
    expect(joinVerseTexts([`H1 H2 ${M1}`, `H3 H4 ${M2}`])).toBe(
      `H1 H2 ${M1}\nH3 H4 ${M2}`,
    );
  });

  it('keeps a rewayah verse that spans two Hafs verses on one line', () => {
    expect(joinVerseTexts(['R1 R2', `R3 R4 R5 ${M1} R6 ${M2}`])).toBe(
      `R1 R2 R3 R4 R5 ${M1} R6 ${M2}`,
    );
  });

  it('treats the bare digits of the bundled Hafs JSON as a verse end', () => {
    expect(joinVerseTexts(['H1 ١', 'H2 ٢'])).toBe('H1 ١\nH2 ٢');
  });

  it('skips empty verses without leaving stray separators', () => {
    expect(joinVerseTexts(['', `H1 ${M1}`, '', `H2 ${M2}`, ''])).toBe(
      `H1 ${M1}\nH2 ${M2}`,
    );
    expect(joinVerseTexts([`R1 ${M1}`, '', `R2 ${M3}`])).toBe(
      `R1 ${M1}\nR2 ${M3}`,
    );
    expect(joinVerseTexts([])).toBe('');
  });
});

describe('selections without visible text', () => {
  it('detects a selection with no words of its own', () => {
    expect(hasNoOwnText(['', ''])).toBe(true);
    expect(hasNoOwnText([''])).toBe(true);
    expect(hasNoOwnText(['', `R1 ${M1}`])).toBe(false);
    // An empty selection is not a selection without words.
    expect(hasNoOwnText([])).toBe(false);
  });

  it('explains it without em dashes', () => {
    const message = noOwnTextMessage('warsh');
    expect(message).toContain('Warsh');
    expect(message).not.toMatch(/[—–]/);
  });
});

describe('references', () => {
  it('formats single verses and ranges', () => {
    expect(formatVerseRange(['2:255'])).toBe('2:255');
    expect(formatVerseRange(['2:255', '2:256', '2:257'])).toBe('2:255-257');
    expect(formatVerseRange(['2:286', '3:1', '3:2'])).toBe('2:286 - 3:2');
    expect(formatVerseRange([])).toBe('');
  });

  it('labels non-Hafs citations with the rewayah of the text', () => {
    expect(formatQuranCitation('2:255', 'hafs')).toBe('Quran 2:255');
    expect(formatQuranCitation('2:255', 'warsh')).toBe('Quran 2:255 · Warsh');
    expect(formatQuranCitation('Al-Baqarah 2:255', 'qalun')).toBe(
      'Quran Al-Baqarah 2:255 · Qalun',
    );
  });
});

describe('useRewayahVerseTexts', () => {
  type ProbeProps = {verseKeys: string[]; rewayah: string};

  function renderProbe(props: ProbeProps) {
    const results: UseRewayahVerseTextsResult[] = [];
    const Probe = ({verseKeys, rewayah}: ProbeProps) => {
      results.push(
        useRewayahVerseTexts(
          verseKeys,
          rewayah as Parameters<typeof useRewayahVerseTexts>[1],
        ),
      );
      return null;
    };
    // react-test-renderer's typings pin their own React element type.
    type RendererElement = Parameters<typeof TestRenderer.create>[0];
    const element = (p: ProbeProps) =>
      React.createElement(Probe, p) as unknown as RendererElement;
    let renderer: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      renderer = TestRenderer.create(element(props));
    });
    return {
      results,
      latest: () => results[results.length - 1],
      rerender: (next: ProbeProps) =>
        act(() => {
          renderer?.update(element(next));
        }),
      unmount: () => act(() => renderer?.unmount()),
    };
  }

  const flush = () =>
    act(async () => {
      await Promise.resolve();
    });

  it('is ready at once for the active rewayah', () => {
    const probe = renderProbe({verseKeys: ['1:1'], rewayah: 'hafs'});
    expect(probe.latest()).toMatchObject({
      status: 'ready',
      rewayah: 'hafs',
      texts: [`H1 H2 ${M1}`],
    });
    probe.unmount();
  });

  it('loads a side rewayah and re-renders when it lands', async () => {
    const probe = renderProbe({verseKeys: ['1:1', '1:2'], rewayah: 'warsh'});
    expect(probe.latest().status).toBe('loading');
    expect(dk.ensureRewayahLoaded).toHaveBeenCalledWith('warsh');

    await act(async () => {
      t.finishSideLoad('warsh', REWAYAH);
    });

    expect(probe.latest()).toMatchObject({
      status: 'ready',
      rewayah: 'warsh',
      texts: ['R1 R2', `R3 R4 R5 ${M1} R6 ${M2}`],
    });
    probe.unmount();
  });

  it('is ready for a selection holding a verse with no visible words', async () => {
    const probe = renderProbe({verseKeys: ['1:2', '1:3'], rewayah: 'warsh'});
    await act(async () => {
      t.finishSideLoad('warsh', MERGED);
    });
    expect(probe.latest()).toMatchObject({
      status: 'ready',
      rewayah: 'warsh',
      texts: ['', `R1 R2 R3 ${M1}`],
    });
    probe.unmount();
  });

  it('does not restart the load when given a fresh array with the same keys', async () => {
    const probe = renderProbe({verseKeys: ['1:1'], rewayah: 'warsh'});
    probe.rerender({verseKeys: ['1:1'], rewayah: 'warsh'});
    await flush();
    expect(dk.ensureRewayahLoaded).toHaveBeenCalledTimes(1);
    probe.unmount();
  });

  it('reports a failed non-Hafs load and can retry', async () => {
    const probe = renderProbe({verseKeys: ['1:1'], rewayah: 'warsh'});
    await act(async () => {
      t.failSideLoad('warsh');
    });
    await flush();
    expect(probe.latest()).toMatchObject({
      status: 'unavailable',
      rewayah: 'warsh',
    });
    expect(probe.latest()).not.toHaveProperty('texts');

    act(() => probe.latest().retry());
    await flush();
    expect(probe.latest().status).toBe('loading');
    expect(dk.ensureRewayahLoaded).toHaveBeenCalledTimes(2);

    await act(async () => {
      t.finishSideLoad('warsh', REWAYAH);
    });
    expect(probe.latest()).toMatchObject({status: 'ready', texts: ['R1 R2']});
    probe.unmount();
  });

  it('serves a failed Hafs load from the bundled Hafs text', async () => {
    t.reset('warsh', REWAYAH);
    const probe = renderProbe({verseKeys: ['1:1'], rewayah: 'hafs'});
    await act(async () => {
      t.failSideLoad('hafs');
    });
    await flush();
    expect(probe.latest()).toMatchObject({
      status: 'ready',
      rewayah: 'hafs',
      texts: [getBundledHafsVerseText('1:1')],
    });
    probe.unmount();
  });

  it('serves the bundled Hafs text on the first render when the Hafs words already failed', () => {
    t.reset('hafs', {}, false);
    t.failMainLoad();
    const probe = renderProbe({verseKeys: ['1:1'], rewayah: 'hafs'});
    expect(probe.results.map(r => r.status)).not.toContain('loading');
    expect(probe.latest()).toMatchObject({
      status: 'ready',
      rewayah: 'hafs',
      texts: [getBundledHafsVerseText('1:1')],
    });
    expect(dk.ensureRewayahLoaded).not.toHaveBeenCalled();
    probe.unmount();
  });

  it('waits for a Hafs startup load still running, then uses its words', async () => {
    t.reset('hafs', {}, false);
    const probe = renderProbe({verseKeys: ['1:1'], rewayah: 'hafs'});
    expect(probe.latest().status).toBe('loading');
    await act(async () => {
      t.finishMainLoad('hafs', HAFS);
    });
    expect(probe.latest()).toMatchObject({
      status: 'ready',
      texts: [`H1 H2 ${M1}`],
    });
    probe.unmount();
  });
});
